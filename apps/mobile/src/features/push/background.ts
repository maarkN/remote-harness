import * as Notifications from 'expo-notifications'
import { addUserInteractionListener } from 'expo-widgets'
import { Platform } from 'react-native'
import {
  answeredLiveNotification,
  isLiveNotificationId,
  liveNotification,
  parseLiveData,
} from '../live-status/android-notification'
import { presentLiveNotification } from '../live-status/android-renderer'
import { listenForActivityTokens } from '../live-status/background-register'
import { liveAction } from '../live-status/logic'
import { registerAndroidWidgetTask } from '../widgets/android/task-handler'
import { parseWidgetTarget } from '../widgets/logic'
import { answerFromWidget, refreshWidgetsInBackground } from '../widgets/refresh'
import { loadMessaging } from './firebase'
import { ACTION_ALLOW, ACTION_DENY, extractPushData } from './payload'
import { respondInBackground, sendInBackground } from './respond-in-background'
import { parseTurnData, TURN_CHANNEL_ID, turnActionOf, turnRequest } from './turn'

/**
 * Loaded by the entry file (`index.ts`) before Expo Router: headless JS (an FCM message or a
 * notification action with the app closed) never mounts the router, so these handlers must be set at
 * module scope. Android: FCM data messages, notification actions and widget taps. iOS: Live Activity
 * tokens, Deny / Allow on the Live Activity and the widgets, and widget refresh pushes, which iOS may
 * hand to the app in the background without its screens.
 */

/** Background task (expo-task-manager) that gets Allow / Deny tapped with the app in the background or closed. */
export const LIVE_ACTION_TASK = 'live-status-action'

const isAndroid = Platform.OS === 'android'

type TaskManagerModule = typeof import('expo-task-manager')

/** `null` on binaries built before expo-task-manager (an over-the-air update): actions then open the app. */
function loadTaskManager(): TaskManagerModule | null {
  try {
    return require('expo-task-manager') as TaskManagerModule
  } catch {
    return null
  }
}

let backgroundActions = false

/** Whether notification actions can be answered without opening the app (Android needs the task). */
export function canAnswerInBackground(): boolean {
  return !isAndroid || backgroundActions
}

/** Draws the live status of an FCM data message; `false` when the push is not one. */
export async function showLiveMessage(data: unknown): Promise<boolean> {
  const push = parseLiveData(data)
  if (!push) return false
  await presentLiveNotification(liveNotification(push), backgroundActions)
  return true
}

/**
 * Draws a turn push the daemon sent as an Android data message (with Reply / Interrupt), replacing
 * the session's previous one; `false` when the push is not one.
 */
export async function showTurnMessage(data: unknown): Promise<boolean> {
  const turn = parseTurnData(data)
  if (!turn) return false
  await Notifications.scheduleNotificationAsync({
    identifier: `turn-${turn.data.sessionId}`,
    content: { title: turn.title, body: turn.body, data: turn.data, categoryIdentifier: turn.category },
    trigger: { channelId: TURN_CHANNEL_ID },
  })
  return true
}

/** `data.event` of the daemon's widget refresh push (data only, no content). */
const WIDGET_REFRESH_EVENT = 'widgets'

/** A widget refresh push: fetches the computer's state and redraws the widgets; `false` when not one. */
export async function refreshFromPush(data: unknown): Promise<boolean> {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  if (record.event !== WIDGET_REFRESH_EVENT) return false
  const daemonId = typeof record.daemonId === 'string' ? record.daemonId : undefined
  await refreshWidgetsInBackground(daemonId).catch(() => false)
  return true
}

/** An FCM data message: a widget refresh, the live status or a turn push. */
export async function showDataMessage(data: unknown): Promise<void> {
  if (await refreshFromPush(data).catch(() => false)) return
  if (await showLiveMessage(data).catch(() => false)) return
  await showTurnMessage(data).catch(() => undefined)
}

/**
 * Answers in progress or done, by request: with the app in the background Android hands the same tap
 * to the background task and to the app's listener, and the request must be answered once.
 */
const answers = new Map<string, Promise<boolean>>()

