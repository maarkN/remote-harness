import { create } from 'zustand'
import { type Attachment, fitsBudget } from './bundle'

/**
 * Files attached to the report being written: the shake's screenshot arrives here before the
 * report screen opens. Kept until the report is sent.
 */
type DraftState = { attachments: Attachment[] }

export const useReportDraft = create<DraftState>(() => ({ attachments: [] }))

/** Adds an attachment when it fits the budget; false when it does not. */
export function addAttachment(attachment: Attachment): boolean {
  const { attachments } = useReportDraft.getState()
  if (!fitsBudget(attachments, attachment.size)) return false
  useReportDraft.setState({ attachments: [...attachments, attachment] })
  return true
}

export function removeAttachment(uri: string): void {
  useReportDraft.setState((s) => ({ attachments: s.attachments.filter((a) => a.uri !== uri) }))
}

export function clearDraft(): void {
  useReportDraft.setState({ attachments: [] })
}
