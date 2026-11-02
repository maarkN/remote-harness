import { HandsFreeBar } from './HandsFreeBar'
import { useHandsFreeStore } from './store'

/**
 * The composer's place while hands-free is on for the session on screen: the bar, driven by the
 * engine `HandsFreeRunner` runs for the whole app (so leaving the screen does not stop it).
 */
export function HandsFreeSession() {
  const phase = useHandsFreeStore((s) => s.phase)
  const lastSaid = useHandsFreeStore((s) => s.lastSaid)
  const talk = useHandsFreeStore((s) => s.talk)
  const repeat = useHandsFreeStore((s) => s.repeat)
  const stop = useHandsFreeStore((s) => s.stop)
  return <HandsFreeBar phase={phase} lastSaid={lastSaid} onTalk={talk} onRepeat={repeat} onExit={stop} />
}
