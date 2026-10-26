import { join } from 'node:path'
import type { ListedRule, Profile, RuleFile, RuleScope } from '@remote-harness/protocol'
import { adapterOf } from '../agents/index.ts'
import { localSettingsRoot } from '../checkout/worktree-copy.ts'
import type { RuleLogEntry } from './rules-log.ts'
import { readAllowRules } from './settings-rules.ts'

/** A settings file that may hold always-allow rules, before it is read. */
export type RuleSource = {
  file: string
  scope: RuleScope
  profileId: string | null
  project: string | null
}

/**
 * The files `rules.list` reads: the `settings.json` of every profile whose agent takes rules, and
 * the `.claude/settings.local.json` of every project with a known session (a worktree Claude Code
 * created keeps its project rules in the main checkout's file). One entry per file.
 */
export function ruleSources(profiles: readonly Profile[], cwds: readonly string[]): RuleSource[] {
  const sources = new Map<string, RuleSource>()
  for (const profile of profiles) {
    if (!adapterOf(profile.agent).permissionRules) continue
    const file = join(profile.configDir, 'settings.json')
    if (!sources.has(file))
      sources.set(file, { file, scope: 'profile', profileId: profile.id, project: null })
  }
  for (const cwd of cwds) {
    if (!cwd) continue
    const project = localSettingsRoot(cwd)
    const file = join(project, '.claude', 'settings.local.json')
    if (!sources.has(file)) sources.set(file, { file, scope: 'project', profileId: null, project })
  }
  return [...sources.values()]
}

/** Marks each rule of a file `app` when the rules log created it there (latest entry wins), else `hand`. */
export function markRules(
  file: string,
  rules: readonly string[],
  log: readonly RuleLogEntry[],
): ListedRule[] {
  return rules.map((rule) => {
    const entry = log.findLast((e) => e.file === file && e.rule === rule)
    return entry
      ? { origin: 'app', rule, ruleId: entry.id, createdAt: entry.createdAt }
      : { origin: 'hand', rule }
  })
}

/** Reads the sources; files that are missing, unreadable or without rules are left out. */
export async function listRuleFiles(
  sources: readonly RuleSource[],
  log: readonly RuleLogEntry[],
): Promise<RuleFile[]> {
  const files = await Promise.all(
    sources.map(async (source): Promise<RuleFile | null> => {
      const rules = await readAllowRules(source.file)
      if (!rules || rules.length === 0) return null
      return { ...source, rules: markRules(source.file, rules, log) }
    }),
  )
  return files.filter((f): f is RuleFile => f !== null)
}
