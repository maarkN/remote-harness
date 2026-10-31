import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { GEMINI_COMMANDS } from '../autocomplete/gemini-commands.ts'
import { oneLine, readSlice } from '../sessions/transcript-meta.ts'
import { extractGeminiMeta, geminiTranscript, isGeminiSessionFile } from '../transcript/gemini-format.ts'
import type { AgentAdapter, ApprovalDialog, TranscriptLocation } from './types.ts'

/** The header line comes first; the first prompt is usually within a few KB. */
const HEAD_BYTES = 64 * 1024
const ID_BYTES = 4 * 1024

async function entries(dir: string): Promise<string[]> {
  return readdir(dir).catch(() => [] as string[])
}

function splitLines(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('{'))
}

/**
 * Session files live in `tmp/<project>/chats/session-<date>T<hh-mm>-<first 8 of the id>.jsonl`;
 * subagents' in a folder per parent session, which is not listed. The full id is in the header.
 */
async function findGeminiTranscripts(configDir: string, cutoffMs: number): Promise<TranscriptLocation[]> {
  const root = join(configDir, 'tmp')
  const files: TranscriptLocation[] = []
  for (const project of await entries(root)) {
    const chats = join(root, project, 'chats')
    for (const name of await entries(chats)) {
      if (!isGeminiSessionFile(name)) continue
      const path = join(chats, name)
      try {
        const info = await stat(path)
        if (!info.isFile() || info.mtimeMs < cutoffMs) continue
        const { id } = extractGeminiMeta(splitLines(await readSlice(path, 'head', ID_BYTES)))
        if (id) files.push({ sessionId: id, path, mtime: info.mtime })
      } catch {
        // removed while scanning
      }
    }
  }
  return files
}

/** Folder from the project's `.project_root`, title from the first prompt. */
async function readGeminiSummary(path: string) {
  const { firstPrompt } = extractGeminiMeta(splitLines(await readSlice(path, 'head', HEAD_BYTES)))
  const root = await readFile(join(dirname(dirname(path)), '.project_root'), 'utf8').catch(() => '')
  return {
    title: firstPrompt ? oneLine(firstPrompt) : null,
    cwd: root.trim() || null,
    permissionMode: null,
    approvalPolicy: null,
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/**
 * Gemini's tool approval dialog. The `Notification` hook announcing it carries the dialog's details
 * (`exec`, `edit`, `mcp`, `info`); `1` picks "Allow once" (always the first option unless the edit
 * is being modified, when the option is missing and the dialog does not count as open) and Escape
 * cancels ("No, suggest changes").
 */
export const geminiApprovalDialog: ApprovalDialog = {
  request(payload) {
    const details =
      typeof payload.details === 'object' && payload.details !== null
        ? (payload.details as Record<string, unknown>)
        : {}
    switch (details.type) {
      case 'exec':
        return { tool: 'exec', input: { command: text(details.command) ?? '' } }
      case 'edit':
        return {
          tool: 'Edit',
          input: {
            file_path: text(details.filePath) ?? text(details.fileName) ?? '',
            old_string: typeof details.originalContent === 'string' ? details.originalContent : '',
            new_string: typeof details.newContent === 'string' ? details.newContent : '',
          },
        }
      case 'mcp':
        return {
          tool: `mcp__${text(details.serverName) ?? 'mcp'}__${text(details.toolName) ?? 'tool'}`,
          input: {},
        }
      case 'info':
        return { tool: 'web_fetch', input: Array.isArray(details.urls) ? { urls: details.urls } : {} }
      default:
        return { tool: text(details.title) ?? 'tool', input: {} }
    }
  },
  isOpen: (screen) => screen.includes('Allow once') && screen.includes('No, suggest changes'),
  allowKeys: ['1'],
  denyKeys: ['Escape'],
}

/** Google Gemini CLI (read from gemini-cli 0.66). */
export const gemini: AgentAdapter = {
  id: 'gemini',
  name: 'Gemini CLI',
  command: 'gemini',
  // GEMINI_CLI_HOME replaces the home folder: the config dir is always `$GEMINI_CLI_HOME/.gemini`.
  configDirEnv: 'GEMINI_CLI_HOME',
  defaultConfigDir: '~/.gemini',
  configDirEnvValue: (configDir) => dirname(configDir),
  acceptsConfigDir: (configDir) => basename(configDir.replace(/\/+$/, '')) === '.gemini',
  resumeArgs: (sessionId) => ['--resume', sessionId],
  // Worktrees need an experimental setting; names have no command.
  worktreeArgs: () => null,
  nameArgs: () => null,
  renameCommand: () => null,
  transcript: geminiTranscript,
  findTranscripts: findGeminiTranscripts,
  readSummary: readGeminiSummary,
  commands: async () => GEMINI_COMMANDS,
  commandsSignature: async () => 'builtin',
  // An Enter within 40 ms of a paste (30 ms of a typed key) becomes a line break; Ctrl+J adds one.
  input: { minEnterDelayMs: 250, newline: { keys: ['C-j'] }, beforeSubmit: [] },
  hooks: { style: 'gemini-hooks', file: (configDir) => join(configDir, 'settings.json') },
  statusLine: false,
  providers: false,
  modes: false,
  presets: null,
  permissionRules: false,
  approvalDialog: geminiApprovalDialog,
  // Headless runs write a session file and fire SessionStart, so there is no one-shot call.
  polish: null,
}
