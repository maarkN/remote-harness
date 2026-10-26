import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import {
  APPROVALS_LIST_LIMIT,
  type ApprovalAction,
  type ApprovalEntry,
  ApprovalEntrySchema,
} from '@remote-harness/protocol'
import { writeFileAtomic } from '../../infra/fs.ts'
import { stepTarget } from '../live-status/status.ts'
import { parseRule } from './rules.ts'

/** How long the approval log keeps an entry. */
export const APPROVAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** What a feature hands over to log; `input` is only read through the live status table. */
export type ApprovalEvent = {
  action: ApprovalAction
  always?: boolean
  device: { id: string; name: string } | null
  sessionId: string | null
  cwd: string | null
  tool: string | null
  input?: Readonly<Record<string, unknown>>
  rule?: string | null
  ruleId?: string | null
}

/**
 * The log entry of an event: the short target from `stepTarget` (base file name, command program,
 * URL host) and the folder's base name. Nothing else of the input is kept. Rule actions take the
 * tool from the rule.
 */
export function approvalEntry(event: ApprovalEvent, at: Date, id: string = randomUUID()): ApprovalEntry {
  const rule = event.rule ?? null
  const tool = event.tool ?? (rule ? (parseRule(rule)?.toolName ?? null) : null)
  return {
    id,
    at: at.toISOString(),
    action: event.action,
    ...(event.always ? { always: true } : {}),
    device: event.device,
    sessionId: event.sessionId,
    folder: event.cwd ? basename(event.cwd) || null : null,
    tool,
    target: tool && event.input ? stepTarget(tool, event.input) : null,
    rule,
    ruleId: event.ruleId ?? null,
  }
}

/** The entries newer than the retention window. */
export function withinRetention(entries: readonly ApprovalEntry[], now: number): ApprovalEntry[] {
  const cutoff = now - APPROVAL_RETENTION_MS
  return entries.filter((e) => Date.parse(e.at) >= cutoff)
}

/** Parses the JSON lines of the log; broken or unknown lines are skipped. */
export function parseApprovalLines(text: string): ApprovalEntry[] {
  return text.split('\n').flatMap((line) => {
    if (!line.trim()) return []
    try {
      const parsed = ApprovalEntrySchema.safeParse(JSON.parse(line))
      return parsed.success ? [parsed.data] : []
    } catch {
      return []
    }
  })
}

/** Append-only log of what devices approved, denied, undid and deleted (`approvals.jsonl`), 30 days. */
export class ApprovalLog {
  constructor(
    private readonly path: string,
    private readonly now: () => number = Date.now,
  ) {}

  async add(event: ApprovalEvent): Promise<ApprovalEntry> {
    const entry = approvalEntry(event, new Date(this.now()))
    await mkdir(dirname(this.path), { recursive: true })
    await appendFile(this.path, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
    return entry
  }

  /** Most recent first, at most `limit`, expired entries left out. */
  async list(limit = APPROVALS_LIST_LIMIT): Promise<ApprovalEntry[]> {
    return withinRetention(await this.read(), this.now())
      .reverse()
      .slice(0, limit)
  }

  /** Rewrites the file without the expired entries (no write when none expired). */
  async prune(): Promise<number> {
    const all = await this.read()
    const kept = withinRetention(all, this.now())
    if (kept.length === all.length) return 0
    await writeFileAtomic(this.path, kept.map((e) => `${JSON.stringify(e)}\n`).join(''), 0o600)
    return all.length - kept.length
  }

  private async read(): Promise<ApprovalEntry[]> {
    try {
      return parseApprovalLines(await readFile(this.path, 'utf8'))
    } catch {
      return []
    }
  }
}
