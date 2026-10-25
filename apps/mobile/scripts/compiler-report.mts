/**
 * Lists the components and hooks the React Compiler skips (they keep working, just without automatic
 * memoization), so a change can tell whether it made one compile or stop compiling.
 *
 *   pnpm --filter @remote-harness/mobile compiler:report
 *
 * Compiles every file under `src/` with the same compiler babel-preset-expo uses (resolved through
 * `expo`), without bundling.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

type CompilerEvent = {
  kind: string
  fnLoc?: { start?: { line?: number } }
  detail?: { reason?: string; loc?: { start?: { line?: number } }; options?: { reason?: string } }
}
type Babel = { transformSync: (code: string, options: Record<string, unknown>) => unknown }

const APP = join(dirname(fileURLToPath(import.meta.url)), '..')
const fromExpo = createRequire(createRequire(join(APP, 'package.json')).resolve('expo/package.json'))
const fromPreset = createRequire(fromExpo.resolve('babel-preset-expo'))
const babel = fromPreset('@babel/core') as Babel
const compiler = fromPreset.resolve('babel-plugin-react-compiler')
const typescript = fromPreset.resolve('@babel/preset-typescript')

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* sources(path)
    else if (/\.tsx?$/.test(name) && !/\.(test|generated|d)\.ts$/.test(name)) yield path
  }
}

let compiled = 0
const skipped: string[] = []
for (const file of sources(join(APP, 'src'))) {
  babel.transformSync(readFileSync(file, 'utf8'), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [[typescript, { isTSX: true, allExtensions: true }]],
    plugins: [
      [
        compiler,
        {
          target: '19',
          logger: {
            logEvent(_filename: string, event: CompilerEvent) {
              if (event.kind === 'CompileSuccess') compiled++
              else if (event.kind === 'CompileError' || event.kind === 'PipelineError') {
                const line = event.detail?.loc?.start?.line ?? event.fnLoc?.start?.line ?? '?'
                const reason = event.detail?.reason ?? event.detail?.options?.reason ?? event.kind
                skipped.push(`${relative(APP, file)}:${line}  ${reason}`)
              }
            },
          },
        },
      ],
    ],
  })
}

console.log(`Compiled: ${compiled} functions. Skipped: ${skipped.length}.`)
for (const line of [...new Set(skipped)].sort()) console.log(`  ${line}`)
