import type { AccountLimits, SessionStatus, TranscriptEntry } from '@remote-harness/protocol'

/** A base64 image in a transcript line; other sources (`url`, `file`) are not supported and yield null. */
export type ImageData = { mediaType: string; data: string; bytes: number }

/** Lines that update the session itself rather than the conversation. */
export type TranscriptMetaUpdate = {
  customTitle?: string
  permissionMode?: string
  /** Codex: the approval policy of the turn (`on-request`…), shown as the session's mode. */
  approvalPolicy?: string
  /** Codex: the permission profile of the turn (`:workspace`…). */
  permissionProfile?: string
  /** Codex: status items the line knows (a `turn_context` the model, a `token_count` the context). */
  status?: Partial<SessionStatus>
  /** Codex: the account's rate limits, for the session's profile. */
  limits?: Pick<AccountLimits, 'fiveHour' | 'sevenDay'>
}

/** A session's status with the items a line knows replaced (the others are kept). */
export function mergeStatus(current: SessionStatus | null, update: Partial<SessionStatus>): SessionStatus {
  return { ...(current ?? { model: null, effort: null, context: null }), ...update }
}

/** The status and limits a run of meta updates ends with (later items win); null without any. */
export function latestStatus(
  updates: readonly (TranscriptMetaUpdate | null)[],
): Pick<TranscriptMetaUpdate, 'status' | 'limits'> | null {
  let status: SessionStatus | null = null
  let limits: TranscriptMetaUpdate['limits'] | null = null
  for (const update of updates) {
    if (update?.status) status = mergeStatus(status, update.status)
    if (update?.limits) limits = update.limits
  }
  if (!status && !limits) return null
  return { ...(status ? { status } : {}), ...(limits ? { limits } : {}) }
}

/**
 * How one agent writes its transcript. Each format lives in its own module and is the only code that
 * knows that agent's lines; the transcript service only sees normalized entries. Never throws.
 */
export type TranscriptFormat = {
  /**
   * The agent appends a message again, whole, when it changes (Gemini CLI): an entry key may show up
   * on several lines and only its first line counts (see `TranscriptFile.entries`).
   */
  upserts?: boolean
  parseLine(raw: string, cursor: number): TranscriptEntry[]
  parseMeta(raw: string): TranscriptMetaUpdate | null
  /** The `index`-th image of a line, matching the ids `parseLine` gave its image refs. */
  findImage(raw: string, index: number): ImageData | null
}
