import { HandsFreeBar } from './HandsFreeBar'
import { useHandsFree } from './use-hands-free'

/** The composer's place while hands-free is on: runs the mode for the session and shows the bar. */
export function HandsFreeSession({ sessionId, onExit }: { sessionId: string; onExit(): void }) {
  const handsFree = useHandsFree(sessionId, true, onExit)
  return (
    <HandsFreeBar
      phase={handsFree.phase}
      lastSaid={handsFree.lastSaid}
      onTalk={handsFree.talk}
      onRepeat={handsFree.repeat}
      onExit={onExit}
    />
  )
}
