/**
 * What a session is doing, as a key of a fixed phrase table ("Running tests…"). The tool input is
 * inspected here and dropped: only the key is kept in the status, and `liveProps` translates it.
 */
export type ActivityKind =
  | 'readingDocs'
  | 'exploring'
  | 'updatingScripts'
  | 'editingCode'
  | 'creatingPdf'
  | 'committing'
  | 'testing'
  | 'building'
  | 'installing'
  | 'command'
  | 'researching'
  | 'delegating'
  | 'planning'
  | 'thinking'
  | 'writing'
  | 'tool'

const DOC_EXTENSIONS = /\.(md|mdx|markdown|txt|rst|adoc)$/i
const SCRIPT_EXTENSIONS = /\.(sh|bash|zsh|fish|ps1)$/i
const SCRIPT_FILES = new Set(['makefile', 'justfile', 'gnumakefile'])
const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])
const PLAN_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate', 'ExitPlanMode'])
const PACKAGE_MANAGERS = new Set(['pnpm', 'npm', 'yarn', 'bun'])
const TEST_RUNNERS = new Set(['vitest', 'jest', 'pytest', 'mocha', 'playwright', 'rspec', 'phpunit', 'ctest'])
const BUILD_TOOLS = new Set([
  'tsc',
  'xcodebuild',
  'gradle',
  'gradlew',
  'webpack',
  'vite',
  'esbuild',
  'rollup',
])
const PDF_TOOLS = new Set([
  'pandoc',
  'wkhtmltopdf',
  'pdflatex',
  'xelatex',
  'typst',
  'weasyprint',
  'qpdf',
  'pdftk',
])
/** Words that run the next one (`sudo make`, `env FOO=1 pnpm`, `npx vitest`). */
const WRAPPERS = new Set(['sudo', 'env', 'time', 'nohup', 'exec', 'command', 'npx', 'pnpx', 'bunx', 'uvx'])

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function segments(path: string): string[] {
  return path.split(/[\\/]+/).filter(Boolean)
}

function fileKind(path: string): 'docs' | 'scripts' | 'pdf' | null {
  const parts = segments(path)
  const name = parts.at(-1)?.toLowerCase() ?? ''
  const dirs = parts.slice(0, -1).map((part) => part.toLowerCase())
  if (name.endsWith('.pdf')) return 'pdf'
  if (SCRIPT_EXTENSIONS.test(name) || SCRIPT_FILES.has(name) || dirs.includes('scripts')) return 'scripts'
  if (DOC_EXTENSIONS.test(name) || dirs.includes('docs') || dirs.includes('doc')) return 'docs'
  return null
}

/** The kind of one shell command: its program, after wrappers and `VAR=value`, and its subcommand. */
function commandKind(segment: string): ActivityKind | null {
  const words = segment.trim().split(/\s+/).filter(Boolean)
  let index = 0
  while (WRAPPERS.has(words[index] ?? '') || /^\w+=/.test(words[index] ?? '')) index++
  const program =
    segments(words[index] ?? '')
      .at(-1)
      ?.toLowerCase() ?? ''
  if (!program || program === 'cd') return null
  // `pnpm run test`, `pnpm --filter x test`: the first word that is not an option or `run`.
  const rest = words.slice(index + 1)
  const sub = rest.find((word, i) => !word.startsWith('-') && word !== 'run' && rest[i - 1] !== '--filter')
  if (program === 'git') {
    return sub === 'commit' || sub === 'push' ? 'committing' : 'command'
  }
  if (program === 'gh') return sub === 'pr' ? 'committing' : 'command'
  if (TEST_RUNNERS.has(program)) return 'testing'
  if (BUILD_TOOLS.has(program)) return 'building'
  if (PDF_TOOLS.has(program)) return 'creatingPdf'
  if (PACKAGE_MANAGERS.has(program) || program === 'turbo') {
    if (sub === 'test' || sub === 'vitest' || sub === 'jest') return 'testing'
    if (sub === 'build' || sub === 'export') return 'building'
    if (sub === 'install' || sub === 'i' || sub === 'add' || sub === 'ci' || (program !== 'turbo' && !sub))
      return 'installing'
    return 'command'
  }
  if (program === 'go' || program === 'cargo' || program === 'swift' || program === 'dotnet') {
    if (sub === 'test') return 'testing'
    if (sub === 'build') return 'building'
    if (sub === 'get' || sub === 'add' || sub === 'install' || sub === 'restore') return 'installing'
    return 'command'
  }
  if (program === 'make') return sub === 'test' || sub === 'check' ? 'testing' : 'building'
  if (program === 'docker') return sub === 'build' ? 'building' : 'command'
  if (program === 'expo') return sub === 'export' || sub === 'prebuild' ? 'building' : 'command'
  if (
    program === 'pip' ||
    program === 'pip3' ||
    program === 'brew' ||
    program === 'pod' ||
    program === 'uv'
  ) {
    return sub === 'install' || sub === 'add' || sub === 'sync' ? 'installing' : 'command'
  }
  return 'command'
}

/** The first meaningful kind of a command line (`cd app && pnpm test` → testing). */
function bashKind(command: string): ActivityKind {
  let fallback: ActivityKind | null = null
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    const kind = commandKind(segment)
    if (kind && kind !== 'command') return kind
    fallback ??= kind
  }
  return fallback ?? 'command'
}

function isDocsHost(url: string): boolean {
  try {
    const parsed = new URL(url)
    return /^(docs?|developer|developers)\./.test(parsed.hostname) || /\/docs?(\/|$)/.test(parsed.pathname)
  } catch {
    return false
  }
}

/** What a tool call is doing, from a fixed table over its name and input. */
export function activityKind(name: string, input: Readonly<Record<string, unknown>>): ActivityKind {
  if (name === 'Read') {
    return fileKind(text(input.file_path)) === 'docs' ? 'readingDocs' : 'exploring'
  }
  if (name === 'Grep' || name === 'Glob' || name === 'LS') return 'exploring'
  if (EDIT_TOOLS.has(name)) {
    const kind = fileKind(text(input.file_path) || text(input.notebook_path))
    return kind === 'pdf' ? 'creatingPdf' : kind === 'scripts' ? 'updatingScripts' : 'editingCode'
  }
  if (name === 'Bash') return bashKind(text(input.command))
  if (name === 'BashOutput') return 'command'
  if (name === 'WebSearch') return 'researching'
  if (name === 'WebFetch') return isDocsHost(text(input.url)) ? 'readingDocs' : 'researching'
  if (name === 'Task' || name === 'Agent') return 'delegating'
  if (PLAN_TOOLS.has(name)) return 'planning'
  return 'tool'
}
