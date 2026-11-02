import {
  SCHEDULE_PROMPT_MAX,
  SCHEDULE_TITLE_MAX,
  type Schedule,
  type ScheduleTarget,
} from '@remote-harness/protocol'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Switch, TextInput, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import { selectProfiles, useConnectionStore, useDaemonClient } from '@/core/connection'
import { errorMessage } from '@/core/connection/error-message'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Chip, Text } from '@/ui'
import { useSessionsStore } from '../sessions/store'
import { TemplatesSheet } from '../templates/TemplatesSheet'
import {
  emptyForm,
  formFrom,
  formToInput,
  type ScheduleForm,
  type ScheduleFormError,
  toggleDay,
  WEEKDAYS,
} from './logic'
import { createSchedule, removeSchedule, updateSchedule } from './store'

type NewTarget = Extract<ScheduleTarget, { kind: 'new' }>

/** Titles of the open sessions that take input, by id (strings, so the selection stays shallow-equal). */
const selectOpenSessions = (s: {
  sessions: Record<string, { id: string; title: string; controllable: boolean; state: string }>
}) =>
  Object.fromEntries(
    Object.values(s.sessions)
      .filter((session) => session.controllable && session.state !== 'ended')
      .map((session) => [session.id, session.title]),
  )

/**
 * The schedule editor (#432): title, prompt (with the templates picker), where it runs (an open
 * session or a new one), when (repeat on weekdays or once), the switch; Save stays disabled while
 * a field is off, with the reason under the form. Delete (existing schedules) asks first.
 */
