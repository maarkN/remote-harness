import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { QWEN_COMMANDS } from '../autocomplete/qwen-commands.ts'
import { oneLine, readSlice } from '../sessions/transcript-meta.ts'
import { extractQwenMeta, qwenSessionId, qwenTranscript } from '../transcript/qwen-format.ts'
import type { AgentAdapter, TranscriptLocation } from './types.ts'

const HEAD_BYTES = 64 * 1024
const TAIL_BYTES = 64 * 1024

async function entries(dir: string): Promise<string[]> {
  return readdir(dir).catch(() => [] as string[])
}

function splitLines(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('{'))
}

/** Transcripts live in `projects/<folder with non-alphanumerics as ->/chats/<session id>.jsonl`. */
async function findQwenTranscripts(configDir: string, cutoffMs: number): Promise<TranscriptLocation[]> {
  const root = join(configDir, 'projects')
  const files: TranscriptLocation[] = []
  for (const project of await entries(root)) {
    const chats = join(root, project, 'chats')
    for (const name of await entries(chats)) {
      const sessionId = qwenSessionId(name)
      if (!sessionId) continue
      const path = join(chats, name)
      try {
        const info = await stat(path)
        if (info.isFile() && info.mtimeMs >= cutoffMs) files.push({ sessionId, path, mtime: info.mtime })
      } catch {
        // removed while scanning
      }
    }
  }
  return files
}

/** Title: the latest `custom_title` (`/rename` or the automatic one), else the first typed prompt. */
async function readQwenSummary(path: string) {
  const [head, tail] = await Promise.all([
    readSlice(path, 'head', HEAD_BYTES),
    readSlice(path, 'tail', TAIL_BYTES),
  ])
  const meta = extractQwenMeta(splitLines(head), splitLines(tail))
  const title = meta.title ?? meta.firstPrompt
  return { title: title ? oneLine(title) : null, cwd: meta.cwd, permissionMode: null, approvalPolicy: null }
}

/** Qwen Code (read from qwen-code 0.26), a fork of Gemini CLI with Claude Code-style hooks. */
export const qwen: AgentAdapter = {
  id: 'qwen',
  name: 'Qwen Code',
  command: 'qwen',
  configDirEnv: 'QWEN_HOME',
  defaultConfigDir: '~/.qwen',
  resumeArgs: (sessionId) => ['--resume', sessionId],
  // `--worktree` opens an exit dialog and `/rename` was not tried: neither is offered yet.
  worktreeArgs: () => null,
  nameArgs: () => null,
  renameCommand: () => null,
  transcript: qwenTranscript,
  findTranscripts: findQwenTranscripts,
  readSummary: readQwenSummary,
  commands: async () => QWEN_COMMANDS,
  commandsSignature: async () => 'builtin',
  // Ink takes an Enter right after a paste as part of it; Ctrl+J adds a line.
  input: { minEnterDelayMs: 250, newline: { keys: ['C-j'] }, beforeSubmit: [] },
  hooks: { style: 'qwen-settings', file: (configDir) => join(configDir, 'settings.json') },
  statusLine: false,
  providers: false,
  modes: false,
  presets: null,
  // `updatedPermissions` was not verified: Allow / Deny only, like Codex.
  permissionRules: false,
  approvalDialog: null,
  // Headless runs record a session: no one-shot call yet.
  polish: null,
}
