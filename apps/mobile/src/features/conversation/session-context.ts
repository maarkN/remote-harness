import { createContext } from 'react'

/** The id of the session whose conversation is shown, so items can read the session's own state. */
export const ConversationSession = createContext<string | null>(null)
