import type { PermissionRequestInfo, Question, TranscriptEntry } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'
import { describePermission } from '../permissions/describe'

/** Longest text read aloud from an answer before "the rest is in the app". */
export const READOUT_MAX = 500

/**
 * Markdown as plain words for speech: code blocks become `codeNote`, links keep their text, bare
 * URLs and markup go away, and each line ends as a sentence.
 */
export function speakable(markdown: string, codeNote: string): string {
  const lines = markdown
    .replace(/```[\s\S]*?(```|$)/g, `\n${codeNote}\n`)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+/, '')
        .replace(/^\s*\|?[-:\s|]+\|?\s*$/, '')
        .replace(/\s*\|\s*/g, ', ')
        .replace(/(\*\*|__|~~|\*|_)(\S[^*_~]*?)\1/g, '$2')
        .replace(/^[,\s]+|[,\s]+$/g, '')
        .trim(),
    )
    .filter(Boolean)
  return lines.map((line) => (/[.!?:;…]$/.test(line) ? line : `${line}.`)).join(' ')
}

/** Cuts `text` after the last full sentence that fits in `max`, adding `more`. */
export function cutAtSentence(text: string, max: number, more: string): string {
  if (text.length <= max) return text
  const head = text.slice(0, max)
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  const cut = end > max / 3 ? head.slice(0, end + 1) : `${head.slice(0, head.lastIndexOf(' '))}…`
  return `${cut} ${more}`
}

/** The last answer of the latest turn: the last assistant text after the last prompt. */
export function lastAnswer(entries: readonly TranscriptEntry[]): TranscriptEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (!entry || entry.isSidechain) continue
    if (entry.kind === 'user') return null
    if (entry.kind === 'assistant_text' && entry.text.trim()) return entry
  }
  return null
}

/** What is spoken when a turn ends. */
export function turnSentence(answer: string, t: TFunction): string {
  return cutAtSentence(speakable(answer, t('handsFree.codeNote')), READOUT_MAX, t('handsFree.restInApp'))
}

/** A plain permission: what it does, then how to answer. */
export function permissionSentence(
  info: Pick<PermissionRequestInfo, 'tool' | 'input'>,
  t: TFunction,
): string {
  return `${describePermission(info, t).title}. ${t('handsFree.sayAllowDeny')}`
}

/** One question with its numbered options and how to answer. */
export function questionSentence(question: Question, t: TFunction): string {
  const head = speakable(question.question, t('handsFree.codeNote'))
  if (question.kind !== 'choice' || question.options.length === 0) {
    return `${head} ${t('handsFree.sayAnswer')}`
  }
  const options = question.options
    .map((option, index) => t('handsFree.option', { number: index + 1, label: option.label }))
    .join(' ')
  const hint = question.multiSelect ? t('handsFree.sayOptions') : t('handsFree.sayOption')
  return `${head} ${options} ${hint}`
}
