import { readIniValue, setIniValue } from './ini.ts'

/**
 * WSL2 networking mode from `%UserProfile%\.wslconfig` (`[wsl2] networkingMode`), lowercased.
 * `nat` is the default: devices on the network cannot reach the daemon directly then (the
 * connection relay still does).
 */
export function wslNetworkingMode(wslconfig: string | null): string {
  return readIniValue(wslconfig, 'wsl2', 'networkingMode')?.toLowerCase() || 'nat'
}

/** Merges `[wsl2] networkingMode=mirrored` into `.wslconfig` (unchanged text when already set). */
export function enableMirroredNetworking(wslconfig: string | null): string {
  return setIniValue(wslconfig, 'wsl2', 'networkingMode', 'mirrored')
}

/** `C:\Users\me` from `cmd.exe /c echo %UserProfile%` (last non-empty line); null when not expanded. */
export function parseCmdEcho(stdout: string): string | null {
  const line = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1)
  if (!line || line.includes('%')) return null
  return line
}
