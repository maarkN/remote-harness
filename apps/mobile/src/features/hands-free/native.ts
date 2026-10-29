type SpeechModule = typeof import('expo-speech')
type KeepAwakeModule = typeof import('expo-keep-awake')

/**
 * The speech and keep-awake modules, loaded on first use: binaries built before them (an
 * over-the-air update) throw on import, and then hands-free is simply not offered.
 */
function load<T>(read: () => T): () => T | null {
  let loaded: T | null | undefined
  return () => {
    if (loaded === undefined) {
      try {
        loaded = read()
      } catch {
        loaded = null
      }
    }
    return loaded
  }
}

export const loadSpeech = load<SpeechModule>(() => require('expo-speech') as SpeechModule)
export const loadKeepAwake = load<KeepAwakeModule>(() => require('expo-keep-awake') as KeepAwakeModule)

/** Whether this binary can speak (the session menu only offers hands-free then). */
export function handsFreeSupported(): boolean {
  return loadSpeech() !== null
}
