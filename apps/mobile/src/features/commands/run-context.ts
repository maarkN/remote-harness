import { createContext, useContext } from 'react'

/** Opens the Run command sheet with a command filled in (#477). */
export type RunCommand = { run: (command: string) => void }

/**
 * Provided by the session screen around the conversation while the computer accepts commands and
 * they are on; `null` otherwise, and the conversation offers no "Run on the computer".
 */
export const RunCommandContext = createContext<RunCommand | null>(null)

export function useRunCommand(): RunCommand | null {
  return useContext(RunCommandContext)
}
