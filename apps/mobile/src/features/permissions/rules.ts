import type { ApprovalEntry, Profile, RuleFile } from '@remote-harness/protocol'

/** Profile files first (in the daemon's profile order), then projects by path. */
export function sortRuleFiles(files: readonly RuleFile[], profiles: readonly Profile[]): RuleFile[] {
  const order = (f: RuleFile) => {
    const index = profiles.findIndex((p) => p.id === f.profileId)
    return f.scope === 'profile' ? (index === -1 ? profiles.length : index) : profiles.length + 1
  }
  return [...files].sort((a, b) => order(a) - order(b) || (a.project ?? '').localeCompare(b.project ?? ''))
}

/** The heading of a file's group: the profile's name or the project folder. */
export function ruleFileTitle(file: RuleFile, profiles: readonly Profile[]): string {
  if (file.scope === 'profile')
    return profiles.find((p) => p.id === file.profileId)?.name ?? file.profileId ?? ''
  return file.project ?? file.file
}

/** The rules log IDs of the app-created rules still in their files. */
export function appRuleIds(files: readonly RuleFile[]): Set<string> {
  return new Set(files.flatMap((f) => f.rules.flatMap((r) => (r.origin === 'app' ? [r.ruleId] : []))))
}

export type ApprovalLabel = 'allow' | 'allowAlways' | 'deny' | 'undo' | 'delete'

export function approvalLabel(entry: ApprovalEntry): ApprovalLabel {
  return entry.action === 'allow' && entry.always ? 'allowAlways' : entry.action
}

/** What the entry was about: the rule, or the tool with its short target (`Bash · git commit`). */
export function approvalSubject(entry: ApprovalEntry): string {
  if (entry.rule && entry.action !== 'allow') return entry.rule
  return [entry.tool, entry.target].filter(Boolean).join(' · ')
}

/** An "allowed always" entry whose rule is still an app-created rule: Undo is offered there. */
export function undoableRuleId(entry: ApprovalEntry, ids: ReadonlySet<string>): string | null {
  return entry.action === 'allow' && entry.always && entry.ruleId && ids.has(entry.ruleId)
    ? entry.ruleId
    : null
}
