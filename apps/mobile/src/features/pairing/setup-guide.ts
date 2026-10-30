import type { TFunction } from '@/core/i18n/create'

/**
 * Single install URL of the computer side: curl gets the macOS / Linux / WSL script, PowerShell the
 * Windows one, and a browser a page that shows the right command for its system.
 */
export const INSTALL_URL = 'https://remoteharness.app/install'
export const INSTALL_COMMAND = `curl -fsSL ${INSTALL_URL} | bash`
export const INSTALL_COMMAND_WINDOWS = `irm ${INSTALL_URL} | iex`
export const REPO_URL = 'https://github.com/maarkN/remote-harness'

export type GuideAction =
  | { kind: 'link'; label: string; url: string }
  | { kind: 'share'; label: string; text: string }
  | { kind: 'scan'; label: string }

export type GuideStep = {
  id: StepId
  title: string
  body: string
  /** Shown as a copyable code block. */
  code?: string
  actions: GuideAction[]
}

/** Steps in order; texts come from `setupGuide.steps.<id>` in the catalogs. */
export const SETUP_STEPS = ['install', 'pair'] as const
export type StepId = (typeof SETUP_STEPS)[number]

/**
 * First-run guide for people who installed the app before setting up the computer: install, then
 * pair. `os` is `Platform.OS` (kept for steps that differ per platform).
 */
export function buildSetupGuide(t: TFunction, _os: string): GuideStep[] {
  const text = (id: StepId) => ({
    id,
    title: t(`setupGuide.steps.${id}.title`),
    body: t(`setupGuide.steps.${id}.body`),
  })
  return [
    {
      ...text('install'),
      body: t('setupGuide.steps.install.body', { windows: INSTALL_COMMAND_WINDOWS }),
      code: INSTALL_COMMAND,
      // The link opened on the computer shows the command for its system.
      actions: [{ kind: 'share', label: t('setupGuide.steps.install.action'), text: INSTALL_URL }],
    },
    { ...text('pair'), actions: [{ kind: 'scan', label: t('setupGuide.steps.pair.action') }] },
  ]
}
