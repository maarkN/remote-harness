/**
 * A TanStack Query key for data fetched from a computer: the active computer leads the key, so a
 * switch never shows the previous computer's cached models, projects or suggestions (#555).
 */
export function computerQueryKey(activeId: string | null, key: readonly unknown[]): unknown[] {
  return ['computer', activeId, ...key]
}
