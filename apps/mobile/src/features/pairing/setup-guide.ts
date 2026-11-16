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
  | { kind: 'copy'; label: string; text: string }
  | { kind: 'share'; label: string; text: string }
  | { kind: 'scan'; label: string }

/** The computer's system, chosen at the start of the install step (#564); the command depends on it. */
export const COMPUTER_SYSTEMS = ['macos', 'linux', 'windows'] as const
export type ComputerSystem = (typeof COMPUTER_SYSTEMS)[number]

/** curl on macOS and Linux; PowerShell on Windows, whose installer sets up WSL2 and runs the Linux one in it. */
export function installCommand(system: ComputerSystem): string {
  return system === 'windows' ? INSTALL_COMMAND_WINDOWS : INSTALL_COMMAND
}

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
 * pair. `system` is the computer's, chosen in the install step; until then (`null`) the step only
 * asks for it, with no command.
 */
export function buildSetupGuide(t: TFunction, system: ComputerSystem | null): GuideStep[] {
  const title = (id: StepId) => t(`setupGuide.steps.${id}.title`)
  const command = system ? installCommand(system) : null
  const install: GuideStep = command
    ? {
        id: 'install',
        title: title('install'),
        body: t(
          system === 'windows' ? 'setupGuide.steps.install.bodyWindows' : 'setupGuide.steps.install.body',
        ),
        code: command,
        actions: [
          { kind: 'copy', label: t('setupGuide.steps.install.copy'), text: command },
          { kind: 'share', label: t('setupGuide.steps.install.action'), text: command },
        ],
      }
    : {
        id: 'install',
        title: title('install'),
        body: t('setupGuide.steps.install.chooseSystem'),
        actions: [],
      }
  return [
    install,
    {
      id: 'pair',
      title: title('pair'),
      body: t('setupGuide.steps.pair.body'),
      actions: [{ kind: 'scan', label: t('setupGuide.steps.pair.action') }],
    },
  ]
}
