import type { TFunction } from '@/core/i18n/create'
import type { CommandSectionKey } from './ranking'

/**
 * Header of a section of the `/` list. The Profile section names the session's profile folder
 * (`Profile · ~/.claude-work`), so its skills are visibly those of that profile (#538).
 */
export function sectionTitle(
  key: Exclude<CommandSectionKey, 'results'>,
  t: TFunction,
  profileDir: string | null,
): string {
  if (key === 'profile' && profileDir) return t('autocomplete.section.profileAt', { dir: profileDir })
  return t(`autocomplete.section.${key}`)
}