/**
 * Allow / Deny tapped on a notification: answers the request over a short-lived connection and, on a
 * live status, drops the buttons until the daemon's next update. `null` = not an Allow / Deny action.
 */
export function answerAction(response: Notifications.NotificationResponse): Promise<boolean> | null {
  const action = response.actionIdentifier
  const turn = turnActionOf(action)
  if (turn) return turn === 'voice' ? null : answerTurn(response, turn)
  if (action !== ACTION_ALLOW && action !== ACTION_DENY) return null
  const { request } = response.notification
  const data = extractPushData(request)
  if (!data?.requestId) return null
  const { requestId, sessionId, daemonId } = data
  const running = answers.get(requestId)
  if (running) return running
  const answer = respondInBackground(requestId, action === ACTION_ALLOW ? 'allow' : 'deny', daemonId).then(
    async (ok) => {
      // A failed answer can be tried again.
      if (!ok) answers.delete(requestId)
      if (ok && isAndroid && isLiveNotificationId(request.identifier, sessionId)) {
        const { title, body } = request.content
        await presentLiveNotification(
          answeredLiveNotification({ identifier: request.identifier, title, body, sessionId }),
          backgroundActions,
        ).catch(() => undefined)
      }
      return ok
    },
  )
  answers.set(requestId, answer)
  return answer
}

/**
 * Reply / Interrupt / Send next tapped on a turn push: sent over a short-lived connection to the
 * notification's computer (never through the push relay), once per notification and action. `false`
 * (the session opens instead) when it could not be sent or the reply was empty.
 */
function answerTurn(
  response: Notifications.NotificationResponse,
  turn: Exclude<ReturnType<typeof turnActionOf>, null | 'voice'>,
): Promise<boolean> | null {
  const { request } = response.notification
  const data = extractPushData(request)
  if (!data) return null
  const message = turnRequest(turn, data.sessionId, response.userText)
  if (!message) return Promise.resolve(false)
  const key = `${request.identifier}:${response.actionIdentifier}`
  const running = answers.get(key)
  if (running) return running
  const answer = sendInBackground(message, data.daemonId).then(async (ok) => {
    if (!ok) answers.delete(key)
    else await Notifications.dismissNotificationAsync(request.identifier).catch(() => undefined)
    return ok
  })
  answers.set(key, answer)
  return answer
}

if (isAndroid) {
  const messaging = loadMessaging()
  // RN Firebase's FCM service wins over expo-notifications' one, so data messages arrive here.
  messaging?.setBackgroundMessageHandler(messaging.getMessaging(), async (message) => {
    await showDataMessage(message.data)
  })
  const TaskManager = loadTaskManager()
  if (TaskManager) {
    TaskManager.defineTask<Notifications.NotificationTaskPayload>(LIVE_ACTION_TASK, async ({ data }) => {
      if (!data) return
      if ('actionIdentifier' in data) await answerAction(data)
      else await showDataMessage(data.data)
    })
    backgroundActions = true
    Notifications.registerTaskAsync(LIVE_ACTION_TASK).catch(() => {
      backgroundActions = false
    })
  }
  // Home screen widgets: draws and Allow / Deny taps, with the app closed too.
  registerAndroidWidgetTask()
}

if (Platform.OS === 'ios') {
  // A Live Activity the daemon started by push: its token goes to the daemon with the app closed.
  listenForActivityTokens()
  // Deny / Allow tapped on a Live Activity (lock screen or Dynamic Island) or on a Home Screen widget
  // (`app:` targets, performed in the app's process), app in front or not.
  try {
    addUserInteractionListener((event) => {
      const widget = parseWidgetTarget(event.target)
      if (widget) {
        void answerFromWidget(widget.decision, widget.requestId)
        return
      }
      const action = liveAction(event.target)
      if (action) void respondInBackground(action.requestId, action.decision)
    })
  } catch {
    // Live Activities unavailable.
  }
  // Widget refresh pushes (background pushes, `content-available`) with the app in the background.
  const messaging = loadMessaging()
  try {
    messaging?.setBackgroundMessageHandler(messaging.getMessaging(), async (message) => {
      await refreshFromPush(message.data)
    })
  } catch {
    // Builds without Firebase.
  }
}
