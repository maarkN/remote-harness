import { addActivityPushTokenListener } from 'expo-widgets'
import { AppState } from 'react-native'
import { withShortLivedClient } from '@/core/connection/short-lived'
import { loadMessaging } from '../push/firebase'
import { relayFor } from '../push/push-relay'
import { type ActivityToken, activityTokenKey, backgroundRegistration } from './logic'

/** Tokens registered by this JS runtime (a failed one can be tried again). */
const sent = new Set<string>()

/**
 * Registers an activity's update token with the daemon over a short-lived connection, so a Live
 * Activity the daemon started by push keeps updating while the app stays closed. No colors: the
 * daemon keeps the ones the follow carried.
 */
async function registerInBackground(token: ActivityToken): Promise<boolean> {
  const sessionId = backgroundRegistration(token, { appActive: AppState.currentState === 'active', sent })
  if (!sessionId) return false
  const key = activityTokenKey(token)
  sent.add(key)
  const ok = await (async () => {
    const messaging = loadMessaging()
    if (!messaging) return false
    const fcmToken = await messaging.getToken(messaging.getMessaging())
    const relay = await relayFor({ fcmToken, platform: 'ios', activityToken: token.pushToken })
    return withShortLivedClient((client) =>
      client.request({
        type: 'live.register',
        sessionId,
        platform: 'ios',
        fcmToken,
        activityToken: token.pushToken,
        ...(relay ? { relay } : {}),
      }),
    )
  })().catch(() => false)
  if (!ok) sent.delete(key)
  return ok
}

/** iOS: listens for the update token of every Live Activity, from the entry file (no router). */
export function listenForActivityTokens(): void {
  try {
    addActivityPushTokenListener((token) => void registerInBackground(token))
  } catch {
    // Binaries built before the `expo-widgets` patch have no such event.
  }
}
