import { paths } from '../../core/paths.ts'
import { ensureHookSecret, rotateHookSecret } from '../../core/secrets.ts'
import { readTextFile, writeFileAtomic } from '../../infra/fs.ts'
import { SECRET_HEADER } from '../../transport/hooks-server.ts'

/** curl's config file quoting: inside double quotes only the backslash and the quote itself are escaped. */
function curlQuote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * The curl config (`-K`) that carries the hooks secret. Every `curl` the installer generates reads the
 * header from this 0600 file, so the secret is in no process's arguments (which any local process
 * can read with `ps`); only Claude Code's `http` hooks, read by Claude Code from its own 0600
 * `settings.json`, carry the value itself.
 */
export function renderCurlConfig(secret: string): string {
  return `# Remote Harness: the header that authenticates hooks and the status line with the daemon. Generated; do not edit.
header = ${curlQuote(`${SECRET_HEADER}: ${secret}`)}
`
}

export type HookSecretFiles = {
  secret: string
  /** Path of the curl config, baked into the generated commands. */
  curlConfig: string
  /** The secret was replaced because the installation came from a version that put it on command lines. */
  rotated: boolean
}

type FilePaths = { secret?: string; curlConfig?: string }

/**
 * The hooks secret and the curl config that carries it, for the installer (the daemon only reads the
 * secret). Only the installer writes the config, so a secret without one was written by a version
 * that interpolated it into curl's command line: it is replaced, and the caller rewrites the hooks
 * and the status line with the new value in the same run. A config that does not match the secret
 * is rewritten; matching files are left alone. Both files are 0600.
 */
export async function ensureHookSecretFiles(files: FilePaths = {}): Promise<HookSecretFiles> {
  const secretPath = files.secret ?? paths.hookSecret()
  const curlConfig = files.curlConfig ?? paths.hookCurlConfig()
  const current = await readTextFile(curlConfig)
  const rotated = current === null && Boolean((await readTextFile(secretPath))?.trim())
  const secret = rotated ? await rotateHookSecret(secretPath) : await ensureHookSecret(secretPath)
  const rendered = renderCurlConfig(secret)
  if (current !== rendered) await writeFileAtomic(curlConfig, rendered, 0o600)
  return { secret, curlConfig, rotated }
}

/** Whether the curl config exists and holds the current secret (doctor); false when either file is missing. */
export async function hookCurlConfigMatches(files: FilePaths = {}): Promise<boolean> {
  const secret = (await readTextFile(files.secret ?? paths.hookSecret()))?.trim()
  if (!secret) return false
  return (await readTextFile(files.curlConfig ?? paths.hookCurlConfig())) === renderCurlConfig(secret)
}
