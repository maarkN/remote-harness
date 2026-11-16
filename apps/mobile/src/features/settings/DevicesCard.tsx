import { formatConfirmationCode, type PairedDeviceInfo } from '@remote-harness/protocol'
import * as Clipboard from 'expo-clipboard'
import { Smartphone, Tablet } from 'lucide-react-native'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConnectionStore, useDaemonClient, useDaemonEvent } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { makeStyles, radius, space, useTheme } from '@/core/theme'
import { relativeTime } from '@/core/utils/time'
import { Badge, Button, Card, Text } from '@/ui'
import { QrCode } from './QrCode'

/** `id` names the code in `pairing.progress` (absent from daemons before confirmation codes). */
type Code = { url: string; expiresAt: string; id?: string }
/** What happened to the shown code once a device scanned it (ADR-0009). */
type Progress = { state: 'presented'; code: string } | { state: 'paired' | 'locked' }

/**
 * Settings → Devices: the phones and tablets paired with the active computer, "Add device" (a
 * single-use code shown as a QR) and revoke.
 */
export function DevicesCard() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const client = useDaemonClient()
  const status = useConnectionStore((s) => s.status)
  const [devices, setDevices] = useState<PairedDeviceInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<Code | null>(null)

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
        if (reply.type === 'pairing.code')
          setCode({ url: reply.url, expiresAt: reply.expiresAt, ...(reply.id ? { id: reply.id } : {}) })
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
                  <Text numberOfLines={1}>{device.name || device.platform}</Text>
                  {device.current ? <Badge label={t('devices.thisDevice')} tone="success" /> : null}
                </View>
                <Text size="xs" color="textMuted" numberOfLines={1}>
                  {device.lastSeen
                    ? t('devices.lastSeen', { when: relativeTime(device.lastSeen, t) })
                    : t('devices.neverSeen')}
                </Text>
              </View>
              <Button label={t('devices.revoke')} variant="ghost" compact onPress={() => revoke(device)} />
            </View>
          )
        })}
        {error ? <Text color="danger">{error}</Text> : null}
        <Button label={t('devices.add')} compact onPress={add} disabled={status !== 'open'} />
      </View>
      <AddDeviceSheet code={code} onClose={() => setCode(null)} onPaired={refresh} />
    </Card>
  )
}

function AddDeviceSheet(props: { code: Code | null; onClose: () => void; onPaired: () => void }) {
  const { code, onClose, onPaired } = props
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  // Kept with the code it is about, so a new code starts from its QR again.
  const [latest, setLatest] = useState<{ id: string; progress: Progress } | null>(null)
  const progress = latest && code?.id === latest.id ? latest.progress : null
  const minutes = code ? Math.max(1, Math.round((Date.parse(code.expiresAt) - Date.now()) / 60_000)) : 0

  // The other device scanned this QR: the code to type on it, then how it ended.
  useDaemonEvent('pairing.progress', (message) => {
    if (!code?.id || message.id !== code.id) return
    if (message.state === 'presented' && message.code)
      setLatest({ id: message.id, progress: { state: 'presented', code: message.code } })
    else if (message.state !== 'presented') setLatest({ id: message.id, progress: { state: message.state } })
    if (message.state === 'paired') onPaired()
  })
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
          {progress?.state === 'presented' ? (
            <Card accent={colors.accent}>
              <View style={layout.confirm}>
                <Text weight="bold">{t('devices.confirmTitle')}</Text>
                <Text size="sm" color="textMuted">
                  {t('devices.confirmBody')}
                </Text>
                <Text
                  size="xl"
                  weight="bold"
                  color="accentText"
                  accessibilityLabel={progress.code.split('').join(' ')}
                >
                  {formatConfirmationCode(progress.code)}
                </Text>
              </View>
            </Card>
          ) : null}
          {progress?.state === 'paired' ? <Text color="success">{t('devices.paired')}</Text> : null}
          {progress?.state === 'locked' ? <Text color="danger">{t('devices.locked')}</Text> : null}
          {code && progress === null ? (
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
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
  confirm: { gap: space.xs, alignItems: 'center' },
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
}))
