import { getLocales } from 'expo-localization'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { setLanguagePreference, useLanguageStore } from '@/core/i18n'
import { deviceLocale } from '@/core/i18n/device'
import { space } from '@/core/theme'
import { Card, Text } from '@/ui'
import { LanguageOptionRows } from './LanguageOptionRows'
import { languageOptions } from './options'

/** Settings → Language: the same options as the first-launch step, applied at once and saved. */
export function LanguageCard() {
  const { t } = useTranslation()
  const preference = useLanguageStore((s) => s.preference)
  const rows = languageOptions(preference, deviceLocale(getLocales()), t)
  return (
    <Card>
      <View style={styles.gap}>
        <Text weight="bold">{t('language.title')}</Text>
        <LanguageOptionRows rows={rows} onPick={(choice) => void setLanguagePreference(choice)} />
        <Text size="xs" color="textMuted">
          {t('language.hint')}
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
})
