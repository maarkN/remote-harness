import { strToU8, type Zippable, zipSync } from 'fflate'
import type { Report } from './format'

/**
 * One problem report as a zip (#557, ADR 0008): `report.json` (the report plus the list of what is
 * attached), `computer-logs.txt` when the user included them, and the attachments.
 */

/** The site takes 25 MB per report; attachments get all but the room for the JSON and the logs. */
export const ATTACHMENTS_BUDGET = 24 * 1024 * 1024

export type AttachmentKind = 'screenshot' | 'image' | 'video' | 'audio'

/** A file the user attached, still on the device. */
export type Attachment = { kind: AttachmentKind; uri: string; name: string; size: number }

/** The daemon's scrubbed log files (`diagnostics.logs.result`). */
export type ComputerLog = { name: string; text: string; truncated: boolean }

/** `attachments/01-screenshot.jpg`: numbered in order, named by kind, with the file's extension. */
export function attachmentName(index: number, attachment: Pick<Attachment, 'kind' | 'name'>): string {
  const extension = /\.([A-Za-z0-9]{1,5})$/.exec(attachment.name)?.[1]?.toLowerCase()
  return `attachments/${String(index + 1).padStart(2, '0')}-${attachment.kind}${extension ? `.${extension}` : ''}`
}

/** Whether a file of `size` bytes still fits next to `current`. */
export function fitsBudget(current: readonly Pick<Attachment, 'size'>[], size: number): boolean {
  return current.reduce((total, a) => total + a.size, 0) + size <= ATTACHMENTS_BUDGET
}

/** The line a GitHub issue body starts with once the report was uploaded. */
export function issueBodyNote(reportId: string): string {
  return `Report ID: ${reportId}`
}

function logsText(logs: readonly ComputerLog[]): string {
  return logs.map((log) => `== ${log.name}${log.truncated ? ' (last part)' : ''} ==\n${log.text}`).join('\n')
}

export function bundleReport({
  report,
  logs,
  files,
}: {
  report: Report
  logs: readonly ComputerLog[] | null
  files: readonly { attachment: Attachment; bytes: Uint8Array }[]
}): Uint8Array {
  const named = files.map((file, index) => ({ ...file, path: attachmentName(index, file.attachment) }))
  const json = {
    ...report,
    attachments: named.map(({ path, attachment, bytes }) => ({
      file: path,
      kind: attachment.kind,
      size: bytes.byteLength,
    })),
    computerLogs: logs !== null,
  }
  const entries: Zippable = { 'report.json': strToU8(JSON.stringify(json, null, 2)) }
  if (logs) entries['computer-logs.txt'] = strToU8(logsText(logs))
  // Media is already compressed: stored as is, which also keeps zipping fast on the phone.
  for (const { path, bytes } of named) entries[path] = [bytes, { level: 0 }]
  return zipSync(entries, { level: 6 })
}
