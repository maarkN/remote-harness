/**
 * Whether this build was made for the store screenshots: `REMOTE_HARNESS_SCREENSHOTS=1` at build time
 * makes `app.config.ts` put `screenshots: true` in `extra`. Such a build opens the offline demo by
 * itself and hides the demo banner and card, so the fictional computer looks like a paired one.
 * Builds that ship never set it.
 */
export function screenshotBuild(extra: unknown): boolean {
  if (!extra || typeof extra !== 'object') return false
  return (extra as { screenshots?: unknown }).screenshots === true
}
