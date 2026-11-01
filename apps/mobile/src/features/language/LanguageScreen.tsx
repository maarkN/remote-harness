import { getLocales } from 'expo-localization'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, StyleSheet } from 'react-native'
import { previewLanguage, setLanguagePreference, useLanguageStore } from '@/core/i18n'
import { deviceLocale } from '@/core/i18n/device'
import { space } from '@/core/theme'
import { Button, Card, Screen, Text } from '@/ui'
import { LanguageOptionRows } from './LanguageOptionRows'
import { languageOptions } from './options'

/**
 * First-launch step, before the pairing screen: tapping an option previews it on this very screen;
 * Continue saves it (so the step never shows again) and opens pairing.
 */
export function LanguageScreen() {
  const { t } = useTranslation()
  const preference = useLanguageStore((s) => s.preference)
  const [saving, setSaving] = useState(false)
  const rows = languageOptions(preference, deviceLocale(getLocales()), t)

  const onContinue = () => {
    setSaving(true)
    void setLanguagePreference(preference).finally(() => router.replace('/pair'))
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text size="xl" weight="bold">
          <Text size="xl" weight="bold" color="accentText">
            {'> '}
          </Text>
          {t('language.title')}
        </Text>
        <Text color="textMuted">{t('language.intro')}</Text>
        <Card>
          <LanguageOptionRows rows={rows} onPick={previewLanguage} />
        </Card>
        <Text size="sm" color="textMuted">
          {t('language.hint')}
        </Text>
        <Button label={t('language.continue')} variant="primary" loading={saving} onPress={onContinue} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
})
