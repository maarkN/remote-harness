/** What an empty conversation says (#554). */
export type EmptyConversation = 'error' | 'loading' | 'firstPrompt' | 'noMessages'

/**
 * The subscription's error first; "loading" only until the first page arrived; then an invitation
 * to the first prompt when the user can send one, else "no messages yet" (read-only, subagents).
 */
export function emptyConversation(
  stream: { loaded: boolean; error: unknown },
  canPrompt: boolean,
): EmptyConversation {
  if (stream.error != null) return 'error'
  if (!stream.loaded) return 'loading'
  return canPrompt ? 'firstPrompt' : 'noMessages'
}
