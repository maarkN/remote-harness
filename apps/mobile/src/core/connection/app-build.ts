import type { AppBuild } from '@remote-harness/protocol'

const LIMITS = { version: 32, runtime: 64, update: 64 } as const

const clean = (value: string | null | undefined, limit: number): string | undefined => {
  const text = value?.trim()
  return text ? text.slice(0, limit) : undefined
}

/**
 * The build this app runs, as `auth` sends it (#591): the app version, the runtime version that
 * fingerprints the native build and the OTA update it runs. None without a version.
 */
export function appBuildOf(parts: {
  version?: string | null
  runtimeVersion?: string | null
  updateId?: string | null
}): AppBuild | undefined {
  const version = clean(parts.version, LIMITS.version)
  if (!version) return undefined
  const runtime = clean(parts.runtimeVersion, LIMITS.runtime)
  const update = clean(parts.updateId, LIMITS.update)
  return { version, ...(runtime ? { runtime } : {}), ...(update ? { update } : {}) }
}
