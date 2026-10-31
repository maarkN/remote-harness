/** 2: Noise end-to-end channel with per-device keys (ADR-0002); `auth` carries no token. */
export const PROTOCOL_VERSION = 2
/**
 * Oldest daemon whose features this app version relies on; older ones still connect (same
 * protocol) but the app suggests `remote-harness update`. Raise it with the features that need it.
 */
export const MIN_DAEMON_VERSION = '0.3.0'

export * from './client.ts'
export * from './deltas.ts'
export * from './domain.ts'
export * from './last-activity.ts'
export * from './locale.ts'
export * from './noise/index.ts'
export * from './parse.ts'
export * from './server.ts'
