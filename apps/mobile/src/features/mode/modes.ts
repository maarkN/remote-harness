import { type CodexPreset, CodexPresetSchema, type SelectableMode } from '@remote-harness/protocol'
import type { TFunction } from '@/core/i18n/create'

// Labels and hints live in the catalogs: `mode.labels.<mode>` and `mode.hints.<mode>`.

/** Modes offered in the app. `bypassPermissions` is deliberately absent. */
export const SELECTABLE_MODES: SelectableMode[] = ['default', 'acceptEdits', 'plan', 'auto']

/** Codex presets offered in the app (`/permissions`). Full access is deliberately absent. */
export const CODEX_PRESETS: readonly CodexPreset[] = CodexPresetSchema.options

/** Agents whose permission mode the app can switch (Claude Code's Shift+Tab cycle). */
export function hasSwitchableModes(agent: string | null): boolean {
  return agent === null || agent === 'claude'
}

export type PolicyTone = 'danger' | 'accent' | 'muted'

/** Codex approval policy chip: `never` runs everything without asking, `on-request` is the default. */
export function approvalPolicyTone(policy: string | null): PolicyTone {
  if (policy === 'never') return 'danger'
  if (policy === 'on-request' || policy === 'on-failure') return 'accent'
  return 'muted'
}

/** Codex's built-in permission profiles, by id; `mode.codex.labels.<key>` names them. */
const BUILT_IN_PROFILES = {
  ':read-only': 'readOnly',
  ':workspace': 'workspace',
  ':danger-full-access': 'fullAccess',
} as const
type BuiltInProfileKey = (typeof BUILT_IN_PROFILES)[keyof typeof BUILT_IN_PROFILES]

function builtInProfile(profile: string | null): BuiltInProfileKey | null {
  return profile && profile in BUILT_IN_PROFILES
    ? BUILT_IN_PROFILES[profile as keyof typeof BUILT_IN_PROFILES]
    : null
}

/** The catalog key of a preset (`mode.codex.labels.*`, `mode.codex.hints.*`). */
export function codexPresetKey(preset: CodexPreset): 'readOnly' | 'workspace' {
  return preset === 'read-only' ? 'readOnly' : 'workspace'
}

/** The preset a session is on, when its permission profile is one of them. */
export function codexPresetOf(profile: string | null): CodexPreset | null {
  const key = builtInProfile(profile)
  return key === 'readOnly' ? 'read-only' : key === 'workspace' ? 'workspace' : null
}

/**
 * The Codex chip: a built-in profile by its translated name, a named profile as is, else the approval
 * policy (profiles unknown on older daemons and Codex versions), `—` when neither is known.
 */
export function codexPermissionsLabel(profile: string | null, policy: string | null, t: TFunction): string {
  const key = builtInProfile(profile)
  if (key) return t(`mode.codex.labels.${key}`)
  return profile ?? policy ?? '—'
}

/** Full access (or never asking) is danger, read only is muted, the rest follows the approval policy. */
export function codexPermissionsTone(profile: string | null, policy: string | null): PolicyTone {
  if (profile === ':danger-full-access' || policy === 'never') return 'danger'
  if (profile === ':read-only') return 'muted'
  return profile ? 'accent' : approvalPolicyTone(policy)
}
