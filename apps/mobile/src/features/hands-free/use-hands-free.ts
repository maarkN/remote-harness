import type { PermissionRequestInfo } from '@remote-harness/protocol'
import * as Haptics from 'expo-haptics'
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDaemonClient } from '@/core/connection'
import { currentLocale, i18n } from '@/core/i18n'
import { streamKey, useTranscriptStore } from '../conversation/store'
import { usePermissionsStore } from '../permissions/store'
import { useRespond } from '../permissions/use-respond'
import { useSessionsStore } from '../sessions/store'
import { resolveVoiceLanguage } from '../voice/language'
import { useVoiceLanguageStore } from '../voice/voice-language-store'
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
 * after it is turned on is read. `onExit` turns it off ("stop", or the session ended).
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
  })

  useEffect(() => {
    if (!enabled) return
    let active = true
    engine.current = INITIAL_STATE
    const keepAwake = loadKeepAwake()
    void keepAwake?.activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined)
    void ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => undefined)

    // Only what happens from now on is read: the current answer and requests count as seen.
    const key = streamKey(sessionId)
    const entries = () => useTranscriptStore.getState().streams[key]?.entries ?? []
    let lastRead = lastAnswer(entries())?.uuid ?? null
    const pendingOf = () =>
      Object.values(usePermissionsStore.getState().pending).filter((r) => r.sessionId === sessionId)
    const seen = new Set(pendingOf().map((r) => r.requestId))
    dispatch({ type: 'enqueue', item: { kind: 'notice', say: latest.current.t('handsFree.on') } })

    let state = useSessionsStore.getState().sessions[sessionId]?.state
    const offSessions = useSessionsStore.subscribe((store) => {
      const session = store.sessions[sessionId]
      if (!session || session.state === 'ended' || !session.controllable) {
        if (active) latest.current.onExit()
        return
      }
      const finished = state === 'running' && session.state !== 'running'
      state = session.state
      if (!finished) return
      const entry = lastAnswer(entries())
      if (entry?.kind !== 'assistant_text' || entry.uuid === lastRead) return
      lastRead = entry.uuid
      dispatch({ type: 'enqueue', item: { kind: 'notice', say: turnSentence(entry.text, latest.current.t) } })
    })
    const offPermissions = usePermissionsStore.subscribe(() => {
      const pending = pendingOf()
      const ids = new Set(pending.map((r) => r.requestId))
      for (const request of pending) {
        if (seen.has(request.requestId)) continue
        seen.add(request.requestId)
        dispatch({ type: 'enqueue', item: requestItem(request, latest.current.t) })
      }
      for (const id of [...seen]) {
        if (ids.has(id)) continue
        seen.delete(id)
        dispatch({ type: 'resolved', requestId: id })
      }
    })
    return () => {
      active = false
      offSessions()
      offPermissions()
      loadSpeech()?.stop()
      stopListening()
      keepAwake?.deactivateKeepAwake(KEEP_AWAKE_TAG)
      engine.current = INITIAL_STATE
      setUi({ phase: 'idle', lastSaid: '' })
    }
  }, [enabled, sessionId, dispatch, stopListening])

  return {
    phase: ui.phase,
    lastSaid: ui.lastSaid,
    talk: () => dispatch({ type: 'talk' }),
    repeat: () => dispatch({ type: 'repeat' }),
  }
}
