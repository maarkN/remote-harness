import { describe, expect, it } from 'vitest'
import packageJson from '../package.json' with { type: 'json' }
import { firebaseDependencies, firebaseModules } from './firebase-linking.cjs'

const modules = ['@react-native-firebase/app', '@react-native-firebase/perf']

describe('firebaseModules', () => {
  it('lists every React Native Firebase dependency of the app, perf included', () => {
    const found = firebaseModules(packageJson)
    expect(found).toContain('@react-native-firebase/app')
    expect(found).toContain('@react-native-firebase/perf')
    expect(found.every((name: string) => name.startsWith('@react-native-firebase/'))).toBe(true)
  })
})

describe('firebaseDependencies', () => {
  it('links everything when both files exist', () => {
    expect(firebaseDependencies(modules, { ios: true, android: true })).toEqual({})
  })

  it('unlinks every module on both platforms without any file', () => {
    expect(firebaseDependencies(modules, { ios: false, android: false })).toEqual({
      '@react-native-firebase/app': { platforms: { ios: null, android: null } },
      '@react-native-firebase/perf': { platforms: { ios: null, android: null } },
    })
  })

  it('only unlinks the platform whose file is missing', () => {
    expect(firebaseDependencies(modules, { ios: true, android: false })).toEqual({
      '@react-native-firebase/app': { platforms: { android: null } },
      '@react-native-firebase/perf': { platforms: { android: null } },
    })
    expect(firebaseDependencies(modules, { ios: false, android: true })).toEqual({
      '@react-native-firebase/app': { platforms: { ios: null } },
      '@react-native-firebase/perf': { platforms: { ios: null } },
    })
  })
})
