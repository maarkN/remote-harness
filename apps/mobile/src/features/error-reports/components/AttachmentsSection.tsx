import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import * as ImagePicker from 'expo-image-picker'
import { Camera, Image as ImageIcon, Mic, Music, Pause, Play, Square, Video, X } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Text } from '@/ui'
import { ATTACHMENTS_BUDGET, type Attachment, type AttachmentKind } from '../bundle'
import { addAttachment, removeAttachment, useReportDraft } from '../draft-store'
import { fileSize } from '../upload'

const ICONS: Record<AttachmentKind, typeof Camera> = {
  screenshot: ImageIcon,
  image: ImageIcon,
  video: Video,
  audio: Music,
}

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1)

function fromAsset(asset: ImagePicker.ImagePickerAsset): Attachment {
  const video = asset.type === 'video' || asset.type === 'pairedVideo'
  return {
    kind: video ? 'video' : 'image',
    uri: asset.uri,
    name: asset.fileName ?? asset.uri.split('/').pop() ?? (video ? 'video.mov' : 'photo.jpg'),
    size: asset.fileSize ?? fileSize(asset.uri),
  }
}

/**
 * The report's attachments (#557): the shake's screenshot, photos and videos from the library or the
 * camera, and one audio note; each removable, within the report's budget.
 */
export function AttachmentsSection({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const attachments = useReportDraft((s) => s.attachments)
  const [notice, setNotice] = useState<string | null>(null)
  const total = attachments.reduce((sum, a) => sum + a.size, 0)

  const add = (items: readonly Attachment[]) => {
    setNotice(null)
    for (const item of items) if (!addAttachment(item)) setNotice(t('errorReports.problem.tooLarge'))
  }

  const pick = async (source: 'library' | 'camera') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission.granted) {
          setNotice(t('attachments.errors.cameraDenied'))
          return
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images', 'videos'], quality: 0.8 }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true })
      if (!result.canceled) add(result.assets.map(fromAsset))
    } catch {
      setNotice(t('attachments.errors.loadFailed'))
    }
  }

  return (
    <View style={styles.section}>
      <Text size="sm" weight="bold">
        {t('errorReports.problem.attachments')}
      </Text>
      {attachments.map((attachment) => (
        <AttachmentRow key={attachment.uri} attachment={attachment} disabled={disabled} />
      ))}
      <View style={styles.actions}>
        <Button
          label={t('errorReports.problem.addMedia')}
          icon={<ImageIcon size={16} color={colors.text} />}
          disabled={disabled}
          onPress={() => void pick('library')}
        />
        <Button
          label={t('errorReports.problem.camera')}
          icon={<Camera size={16} color={colors.text} />}
          disabled={disabled}
          onPress={() => void pick('camera')}
        />
      </View>
      {attachments.some((a) => a.kind === 'audio') ? null : (
        <AudioNote disabled={disabled} onRecorded={(item) => add([item])} onNotice={setNotice} />
      )}
      <Text size="xs" color="textMuted">
        {t('errorReports.problem.size', { size: megabytes(total), max: megabytes(ATTACHMENTS_BUDGET) })}
      </Text>
      {notice ? (
        <Text size="xs" color="warning">
          {notice}
        </Text>
      ) : null}
    </View>
  )
}

function AttachmentRow({ attachment, disabled }: { attachment: Attachment; disabled: boolean }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const Icon = ICONS[attachment.kind]
  const label = t(`errorReports.problem.kinds.${attachment.kind}`)
  return (
    <View style={styles.row}>
      <Icon size={16} color={colors.textMuted} />
      <View style={styles.flex}>
        <Text size="sm" numberOfLines={1}>
          {label}
        </Text>
        <Text size="xs" color="textMuted">
          {megabytes(attachment.size)} MB
        </Text>
      </View>
      {attachment.kind === 'audio' ? <PlayButton uri={attachment.uri} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('errorReports.problem.remove', { name: label })}
        disabled={disabled}
        hitSlop={6}
        onPress={() => removeAttachment(attachment.uri)}
        style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
      >
        <X size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  )
}

function PlayButton({ uri }: { uri: string }) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const player = useAudioPlayer(uri)
  const status = useAudioPlayerStatus(player)
  const toggle = () => {
    if (status.playing) {
      player.pause()
      return
    }
    if (status.didJustFinish || status.currentTime >= status.duration) void player.seekTo(0)
    player.play()
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        status.playing ? t('errorReports.problem.pauseAudio') : t('errorReports.problem.playAudio')
      }
      hitSlop={6}
      onPress={toggle}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
    >
      {status.playing ? (
        <Pause size={18} color={colors.accentText} />
      ) : (
        <Play size={18} color={colors.accentText} />
      )}
    </Pressable>
  )
}

/** Record / Stop for the one audio note of a report. */
function AudioNote({
  disabled,
  onRecorded,
  onNotice,
}: {
  disabled: boolean
  onRecorded: (attachment: Attachment) => void
  onNotice: (text: string) => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const state = useAudioRecorderState(recorder)

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync().catch(() => null)
    if (!permission?.granted) {
      onNotice(t('errorReports.problem.micDenied'))
      return
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
    await recorder.prepareToRecordAsync()
    recorder.record()
  }

  const stop = async () => {
    await recorder.stop()
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined)
    const uri = recorder.uri
    if (uri)
      onRecorded({ kind: 'audio', uri, name: uri.split('/').pop() ?? 'audio.m4a', size: fileSize(uri) })
  }

  return state.isRecording ? (
    <Button
      label={t('errorReports.problem.stopRecording', { seconds: Math.round(state.durationMillis / 1000) })}
      icon={<Square size={16} color={colors.accentInk} />}
      variant="primary"
      onPress={() => void stop()}
    />
  ) : (
    <Button
      label={t('errorReports.problem.recordAudio')}
      icon={<Mic size={16} color={colors.text} />}
      disabled={disabled}
      onPress={() => void start().catch(() => onNotice(t('errorReports.problem.micDenied')))}
    />
  )
}

const useStyles = makeStyles((theme) => ({
  section: { gap: space.sm, marginTop: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  flex: { flex: 1 },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
}))
