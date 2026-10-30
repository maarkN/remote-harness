import { copyFile, realpath, stat } from 'node:fs/promises'
import { readJsonFile, writeJsonAtomic } from '../../infra/fs.ts'
import { BACKUP_SUFFIX } from '../hooks/installer.ts'

type Settings = Record<string, unknown>

function isRecord(value: unknown): value is Settings {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The `permissions.allow` rule strings of a settings object (anything else in the list is skipped). */
export function allowRulesOf(settings: unknown): string[] {
  const permissions = isRecord(settings) ? settings.permissions : undefined
  const allow = isRecord(permissions) ? permissions.allow : undefined
  return Array.isArray(allow) ? allow.filter((r): r is string => typeof r === 'string') : []
}

/** The settings without `rule` in `permissions.allow`, every other key kept; null when it is not there. */
export function withoutAllowRule(settings: Settings, rule: string): Settings | null {
  const permissions = isRecord(settings.permissions) ? settings.permissions : {}
  const allow = Array.isArray(permissions.allow) ? (permissions.allow as unknown[]) : []
  const next = allow.filter((r) => r !== rule)
  if (next.length === allow.length) return null
  return { ...settings, permissions: { ...permissions, allow: next } }
}

/** The rules of a settings file; null when it is missing or not a JSON object. */
export async function readAllowRules(file: string): Promise<string[] | null> {
  try {
    const settings = await readJsonFile(file)
    return isRecord(settings) ? allowRulesOf(settings) : null
  } catch {
    return null
  }
}

/**
 * Removes a rule from a settings file: read → merge → backup next to the file → atomic write.
 * Follows a symlink (dotfile managers) and keeps the mode. False, without writing, when the rule
 * (or the file) is not there.
 */
export async function removeAllowRule(file: string, rule: string): Promise<boolean> {
  let target: string
  try {
    target = await realpath(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
  const settings = await readJsonFile(target)
  if (!isRecord(settings)) return false
  const next = withoutAllowRule(settings, rule)
  if (!next) return false
  const mode = (await stat(target)).mode & 0o777
  await copyFile(target, `${file}${BACKUP_SUFFIX}`)
  await writeJsonAtomic(target, next, mode)
  return true
}
