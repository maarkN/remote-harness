import type { RejectedRequest } from '@remote-harness/protocol'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, Platform, ScrollView, Share, Switch, TextInput, View } from 'react-native'
import { useDaemonClient } from '@/core/connection'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Screen, Text } from '@/ui'
import { bundleReport, type ComputerLog } from '../bundle'
import { currentContext } from '../capture'
import { canSend } from '../consent'
import { clearDraft, useReportDraft } from '../draft-store'
import { buildReport, githubIssueUrl, ISSUES_URL, reportJson } from '../format'
import { recentEntries } from '../log'
import { writeReportFile } from '../storage'
import { useErrorReportsStore } from '../store'
import { readAttachment, uploadReport } from '../upload'
import { AttachmentsSection } from './AttachmentsSection'
import { ReportPreview } from './ReportPreview'

type DaemonDiagnostics = { version: string; errors: RejectedRequest[] }

/** The computer's recent rejected requests; null when not connected or not supported. */
function useDaemonDiagnostics(): DaemonDiagnostics | null {
  const client = useDaemonClient()
  const [diagnostics, setDiagnostics] = useState<DaemonDiagnostics | null>(null)
  useEffect(() => {
    if (!client) return
    let active = true
    client
      .request({ type: 'diagnostics.errors' })
      .then((reply) => {
        if (active && reply.type === 'diagnostics.result')
          setDiagnostics({ version: reply.daemonVersion, errors: reply.errors })
      })
      // Older daemons answer `unknown_type` and offline requests fail: the option stays hidden.
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [client])
  return diagnostics
}

type LogsState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'ready'; files: ComputerLog[] }
  | { status: 'failed' }

/** The computer's scrubbed log files, fetched when the user turns them on (#557). */
function useComputerLogs(include: boolean): LogsState {
  const client = useDaemonClient()
  const [state, setState] = useState<LogsState>({ status: 'off' })
  useEffect(() => {
    if (!include) {
      setState({ status: 'off' })
      return
    }
    if (!client) {
      setState({ status: 'failed' })
      return
    }
    let active = true
    setState({ status: 'loading' })
    client
      .request({ type: 'diagnostics.logs' })
      .then((reply) => {
        if (!active) return
        setState(
          reply.type === 'diagnostics.logs.result'
            ? { status: 'ready', files: reply.files }
            : { status: 'failed' },
        )
      })
      // Older daemons answer `unknown_type`; offline requests fail.
      .catch(() => active && setState({ status: 'failed' }))
    return () => {
      active = false
    }
  }, [client, include])
  return state
}

type SendResult = { status: 'sent'; id: string } | { status: 'failed' } | null

/**
 * Settings → Report a problem (or a shake): description, attachments, the computer's errors and,
 * opt-in, its logs; Send uploads it all as one zip (ADR 0008), Share and the GitHub issue stay.
 */
export function ReportProblemScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const entries = useErrorReportsStore((s) => s.entries)
  const preference = useErrorReportsStore((s) => s.preference)
  const daemon = useDaemonDiagnostics()
  const [description, setDescription] = useState('')
  const [includeComputer, setIncludeComputer] = useState(true)
  const [includeLogs, setIncludeLogs] = useState(false)
  const logs = useComputerLogs(includeLogs)
  const attachments = useReportDraft((s) => s.attachments)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult>(null)
  // The attachments belong to this report only.
  useEffect(() => clearDraft, [])

  const report = useMemo(
    () =>
      buildReport({
        kind: 'manual',
        at: new Date(),
        description,
        context: currentContext(),
        entries: recentEntries(entries),
        daemon: includeComputer ? daemon : null,
      }),
    [description, entries, includeComputer, daemon],
  )
  const json = useMemo(() => reportJson(report), [report])

  const logsReady = !includeLogs || logs.status === 'ready'
  const send = async () => {
    setSending(true)
    try {
      const files = await Promise.all(
        attachments.map(async (attachment) => ({ attachment, bytes: await readAttachment(attachment) })),
      )
      const zip = bundleReport({ report, logs: logs.status === 'ready' ? logs.files : null, files })
      const upload = await uploadReport(zip)
      setResult(upload.ok ? { status: 'sent', id: upload.id } : { status: 'failed' })
    } catch {
      setResult({ status: 'failed' })
    } finally {
      setSending(false)
    }
  }
  const sentId = result?.status === 'sent' ? result.id : undefined

  const share = () => {
    const uri =
      Platform.OS === 'ios' ? writeReportFile(`remote-harness-report-${Date.now()}.json`, json) : null
    void Share.share(uri ? { url: uri } : { message: json }).catch(() => undefined)
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text size="sm">{t('errorReports.problem.description')}</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('errorReports.problem.placeholder')}
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={1000}
          style={styles.input}
        />
        <Text size="xs" color="textMuted">
          {t('errorReports.problem.descriptionHint')}
        </Text>
        {daemon ? (
          <View style={styles.row}>
            <Text size="sm" style={styles.flex}>
              {t('errorReports.problem.includeComputer')}
            </Text>
            <Switch
              value={includeComputer}
              onValueChange={setIncludeComputer}
              accessibilityLabel={t('errorReports.problem.includeComputer')}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
            />
          </View>
        ) : null}
        <AttachmentsSection disabled={sending || result?.status === 'sent'} />
        {daemon ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text size="sm">{t('errorReports.problem.includeLogs')}</Text>
              <Text size="xs" color="textMuted">
                {t('errorReports.problem.includeLogsHint')}
              </Text>
            </View>
            <Switch
              value={includeLogs}
              onValueChange={setIncludeLogs}
              accessibilityLabel={t('errorReports.problem.includeLogs')}
              trackColor={{ true: colors.accent, false: colors.borderStrong }}
            />
          </View>
        ) : null}
        {logs.status === 'loading' ? (
          <Text size="xs" color="textMuted">
            {t('errorReports.problem.logsLoading')}
          </Text>
        ) : null}
        {logs.status === 'failed' ? (
          <Text size="xs" color="warning">
            {t('errorReports.problem.logsUnavailable')}
          </Text>
        ) : null}
        {logs.status === 'ready' ? (
          <ReportPreview
            text={logs.files.map((f) => `== ${f.name} ==\n${f.text}`).join('\n')}
            maxHeight={240}
          />
        ) : null}
        <Text size="xs" color="textMuted">
          {t('errorReports.problem.preview')}
        </Text>
        <ReportPreview text={json} maxHeight={320} />
        {result ? (
          <Text size="sm" color={result.status === 'sent' ? 'success' : 'warning'}>
            {result.status === 'sent'
              ? t('errorReports.problem.sentWithId', { id: result.id })
              : t('errorReports.problem.failed')}
          </Text>
        ) : null}
        <View style={styles.actions}>
          {canSend(preference, true) ? (
            <>
              <Text size="xs" color="textMuted">
                {t('errorReports.problem.sendHint')}
              </Text>
              <Button
                label={t('errorReports.problem.send')}
                variant="primary"
                loading={sending}
                disabled={result?.status === 'sent' || !logsReady}
                onPress={() => void send()}
              />
            </>
          ) : null}
          <Button label={t('errorReports.problem.share')} onPress={share} />
          <Button
            label={t('errorReports.problem.github')}
            variant="ghost"
            onPress={() => void Linking.openURL(githubIssueUrl(report, ISSUES_URL, sentId))}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles((theme) => ({
  content: { padding: space.lg, gap: space.sm },
  input: {
    minHeight: 96,
    textAlignVertical: 'top',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    color: theme.colors.text,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  flex: { flex: 1 },
  actions: { gap: space.sm, marginTop: space.sm },
}))
