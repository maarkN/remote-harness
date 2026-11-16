import { deviceIdOf } from '@remote-harness/protocol'
import * as Device from 'expo-device'
import { router } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native'
import { useConnectionStore, useDaemonClient } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { noiseCrypto } from '@/core/crypto'
import { keyboardBehavior } from '@/core/platform/platform'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Card, Screen, Text } from '@/ui'
import { cleanDeviceName, suggestedDeviceName } from './device-name'

/** The name the step starts with, from what the system says about this device. */
function initialName(): string {
  return suggestedDeviceName({
    os: Platform.OS,
    isPad: Platform.OS === 'ios' && Platform.isPad,
    deviceName: Device.deviceName,
    modelName: Device.modelName,
  })
}

/**
 * Right after pairing (#592): the name the computer lists this device by. Save sends
 * `devices.rename` once the connection is open; Skip keeps the platform default the pairing sent.
 */
export function NameDeviceScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const client = useDaemonClient()
  const status = useConnectionStore((s) => s.status)
  const credentials = useConnectionStore((s) => s.credentials)
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = status === 'open' && client !== null && credentials !== null
  const done = () => router.replace('/')

  const save = () => {
    const clean = cleanDeviceName(name)
    if (!clean) {
      setError(t('devices.nameInvalid'))
      return
    }
    if (!open || !client || !credentials) return
    setBusy(true)
    setError(null)
    const deviceId = deviceIdOf(noiseCrypto, credentials.deviceKey.publicKey)
    client.request({ type: 'devices.rename', deviceId, name: clean }).then(done, (e: unknown) => {
      setBusy(false)
      setError(t('pairing.name.failed', { error: errorMessage(e, t) }))
    })
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={keyboardBehavior(Platform.OS)} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text size="xl" weight="bold" accessibilityRole="header">
            <Text size="xl" weight="bold" color="accentText">
              {'> '}
            </Text>
            {t('pairing.name.title')}
          </Text>
          <Text color="textMuted">{t('pairing.name.body')}</Text>
          <View style={styles.field}>
            <Text size="xs" color="textMuted">
              {t('pairing.name.label')}
            </Text>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text)
                setError(null)
              }}
              accessibilityLabel={t('pairing.name.label')}
              maxLength={64}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={save}
              selectTextOnFocus
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
          </View>
          {open ? null : <Text color="textMuted">{t('pairing.name.connecting')}</Text>}
          {error ? (
            <Card accent={colors.danger}>
              <Text color="danger">{error}</Text>
            </Card>
          ) : null}
          <View style={styles.actions}>
            <Button label={t('pairing.name.skip')} variant="ghost" onPress={done} disabled={busy} />
            <Button
              label={t('pairing.name.save')}
              variant="primary"
              onPress={save}
              loading={busy || !open}
              disabled={busy || !open}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const useStyles = makeStyles((theme) => ({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  field: { gap: space.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
  },
}))
