import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronRight, Keyboard, QrCode, Rocket } from 'lucide-react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { useConnectionStore } from '@/core/connection'
import { keyboardBehavior } from '@/core/platform/platform'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Card, Screen, Text } from '@/ui'
import { type ParsedPairingCode, pairingCodeFromRoute, parsePairingLink } from './parse-pairing-url'
import { usePairing } from './use-pairing'

type Mode = 'scan' | 'manual'

export function PairScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const [permission, requestPermission] = useCameraPermissions()
  const [mode, setMode] = useState<Mode>('scan')
  const { pair, busy, error, setError } = usePairing()
  const pairAgain = useConnectionStore((s) => s.pairAgain)
  const locked = useRef(false)

  /** Pairs with a parsed code, or explains why it cannot be used. */
  const start = useCallback(
    (parsed: ParsedPairingCode, invalid: string) => {
      if (!parsed.ok) {
        setError(parsed.reason === 'legacy' ? t('pairing.legacyCode') : invalid)
        return
      }
      locked.current = true
      void pair(parsed.code).finally(() => {
        locked.current = false
      })
    },
    [pair, setError, t],
  )

  // Opened through a `remoteharness://pair?...` or `claude-remote://pair?...` link (e.g. scanned with
  // the iOS Camera app).
  useEffect(() => {
    const fromLink = pairingCodeFromRoute(params)
    if (fromLink && !locked.current) start(fromLink, t('pairing.invalidQr'))
  }, [params, start, t])

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (locked.current || busy) return
    start(parsePairingLink(data), t('pairing.invalidQr'))
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={keyboardBehavior(Platform.OS)} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text size="xl" weight="bold">
            <Text size="xl" weight="bold" color="accentText">
              {'> '}
            </Text>
            {t('pairing.title')}
          </Text>
          <Text color="textMuted">
            <Trans i18nKey="pairing.intro" components={{ cmd: <Text color="accentText" /> }} />
          </Text>
          {pairAgain ? (
            <Card accent={colors.warning}>
              <Text color="warning">
                <Trans i18nKey="pairing.pairAgain" components={{ cmd: <Text color="accentText" /> }} />
              </Text>
            </Card>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pairing.guideTitle')}
            onPress={() => router.push('/setup-guide')}
          >
            <Card accent={colors.accent}>
              <View style={styles.guide}>
                <Rocket size={20} color={colors.accentText} />
                <View style={styles.flex}>
                  <Text weight="bold">{t('pairing.guideTitle')}</Text>
                  <Text size="sm" color="textMuted">
                    {t('pairing.guideHint')}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>

          <View style={styles.tabs}>
            <Button
              label={t('pairing.tabQr')}
              compact
              flex
              variant={mode === 'scan' ? 'primary' : 'secondary'}
              icon={<QrCode size={16} color={mode === 'scan' ? colors.accentInk : colors.text} />}
              onPress={() => setMode('scan')}
            />
            <Button
              label={t('pairing.tabManual')}
              compact
              flex
              variant={mode === 'manual' ? 'primary' : 'secondary'}
              icon={<Keyboard size={16} color={mode === 'manual' ? colors.accentInk : colors.text} />}
              onPress={() => setMode('manual')}
            />
          </View>

          {mode === 'scan' ? (
            <Scanner
              granted={permission?.granted ?? false}
              canAsk={permission?.canAskAgain ?? true}
              onRequest={() => void requestPermission()}
              onManual={() => setMode('manual')}
              onScanned={onScanned}
              busy={busy}
            />
          ) : (
            <PasteForm
              busy={busy}
              onSubmit={(link) => start(parsePairingLink(link), t('pairing.invalidManual'))}
            />
          )}

          {error ? (
            <Card accent={colors.danger}>
              <Text color="danger">{error}</Text>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function Scanner(props: {
  granted: boolean
  canAsk: boolean
  busy: boolean
  onRequest: () => void
  onManual: () => void
  onScanned: (result: BarcodeScanningResult) => void
}) {
  const { t } = useTranslation()
  const styles = useStyles()
  if (!props.granted) {
    return (
      <Card>
        <View style={styles.gap}>
          <Text color="textMuted">{t('pairing.cameraRationale')}</Text>
          {props.canAsk ? (
            <Button label={t('pairing.allowCamera')} variant="primary" onPress={props.onRequest} />
          ) : (
            <Button label={t('pairing.typeManually')} onPress={props.onManual} />
          )}
        </View>
      </Card>
    )
  }
  return (
    <View style={styles.cameraFrame}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={props.busy ? undefined : props.onScanned}
      />
      <View style={styles.reticle} pointerEvents="none" />
      {props.busy ? (
        <View style={styles.overlay}>
          <Text color="accentText">{t('pairing.connecting')}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** For simulators and phones without a camera: the link `remote-harness pair` prints. */
function PasteForm({ busy, onSubmit }: { busy: boolean; onSubmit: (link: string) => void }) {
  const { t } = useTranslation()
  const styles = useStyles()
  const [link, setLink] = useState('')
  return (
    <Card>
      <View style={styles.gap}>
        <Field
          label={t('pairing.linkLabel')}
          value={link}
          onChangeText={setLink}
          placeholder="remoteharness://pair?v=2&…"
        />
        <Button
          label={t('pairing.connect')}
          variant="primary"
          loading={busy}
          onPress={() => onSubmit(link)}
        />
      </View>
    </Card>
  )
}

function Field(props: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  return (
    <View style={styles.field}>
      <Text size="xs" color="textMuted">
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  flex: { flex: 1 },
  content: { padding: space.lg, gap: space.lg },
  tabs: { flexDirection: 'row', gap: space.sm },
  guide: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gap: { gap: space.md },
  cameraFrame: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
  },
  reticle: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    right: '18%',
    bottom: '18%',
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderRadius: radius.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.backdrop,
  },
  field: { gap: space.xs },
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