export function ScheduleEditorForm({
  schedule,
  preset,
  onDone,
  onCancel,
}: {
  schedule: Schedule | null
  /** A new schedule's starting point (the session menu passes its session). */
  preset?: { target?: ScheduleTarget | null }
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const client = useDaemonClient()
  const profiles = useConnectionStore(selectProfiles)
  const openSessions = useSessionsStore(useShallow(selectOpenSessions))
  const [form, setForm] = useState<ScheduleForm>(() => (schedule ? formFrom(schedule) : emptyForm(preset)))
  const initialTarget = form.target
  const [mode, setMode] = useState<'session' | 'new'>(initialTarget?.kind === 'new' ? 'new' : 'session')
  const [sessionId, setSessionId] = useState<string | null>(
    initialTarget?.kind === 'session' ? initialTarget.sessionId : null,
  )
  const [draft, setDraft] = useState<NewTarget>(() =>
    initialTarget?.kind === 'new'
      ? initialTarget
      : { kind: 'new', profileId: profiles[0]?.id ?? '', cwd: '', worktree: false },
  )
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const sessionCwd = useSessionsStore((s) => (sessionId ? (s.sessions[sessionId]?.cwd ?? null) : null))

  const patch = (changes: Partial<ScheduleForm>) => setForm((current) => ({ ...current, ...changes }))
  const target: ScheduleTarget | null =
    mode === 'session'
      ? sessionId
        ? { kind: 'session', sessionId }
        : null
      : draft.profileId && draft.cwd.trim()
        ? { ...draft, cwd: draft.cwd.trim() }
        : null
  const check = formToInput({ ...form, target })
  const error: ScheduleFormError | null = check.ok ? null : check.error

  const save = async () => {
    if (!check.ok || !client) return
    setBusy(true)
    try {
      if (schedule) await updateSchedule(client, schedule.id, check.input)
      else await createSchedule(client, check.input)
      onDone()
    } catch (e) {
      Alert.alert(t('schedules.failed'), errorMessage(e, t))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = () => {
    if (!schedule || !client) return
    Alert.alert(t('schedules.deleteTitle'), t('schedules.deleteBody', { title: schedule.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('schedules.delete'),
        style: 'destructive',
        onPress: () => {
          removeSchedule(client, schedule.id)
            .then(onDone)
            .catch((e: unknown) => Alert.alert(t('schedules.failed'), errorMessage(e, t)))
        },
      },
    ])
  }

  const label = (text: string) => (
    <Text size="xs" color="textMuted">
      {text}
    </Text>
  )
  const sessionIds = Object.keys(openSessions)

  return (
    <View style={styles.form}>
      {label(t('schedules.titleLabel'))}
      <TextInput
        value={form.title}
        onChangeText={(title) => patch({ title })}
        placeholder={t('schedules.titlePlaceholder')}
        placeholderTextColor={colors.textDim}
        maxLength={SCHEDULE_TITLE_MAX}
        returnKeyType="done"
        accessibilityLabel={t('schedules.titleLabel')}
        style={styles.input}
      />

      {label(t('schedules.promptLabel'))}
      <TextInput
        value={form.prompt}
        onChangeText={(prompt) => patch({ prompt })}
        placeholder={t('schedules.promptPlaceholder')}
        placeholderTextColor={colors.textDim}
        multiline
        accessibilityLabel={t('schedules.promptLabel')}
        style={[styles.input, styles.multiline]}
      />
      <View style={styles.row}>
        <Button
          label={t('schedules.useTemplate')}
          variant="ghost"
          compact
          onPress={() => setTemplatesOpen(true)}
        />
      </View>

      {label(t('schedules.targetLabel'))}
      <View style={styles.chips}>
        <Chip
          label={t('schedules.targetSession')}
          selected={mode === 'session'}
          onPress={() => setMode('session')}
        />
        <Chip label={t('schedules.targetNew')} selected={mode === 'new'} onPress={() => setMode('new')} />
      </View>
      {mode === 'session' ? (
        sessionIds.length === 0 ? (
          <Text size="sm" color="textMuted">
            {t('schedules.noSessions')}
          </Text>
        ) : (
          <View style={styles.chips}>
            {sessionIds.map((id) => (
              <Chip
                key={id}
                label={openSessions[id] ?? id}
                selected={sessionId === id}
                onPress={() => setSessionId(id)}
              />
            ))}
          </View>
        )
      ) : (
        <View style={styles.form}>
          {profiles.length > 1 ? (
            <>
              {label(t('schedules.profileLabel'))}
              <View style={styles.chips}>
                {profiles.map((profile) => (
                  <Chip
                    key={profile.id}
                    label={profile.name}
                    selected={draft.profileId === profile.id}
                    onPress={() => setDraft((d) => ({ ...d, profileId: profile.id }))}
                  />
                ))}
              </View>
            </>
          ) : null}
          {label(t('schedules.folderLabel'))}
          <TextInput
            value={draft.cwd}
            onChangeText={(cwd) => setDraft((d) => ({ ...d, cwd }))}
            placeholder={t('schedules.folderPlaceholder')}
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('schedules.folderLabel')}
            style={styles.input}
          />
          <View style={styles.switchRow}>
            <Text size="sm" style={styles.flex}>
              {t('schedules.worktree')}
            </Text>
            <Switch
              value={draft.worktree}
              onValueChange={(worktree) => setDraft((d) => ({ ...d, worktree }))}
              accessibilityLabel={t('schedules.worktree')}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
            />
          </View>
        </View>
      )}

      {label(t('schedules.whenLabel'))}
      <View style={styles.chips}>
        <Chip label={t('schedules.repeat')} selected={form.repeat} onPress={() => patch({ repeat: true })} />
        <Chip label={t('schedules.once')} selected={!form.repeat} onPress={() => patch({ repeat: false })} />
      </View>
      {form.repeat ? (
        <>
          <View style={styles.chips}>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={t(`schedules.days.d${day}`)}
                selected={form.days.includes(day)}
                onPress={() => patch({ days: toggleDay(form.days, day) })}
              />
            ))}
          </View>
          <Text size="xs" color="textDim">
            {t('schedules.daysHint')}
          </Text>
        </>
      ) : (
        <>
          {label(t('schedules.dateLabel'))}
          <TextInput
            value={form.date}
            onChangeText={(date) => patch({ date })}
            placeholder="2026-12-31"
            placeholderTextColor={colors.textDim}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel={t('schedules.dateLabel')}
            style={styles.input}
          />
        </>
      )}
      {label(t('schedules.timeLabel'))}
      <TextInput
        value={form.time}
        onChangeText={(time) => patch({ time })}
        placeholder="09:00"
        placeholderTextColor={colors.textDim}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={t('schedules.timeLabel')}
        style={styles.input}
      />
      <Text size="xs" color="textDim">
        {t('schedules.clockHint')}
      </Text>

      <View style={styles.switchRow}>
        <Text size="sm" style={styles.flex}>
          {t('schedules.enabled')}
        </Text>
        <Switch
          value={form.enabled}
          onValueChange={(enabled) => patch({ enabled })}
          accessibilityLabel={t('schedules.enabled')}
          trackColor={{ true: colors.accent, false: colors.borderStrong }}
        />
      </View>

      {error ? (
        <Text size="xs" color={error === 'promptTooLong' ? 'danger' : 'textDim'}>
          {t(`schedules.errors.${error}`, { max: SCHEDULE_PROMPT_MAX })}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {schedule ? <Button label={t('schedules.delete')} variant="danger" onPress={confirmDelete} /> : null}
        <View style={styles.flex} />
        <Button label={t('common.cancel')} variant="ghost" onPress={onCancel} />
        <Button
          label={t('schedules.save')}
          variant="primary"
          disabled={!check.ok || !client}
          loading={busy}
          onPress={() => void save()}
        />
      </View>

      <TemplatesSheet
        visible={templatesOpen}
        context={{ cwd: mode === 'new' ? draft.cwd.trim() || null : sessionCwd }}
        currentText={form.prompt}
        onPick={(text) => patch({ prompt: form.prompt.trim() ? `${form.prompt.trimEnd()}\n${text}` : text })}
        onClose={() => setTemplatesOpen(false)}
      />
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  form: { gap: space.sm },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
  },
  multiline: { minHeight: 108, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.xs },
  flex: { flex: 1 },
}))
