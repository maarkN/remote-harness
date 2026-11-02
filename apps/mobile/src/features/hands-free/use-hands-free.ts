import type { PermissionRequestInfo } from '@remote-harness/protocol'
import * as Haptics from 'expo-haptics'
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState } from 'react-native'
import { useDaemonClient } from '@/core/connection'
import { currentLocale, i18n } from '@/core/i18n'
import { HandsFreeBackground } from '../../../modules/hands-free-background'
import { streamKey, subscribeTranscript, useTranscriptStore } from '../conversation/store'
import { useMuteStore } from '../mute/store'
import { usePermissionsStore } from '../permissions/store'
import { useRespond } from '../permissions/use-respond'
import { useSessionsStore } from '../sessions/store'
import { resolveVoiceLanguage } from '../voice/language'
import { useVoiceLanguageStore } from '../voice/voice-language-store'
import { announces, backgroundTexts, idleDeadline, idleOffSentence } from './background'
import { parseCommand } from './commands'
import {
  type Effect,
  type HandsFreeEvent,
  type HandsFreeState,
  INITIAL_STATE,
  type Item,
  type Phase,
  step,
} from './engine'
import { loadKeepAwake, loadSpeech } from './native'
import { lastAnswer, permissionSentence, questionSentence, turnSentence } from './readout'

/** Listening stops after this long without a final result (counts as silence). */
const LISTEN_MS = 8_000
const KEEP_AWAKE_TAG = 'hands-free'
/** How often the background idle check runs. */
const IDLE_CHECK_MS = 60_000
/** iOS: speech plays through the session `HandsFreeBackground` configured (spoken audio, ducking others). */
const SPEECH_SESSION = HandsFreeBackground ? { useApplicationAudioSession: true } : {}

export type HandsFree = {
  phase: Phase
  /** Last sentence spoken, shown large in the bar. */
  lastSaid: string
  talk(): void
  repeat(): void
}

/** What a new pending request becomes: a prompt to answer by voice, or a notice to use the screen. */
function requestItem(request: PermissionRequestInfo, t: typeof i18n.t): Item {
  const interaction = request.interaction
  if (request.terminal) {
    return { kind: 'notice', say: t('handsFree.needsScreen', { title: t('handsFree.terminalTitle') }) }
  }
  if (interaction?.kind === 'plan') {
    return { kind: 'notice', say: t('handsFree.needsScreen', { title: t('handsFree.planTitle') }) }
  }
  if (interaction?.kind === 'question' && interaction.questions.length > 0) {
    const says = interaction.questions.map((question) => questionSentence(question, t))
    return {
      kind: 'question',
      requestId: request.requestId,
      questions: interaction.questions,
      says,
      index: 0,
      answers: {},
      say: says[0] ?? '',
    }
  }
  return { kind: 'permission', requestId: request.requestId, say: permissionSentence(request, t) }
}

/**
 * Runs the hands-free engine for a session while `enabled`: reads new turns, permissions and
 * questions aloud, listens for commands and carries out what the engine decides. Only what happens
 * after it is turned on is read. `onExit` turns it off ("stop", the lock-screen control, the idle
 * timeout, or the session ended). With the screen locked or the app in the background (#446) the
 * native keep-alive holds the connection and the audio session; a muted session is not read then,
 * and 30 minutes without activity turn the mode off.
 */
