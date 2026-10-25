import { describe, expect, test } from 'vitest'
import { buildManifest, buildPage } from './ios-link-files'

const app = {
  bundleId: 'com.alvyntech.remoteharness',
  version: '0.6.0',
  build: '7',
  title: 'Remote & Harness',
}

describe('buildManifest', () => {
  test('points at the IPA and escapes the values', () => {
    const manifest = buildManifest(app, 'https://remoteharness.app/app/t/x/RemoteHarness.ipa?v=1&b=2')
    expect(manifest).toContain(
      '<string>https://remoteharness.app/app/t/x/RemoteHarness.ipa?v=1&amp;b=2</string>',
    )
    expect(manifest).toContain('<string>com.alvyntech.remoteharness</string>')
    expect(manifest).toContain('<string>Remote &amp; Harness</string>')
    expect(manifest).toContain('<string>software-package</string>')
  })
})

describe('buildPage', () => {
  test('links to the manifest through itms-services with the URL encoded', () => {
    const page = buildPage(
      app,
      'https://remoteharness.app/app/t/x/manifest.plist?v=1',
      new Date('2026-10-17T12:34:56Z'),
    )
    expect(page).toContain(
      'href="itms-services://?action=download-manifest&amp;url=https%3A%2F%2Fremoteharness.app%2Fapp%2Ft%2Fx%2Fmanifest.plist%3Fv%3D1"',
    )
    expect(page).toContain('0.6.0 (7) · built 2026-10-17 12:34 UTC')
    expect(page).toContain('<h1>Remote &amp; Harness</h1>')
  })
})
