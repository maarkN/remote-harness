/**
 * Pieces of `make install-ios-link`: the files that let Safari on the iPhone install an IPA (an
 * itms-services manifest and a page linking to it). Pure; used by ios-link.mts (the CLI) and tested
 * with Vitest.
 */

export type AppInfo = { bundleId: string; version: string; build: string; title: string }

const xml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function buildManifest(app: AppInfo, ipaUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${xml(ipaUrl)}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${xml(app.bundleId)}</string>
        <key>bundle-version</key>
        <string>${xml(app.version)}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${xml(app.title)}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
`
}

/** The page to bookmark on the iPhone; its link opens the system install prompt. */
export function buildPage(app: AppInfo, manifestUrl: string, builtAt: Date): string {
  const install = `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`
  const label = `${app.version} (${app.build})`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="cache-control" content="no-cache">
<title>${xml(app.title)} ${xml(label)}</title>
<style>
  body { background: #0D0D0D; color: #E8E6E3; font: 16px ui-monospace, Menlo, monospace; margin: 0; padding: 48px 24px; text-align: center; }
  a { display: inline-block; margin: 32px 0 16px; padding: 16px 32px; border-radius: 12px; background: #D97757; color: #0D0D0D; font-weight: bold; text-decoration: none; }
  p { color: #8A8784; }
</style>
</head>
<body>
<h1>${xml(app.title)}</h1>
<p>${xml(label)} · built ${xml(builtAt.toISOString().replace('T', ' ').slice(0, 16))} UTC</p>
<a href="${xml(install)}">Install</a>
<p>${xml(app.bundleId)}</p>
</body>
</html>
`
}
