import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { KIMI_COMMANDS } from '../autocomplete/kimi-commands.ts'
import { oneLine, readSlice } from '../sessions/transcript-meta.ts'
import { kimiFirstPrompt, kimiTranscript } from '../transcript/kimi-format.ts'
import type { AgentAdapter, ApprovalDialog, TranscriptLocation } from './types.ts'

const HEAD_BYTES = 64 * 1024
const SESSION_ID = /^[0-9a-f-]{8,}$/i

async function entries(dir: string): Promise<string[]> {
  return readdir(dir).catch(() => [] as string[])
}

function splitLines(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('{'))
}

/** Kimi names a work dir's session folder after the md5 of its absolute path. */
export function workDirHash(cwd: string): string {
  return createHash('md5').update(cwd, 'utf8').digest('hex')
}

/** `sessions/<md5 of the work dir>/<session id>/wire.jsonl` (what Kimi's hooks do not say). */
function kimiTranscriptPath(configDir: string, sessionId: string, cwd: string): string {
  return join(configDir, 'sessions', workDirHash(cwd), sessionId, 'wire.jsonl')
}

async function findKimiTranscripts(configDir: string, cutoffMs: number): Promise<TranscriptLocation[]> {
  const root = join(configDir, 'sessions')
  const files: TranscriptLocation[] = []
  for (const workDir of await entries(root)) {
    for (const sessionId of await entries(join(root, workDir))) {
      if (!SESSION_ID.test(sessionId)) continue
      const path = join(root, workDir, sessionId, 'wire.jsonl')
      try {
        const info = await stat(path)
        if (info.isFile() && info.mtimeMs >= cutoffMs) files.push({ sessionId, path, mtime: info.mtime })
      } catch {
        // no wire file (yet), or removed while scanning
      }
    }
  }
  return files
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The work dir of `kimi.json` whose md5 names the session's parent folder. */
async function workDirOf(configDir: string, hash: string): Promise<string | null> {
  const meta = await readJson(join(configDir, 'kimi.json'))
  const dirs = Array.isArray(meta?.work_dirs) ? meta.work_dirs : []
  for (const dir of dirs) {
    const path = typeof dir === 'object' && dir !== null ? (dir as { path?: unknown }).path : null
    if (typeof path === 'string' && workDirHash(path) === hash) return path
  }
  return null
}

/** Title from `state.json` (`custom_title`, set from the first prompt or `/title`), else the first prompt. */
async function readKimiSummary(path: string, configDir: string) {
  const sessionDir = dirname(path)
  const state = await readJson(join(sessionDir, 'state.json'))
  const custom =
    typeof state?.custom_title === 'string' && state.custom_title.trim() ? state.custom_title : null
  const title = custom ?? kimiFirstPrompt(splitLines(await readSlice(path, 'head', HEAD_BYTES)))
  return {
    title: title ? oneLine(title) : null,
    cwd: await workDirOf(configDir, basename(dirname(sessionDir))),
    permissionMode: null,
    approvalPolicy: null,
  }
}

const REQUEST_LINE = /(\S+) is requesting approval to ([^:\n]+):/
const BORDER = /[│┃╭╮╰╯─━]/g

/** The panel's lines from the request to its first option, without the box drawing. */
function panelLines(screen: string): string[] | null {
  const lines = screen.split('\n').map((line) => line.replace(BORDER, '').trim())
  const start = lines.findIndex((line) => REQUEST_LINE.test(line))
  const end = lines.findIndex((line, i) => i > start && line.includes('[1] Approve once'))
  return start >= 0 && end > start ? lines.slice(start, end).filter(Boolean) : null
}

/**
 * Kimi's approval panel: "<tool> is requesting approval to <action>:", a preview, then `[1] Approve
 * once` … `[3] Reject`. Digits choose at once. No hook announces it, so the daemon reads the pane.
 */
export const kimiApprovalDialog: ApprovalDialog = {
  detect: 'screen',
  request(payload) {
    if (typeof payload.tool_name === 'string') {
      const input =
        typeof payload.tool_input === 'object' && payload.tool_input !== null
          ? (payload.tool_input as Record<string, unknown>)
          : {}
      return { tool: payload.tool_name, input }
    }
    const screen = typeof payload.screen === 'string' ? payload.screen : ''
    const match = REQUEST_LINE.exec(screen)
    return { tool: match?.[1] ?? 'tool', input: match?.[2] ? { description: match[2].trim() } : {} }
  },
  isOpen: (screen) => panelLines(screen) !== null && screen.includes('[3] Reject'),
  identify: (screen) => panelLines(screen)?.join('\n') ?? null,
  allowKeys: ['1'],
  denyKeys: ['3'],
}

/** Moonshot Kimi CLI (read from kimi-cli 1.52). */
export const kimi: AgentAdapter = {
  id: 'kimi',
  name: 'Kimi CLI',
  command: 'kimi',
  configDirEnv: 'KIMI_SHARE_DIR',
  defaultConfigDir: '~/.kimi',
  transcriptPath: kimiTranscriptPath,
  resumeArgs: (sessionId) => ['--session', sessionId],
  worktreeArgs: () => null,
  nameArgs: () => null,
  renameCommand: () => null,
  transcript: kimiTranscript,
  findTranscripts: findKimiTranscripts,
  readSummary: readKimiSummary,
  commands: async () => KIMI_COMMANDS,
  commandsSignature: async () => 'builtin',
  // prompt_toolkit: Ctrl-J adds a line; a stray Esc would cancel a running turn.
  input: { minEnterDelayMs: 100, newline: { keys: ['C-j'] }, beforeSubmit: [] },
  hooks: { style: 'kimi-toml', file: (configDir) => join(configDir, 'config.toml') },
  statusLine: false,
  providers: false,
  modes: false,
  presets: null,
  permissionRules: false,
  approvalDialog: kimiApprovalDialog,
  // `--print` approves every tool call: no one-shot call.
  polish: null,
}
