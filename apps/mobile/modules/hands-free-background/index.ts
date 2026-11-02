import { type NativeModule, requireOptionalNativeModule } from 'expo'

/** What the system shows while hands-free is on (iOS Now Playing card, Android notification), translated by the app. */
export type HandsFreeBackgroundTexts = {
  /** "Hands-free is on". */
  title: string
  /** The session's title. */
  subtitle: string
  /** Android: label of the notification's Stop action. */
  stop: string
  /** Android: name of the notification channel, as the system settings list it. */
  channel: string
  /** Android: link the notification opens when tapped (the session). */
  link: string
}

type Events = {
  /** The user turned hands-free off from the lock screen (iOS pause/stop, Android Stop action). */
  onStop: () => void
  /** iOS: play or the headset's play/pause button, meaning Talk. */
  onTalk: () => void
}

declare class HandsFreeBackgroundModule extends NativeModule<Events> {
  /**
   * Keeps the app alive for hands-free: iOS activates a spoken-audio session with a silent engine
   * under the `audio` background mode and shows a Now Playing card; Android starts a foreground
   * service with a persistent notification.
   */
  start(texts: HandsFreeBackgroundTexts): void
  /** iOS: back to the playback-only session after a listening ended (lets go of the microphone). */
  release(): void
  /** Ends the keep-alive and removes the card / notification. */
  stop(): void
}

/** `null` on binaries built before the module (an over-the-air update): hands-free then stops when the app is suspended. */
export const HandsFreeBackground =
  requireOptionalNativeModule<HandsFreeBackgroundModule>('HandsFreeBackground')
