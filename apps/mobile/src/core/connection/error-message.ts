import type { TFunction } from '../i18n/create'
import { DaemonRequestError } from './daemon-client'

/**
 * The translated text of each error code: every code of the protocol plus the client's own
 * `disconnected` / `timeout`, so a known code never shows the daemon's message, which is in English
 * (#545).
 */
const MESSAGE_KEYS = {
  bad_request: 'errors.badRequest',
  unknown_type: 'errors.unknownType',
  unauthorized: 'errors.unauthorized',
  protocol_mismatch: 'errors.protocolMismatch',
  not_found: 'errors.notFound',
  not_controllable: 'errors.notControllable',
  invalid_key: 'errors.invalidKey',
  too_large: 'errors.tooLarge',
  unsupported_media: 'errors.unsupportedMedia',
  already_resolved: 'errors.alreadyResolved',
  mode_forbidden: 'errors.modeForbidden',
  mode_unreachable: 'errors.modeUnreachable',
  session_busy: 'errors.sessionBusy',
  invalid_cwd: 'errors.invalidCwd',
  commands_disabled: 'errors.commandsDisabled',
  internal: 'errors.internal',
  disconnected: 'errors.disconnected',
  timeout: 'errors.timeout',
} as const satisfies Record<DaemonRequestError['code'], string>

/**
 * User-facing text for a failed request: `byCode` overrides per error code, then the translated
 * text of the code; the message itself only for errors that are not the daemon's.
 */
export function errorMessage(
  error: unknown,
  t: TFunction,
  byCode: Partial<Record<DaemonRequestError['code'], string>> = {},
): string {
  if (error instanceof DaemonRequestError) {
    return byCode[error.code] ?? t(MESSAGE_KEYS[error.code])
  }
  return error instanceof Error ? error.message : String(error)
}
