import type { PairedDeviceInfo } from '@remote-harness/protocol'
import * as Clipboard from 'expo-clipboard'
import { Pencil, Smartphone, Tablet } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConnectionStore, useDaemonClient } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { keyboardBehavior } from '@/core/platform/platform'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { relativeTime } from '@/core/utils/time'
import { Badge, Button, Card, Text } from '@/ui'
import { cleanDeviceName } from '../pairing/device-name'
import { QrCode } from './QrCode'

type Code = { url: string; expiresAt: string }

/**
 * Settings → Devices: the phones and tablets paired with the active computer, "Add device" (a
 * single-use code shown as a QR), rename (#592) and revoke.
 */
export function DevicesCard() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const client = useDaemonClient()
  const status = useConnectionStore((s) => s.status)
  const [devices, setDevices] = useState<PairedDeviceInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<Code | null>(null)
  const [renaming, setRenaming] = useState<PairedDeviceInfo | null>(null)

  const refresh = useCallback(() => {
    if (!client || status !== 'open') return
    client.request({ type: 'devices.list' }).then(
      (reply) => {
        if (reply.type === 'devices.result') setDevices(reply.devices)
        setError(null)
      },
      (e: unknown) => setError(errorMessage(e, t)),
    )
  }, [client, status, t])

  useEffect(refresh, [refresh])

  const add = () => {
    if (!client) return
    client.request({ type: 'pairing.create' }).then(
      (reply) => {
        if (reply.type === 'pairing.code') setCode({ url: reply.url, expiresAt: reply.expiresAt })
      },
      (e: unknown) => setError(errorMessage(e, t)),
    )
  }

  const revoke = (device: PairedDeviceInfo) => {
    Alert.alert(
      t('devices.revokeTitle', { name: device.name || device.platform }),
      device.current ? t('devices.revokeSelfBody') : t('devices.revokeBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('devices.revoke'),
          style: 'destructive',
          onPress: () => {
            client
              ?.request({ type: 'devices.revoke', deviceId: device.id })
              .then(refresh, (e: unknown) => setError(errorMessage(e, t)))
          },
        },
      ],
    )
  }

  return (
    <Card>
      <View style={layout.gap}>
        <Text weight="bold">{t('devices.title')}</Text>
        {devices === null && status === 'open' ? <Text color="textMuted">{t('devices.loading')}</Text> : null}
        {status !== 'open' ? <Text color="textMuted">{t('devices.offline')}</Text> : null}
        {(devices ?? []).map((device) => {
          const Icon = device.name.toLowerCase().includes('ipad') ? Tablet : Smartphone
          return (
            <View key={device.id} style={layout.row}>
              <Icon size={18} color={colors.textMuted} />
              <View style={layout.flex}>
                <View style={layout.title}>
                  {/* A long name is cut, so the badge never runs into the rename action. */}
                  <Text numberOfLines={1} style={layout.name}>
                    {device.name || device.platform}
                  </Text>
                  {device.current ? <Badge label={t('devices.thisDevice')} tone="success" /> : null}
                </View>
                <Text size="xs" color="textMuted" numberOfLines={1}>
                  {device.lastSeen
                    ? t('devices.lastSeen', { when: relativeTime(device.lastSeen, t) })
                    : t('devices.neverSeen')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('devices.rename')}: ${device.name || device.platform}`}
                hitSlop={8}
                onPress={() => setRenaming(device)}
              >
                <Pencil size={16} color={colors.textMuted} />
              </Pressable>
              <Button label={t('devices.revoke')} variant="ghost" compact onPress={() => revoke(device)} />
            </View>
          )
        })}
        {error ? <Text color="danger">{error}</Text> : null}
        <Button label={t('devices.add')} compact onPress={add} disabled={status !== 'open'} />
      </View>
      <AddDeviceSheet code={code} onClose={() => setCode(null)} />
      <RenameDeviceSheet
        device={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={(list) => {
          setDevices(list)
          setRenaming(null)
        }}
      />
    </Card>
  )
}

/** Edits one device's name and sends `devices.rename`; the reply is the updated list (#592). */
function RenameDeviceSheet(props: {
  device: PairedDeviceInfo | null
  onClose: () => void
  onRenamed: (devices: PairedDeviceInfo[]) => void
}) {
  const { device, onClose, onRenamed } = props
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const client = useDaemonClient()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(device?.name ?? '')
    setError(null)
    setBusy(false)
  }, [device])

  const save = () => {
    if (!device || !client) return
    const clean = cleanDeviceName(name)
    if (!clean) {
      setError(t('devices.nameInvalid'))
      return
    }
    setBusy(true)
    client.request({ type: 'devices.rename', deviceId: device.id, name: clean }).then(
      (reply) => {
        setBusy(false)
        if (reply.type === 'devices.result') onRenamed(reply.devices)
      },
      (e: unknown) => {
        setBusy(false)
        setError(errorMessage(e, t))
      },
    )
  }

  return (
    <Modal visible={device !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={keyboardBehavior(Platform.OS)} style={layout.fill}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
            <Text weight="bold" accessibilityRole="header">
              {t('devices.renameTitle', { name: device?.name || device?.platform || '' })}
            </Text>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text)
                setError(null)
              }}
              accessibilityLabel={t('devices.renameLabel')}
              maxLength={64}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={save}
              selectTextOnFocus
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
            {error ? <Text color="danger">{error}</Text> : null}
            <View style={layout.actions}>
              <Button label={t('common.cancel')} variant="ghost" onPress={onClose} disabled={busy} />
              <Button label={t('devices.save')} variant="primary" onPress={save} loading={busy} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

function AddDeviceSheet({ code, onClose }: { code: Code | null; onClose: () => void }) {
  const { t } = useTranslation()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const minutes = code ? Math.max(1, Math.round((Date.parse(code.expiresAt) - Date.now()) / 60_000)) : 0
  return (
    <Modal visible={code !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text weight="bold" accessibilityRole="header">
            {t('devices.addTitle')}
          </Text>
          <Text size="sm" color="textMuted">
            {t('devices.addBody', { count: minutes })}
          </Text>
          {code ? (
            <View style={styles.qr}>
              <QrCode value={code.url} size={232} />
            </View>
          ) : null}
          {code ? (
            <Text size="xs" color="textMuted" selectable numberOfLines={3}>
              {code.url}
            </Text>
          ) : null}
          <View style={layout.actions}>
            <Button
              label={t('devices.copyLink')}
              variant="ghost"
              onPress={() => code && void Clipboard.setStringAsync(code.url)}
            />
            <Button label={t('common.close')} variant="primary" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const layout = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flexShrink: 1 },
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  fill: { flex: 1 },
})

const useStyles = makeStyles((theme) => ({
  backdrop: { flex: 1, backgroundColor: theme.colors.backdrop, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  qr: { alignItems: 'center', paddingVertical: space.sm },
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