export function useHandsFree(sessionId: string, enabled: boolean, onExit: () => void): HandsFree {
  const { t } = useTranslation()
  const client = useDaemonClient()
  const { respond, answer } = useRespond()
  const engine = useRef<HandsFreeState>(INITIAL_STATE)
  const [ui, setUi] = useState<{ phase: Phase; lastSaid: string }>({ phase: 'idle', lastSaid: '' })
  const listenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const heardText = useRef('')
  const listening = useRef(false)
  /** When something was last read, heard or changed; the background idle timeout counts from it. */
  const lastActivity = useRef(Date.now())
  // Effects call back into `dispatch`; refs keep the latest callbacks without re-subscribing.
  const latest = useRef({ client, respond, answer, onExit, t })
  latest.current = { client, respond, answer, onExit, t }

  const stopListening = useCallback(() => {
    clearTimeout(listenTimer.current)
    if (listening.current) ExpoSpeechRecognitionModule.abort()
    listening.current = false
  }, [])

  // `run` reads the latest callbacks through refs, so `dispatch` never changes.
  const runEffect = useRef<(effect: Effect) => void>(() => undefined)
  const dispatch = useCallback((event: HandsFreeEvent) => {
    lastActivity.current = Date.now()
    const { state, effects } = step(engine.current, event, latest.current.t)
    engine.current = state
    setUi({ phase: state.phase, lastSaid: state.lastSaid })
    for (const effect of effects) runEffect.current(effect)
  }, [])

  function run(effect: Effect) {
    const { client: current, respond: respondTo, answer: answerTo, onExit: exit } = latest.current
    switch (effect.type) {
      case 'speak':
        stopListening()
        loadSpeech()?.speak(effect.text, {
          language: i18n.language,
          ...SPEECH_SESSION,
          onDone: () => dispatch({ type: 'spoken' }),
          onError: () => dispatch({ type: 'spoken' }),
        })
        return
      case 'silence':
        loadSpeech()?.stop()
        stopListening()
        return
      case 'listen':
        heardText.current = ''
        listening.current = true
        ExpoSpeechRecognitionModule.start({
          lang: resolveVoiceLanguage(useVoiceLanguageStore.getState().language, currentLocale()),
          interimResults: false,
          continuous: false,
          addsPunctuation: true,
        })
        clearTimeout(listenTimer.current)
        listenTimer.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), LISTEN_MS)
        return
      case 'haptic':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
        return
      case 'respond':
        void respondTo(effect.requestId, effect.decision)
        return
      case 'answer':
        void answerTo(effect.requestId, { kind: 'question', answers: effect.answers })
        return
      case 'send':
        current?.request({ type: 'session.input', sessionId, text: effect.text, mode: 'auto' }).catch(() =>
          dispatch({
            type: 'enqueue',
            item: { kind: 'notice', say: latest.current.t('handsFree.failed') },
          }),
        )
        return
      case 'exit':
        exit()
        return
    }
  }
  runEffect.current = run

  useSpeechRecognitionEvent('result', (event) => {
    if (!listening.current || !event.isFinal) return
    heardText.current = [heardText.current, event.results[0]?.transcript ?? ''].join(' ').trim()
  })
  useSpeechRecognitionEvent('end', () => {
    if (!listening.current) return
    listening.current = false
    clearTimeout(listenTimer.current)
    const language = resolveVoiceLanguage(useVoiceLanguageStore.getState().language, currentLocale())
    dispatch({ type: 'heard', command: parseCommand(heardText.current, language) })
    // The recognizer left the session in record mode: back to playback until the next listening.
    if (!listening.current) HandsFreeBackground?.release()
  })

  // Our own subscription keeps the turns coming after the conversation screen is gone.
  useEffect(() => {
    if (!enabled || !client) return
    return subscribeTranscript(client, sessionId)
  }, [enabled, client, sessionId])

  useEffect(() => {
    if (!enabled) return
    let active = true
    let exiting = false
    engine.current = INITIAL_STATE
    lastActivity.current = Date.now()
    const keepAwake = loadKeepAwake()
    void keepAwake?.activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined)
    void ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => undefined)

    // The keep-alive and the lock-screen control (#446); `null` on binaries without the module.
    const sessionNow = () => useSessionsStore.getState().sessions[sessionId]
    HandsFreeBackground?.start(
      backgroundTexts({ id: sessionId, title: sessionNow()?.title ?? '' }, latest.current.t),
    )
    const offStop = HandsFreeBackground?.addListener('onStop', () => {
      if (active) latest.current.onExit()
    })
    const offTalk = HandsFreeBackground?.addListener('onTalk', () => dispatch({ type: 'talk' }))
    /** Read aloud now? Always in the foreground; not a muted session in the background. */
    const announced = () => {
      const session = sessionNow()
      return !session || announces(session, useMuteStore.getState(), AppState.currentState === 'active')
    }

    // Only what happens from now on is read: the current answer and requests count as seen.
    const key = streamKey(sessionId)
    const entries = () => useTranscriptStore.getState().streams[key]?.entries ?? []
    let lastRead = lastAnswer(entries())?.uuid ?? null
    const pendingOf = () =>
      Object.values(usePermissionsStore.getState().pending).filter((r) => r.sessionId === sessionId)
    const seen = new Set(pendingOf().map((r) => r.requestId))
    dispatch({ type: 'enqueue', item: { kind: 'notice', say: latest.current.t('handsFree.on') } })

    let state = sessionNow()?.state
    const offSessions = useSessionsStore.subscribe((store) => {
      const session = store.sessions[sessionId]
      if (!session || session.state === 'ended' || !session.controllable) {
        if (active) latest.current.onExit()
        return
      }
      const finished = state === 'running' && session.state !== 'running'
      if (session.state !== state) lastActivity.current = Date.now()
      state = session.state
      if (!finished) return
      const entry = lastAnswer(entries())
      if (entry?.kind !== 'assistant_text' || entry.uuid === lastRead) return
      lastRead = entry.uuid
      if (!announced()) return
      dispatch({ type: 'enqueue', item: { kind: 'notice', say: turnSentence(entry.text, latest.current.t) } })
    })
    const offPermissions = usePermissionsStore.subscribe(() => {
      const pending = pendingOf()
      const ids = new Set(pending.map((r) => r.requestId))
      for (const request of pending) {
        if (seen.has(request.requestId)) continue
        seen.add(request.requestId)
        // A muted session's request in the background stays for the screen.
        if (!announced()) continue
        dispatch({ type: 'enqueue', item: requestItem(request, latest.current.t) })
      }
      for (const id of [...seen]) {
        if (ids.has(id)) continue
        seen.delete(id)
        dispatch({ type: 'resolved', requestId: id })
      }
    })

    // In the background, 30 minutes without anything read, heard or changed turn the mode off.
    const idle = setInterval(async () => {
      if (!active || exiting || AppState.currentState === 'active') return
      if (Date.now() < idleDeadline(lastActivity.current)) return
      exiting = true
      stopListening()
      engine.current = INITIAL_STATE
      const bye = () => {
        if (active) latest.current.onExit()
      }
      const speech = loadSpeech()
      if (!speech) return bye()
      await speech.stop().catch(() => undefined)
      if (!active) return
      speech.speak(idleOffSentence(latest.current.t), {
        language: i18n.language,
        ...SPEECH_SESSION,
        onDone: bye,
        onError: bye,
      })
    }, IDLE_CHECK_MS)

    return () => {
      active = false
      clearInterval(idle)
      offStop?.remove()
      offTalk?.remove()
      offSessions()
      offPermissions()
      loadSpeech()?.stop()
      stopListening()
      keepAwake?.deactivateKeepAwake(KEEP_AWAKE_TAG)
      HandsFreeBackground?.stop()
      engine.current = INITIAL_STATE
      setUi({ phase: 'idle', lastSaid: '' })
    }
  }, [enabled, sessionId, dispatch, stopListening])

  const talk = useCallback(() => dispatch({ type: 'talk' }), [dispatch])
  const repeat = useCallback(() => dispatch({ type: 'repeat' }), [dispatch])

  return { phase: ui.phase, lastSaid: ui.lastSaid, talk, repeat }
}
