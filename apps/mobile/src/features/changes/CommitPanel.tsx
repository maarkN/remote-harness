import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Linking, Switch, TextInput, View } from 'react-native'
import { errorMessage } from '@/core/connection/error-message'
import { fontSize, fonts, makeStyles, radius, space, useTheme } from '@/core/theme'
import { Button, Text } from '@/ui'
import { ConfirmRow, ConfirmSheet } from './ConfirmSheet'
import { actionBlocked, branchNameFrom, isProtectedBranch, onDefaultBranch } from './logic'
import { useChangeActions } from './use-change-actions'
import type { ChangesState } from './use-changes'

/** Files listed in the commit confirmation before "and n more". */
const LISTED_FILES = 8

type Sheet = 'commit' | 'push' | 'pr' | null

/**
 * The commit message with Generate, and Commit / Push / Open PR. Each action opens a confirmation
 * with what it touches; all three wait while the agent works, unless the user chooses "Do it anyway".
 */
export function CommitPanel({
  sessionId,
  changes,
  paths,
  state,
  onDone,
}: {
  sessionId: string
  changes: ChangesState
  paths: string[]
  state: string | undefined
  onDone: () => void
}) {
  const { t } = useTranslation()
  const styles = useStyles()
  const { colors } = useTheme()
  const actions = useChangeActions(sessionId)
  const [message, setMessage] = useState('')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [forced, setForced] = useState(false)
  const [newBranchOn, setNewBranchOn] = useState(true)
  const [newBranch, setNewBranch] = useState('')
  const [prTitle, setPrTitle] = useState('')
  const [prBody, setPrBody] = useState('')

  const blocked = actionBlocked(state, forced)
  const force = state === 'running' && forced
  const branch = changes.branch
  const remote = changes.remote
  const offerBranch = onDefaultBranch(branch, changes.defaultBranch)
  const failed = (error: unknown) =>
    Alert.alert(t('changes.failed'), errorMessage(error, t, { session_busy: t('changes.waitAgent') }))

  const generate = (kind: 'commit' | 'pr') => {
    actions.generate(kind, kind === 'commit' ? paths : undefined).then(
      (reply) => {
        if (kind === 'commit') setMessage(reply.body ? `${reply.title}\n\n${reply.body}` : reply.title)
        else {
          setPrTitle(reply.title)
          setPrBody(reply.body)
        }
      },
      (error: unknown) =>
        Alert.alert(t('changes.failed'), errorMessage(error, t, { not_found: t('changes.cannotGenerate') })),
    )
  }

  const openCommit = () => {
    setNewBranch(branchNameFrom(message))
    setNewBranchOn(offerBranch)
    setSheet('commit')
  }

  const openPr = () => {
    if (!prTitle) setPrTitle((message.split('\n')[0] ?? '').trim())
    setSheet('pr')
  }

  const commit = () => {
    const branchName = offerBranch && newBranchOn ? newBranch.trim() : undefined
    actions
      .commit({ paths, message, ...(branchName ? { newBranch: branchName } : {}), force })
      .then((reply) => {
        setSheet(null)
        setMessage('')
        onDone()
        Alert.alert(t('changes.committed', { commit: reply.commit, branch: reply.branch ?? '' }))
      }, failed)
  }

  const push = () => {
    actions.push(force).then((reply) => {
      setSheet(null)
      onDone()
      const compare = reply.compareUrl
      if (compare && !changes.gh)
        Alert.alert(t('changes.pushed', { branch: reply.branch }), undefined, [
          { text: t('common.close'), style: 'cancel' },
          { text: t('changes.openCompare'), onPress: () => void Linking.openURL(compare) },
        ])
      else Alert.alert(t('changes.pushed', { branch: reply.branch }))
    }, failed)
  }

  const pr = () => {
    actions.pr({ title: prTitle, body: prBody, force }).then((reply) => {
      setSheet(null)
      onDone()
      Alert.alert(t('changes.prOpened'), reply.url, [
        { text: t('common.close'), style: 'cancel' },
        { text: t('changes.openLink'), onPress: () => void Linking.openURL(reply.url) },
      ])
    }, failed)
  }

  const doItAnyway = () =>
    Alert.alert(t('changes.doItAnywayTitle'), t('changes.doItAnywayBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('changes.doItAnyway'), style: 'destructive', onPress: () => setForced(true) },
    ])

  const inputStyle = [styles.input, { color: colors.text }]
  const remoteLabel = remote ?? t('changes.noRemote')
  const protectedWarning = isProtectedBranch(branch) ? (
    <Text size="xs" color="warning">
      {t('changes.protectedWarning', { branch })}
    </Text>
  ) : null

  return (
    <View style={styles.panel}>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={t('changes.messagePlaceholder')}
        placeholderTextColor={colors.textDim}
        accessibilityLabel={t('changes.messageLabel')}
        multiline
        style={inputStyle}
      />
      <View style={styles.buttons}>
        <Button
          label={actions.busy === 'generate' ? t('changes.generating') : t('changes.generate')}
          variant="ghost"
          compact
          disabled={paths.length === 0 || actions.busy !== null}
          onPress={() => generate('commit')}
        />
        <Button
          label={t('changes.commit', { count: paths.length })}
          variant="primary"
          compact
          disabled={blocked || paths.length === 0 || !message.trim() || actions.busy !== null}
          onPress={openCommit}
        />
      </View>
      <View style={styles.buttons}>
        <Text size="xs" color="textMuted" style={styles.flex}>
          {t('changes.unpushed', { count: changes.unpushed })}
        </Text>
        <Button
          label={t('changes.push')}
          variant="secondary"
          compact
          disabled={blocked || !branch || !remote || actions.busy !== null}
          onPress={() => setSheet('push')}
        />
        <Button
          label={changes.gh ? t('changes.openPr') : t('changes.pushCompare')}
          variant="secondary"
          compact
          disabled={blocked || !branch || !remote || actions.busy !== null}
          onPress={changes.gh ? openPr : () => setSheet('push')}
        />
      </View>
      {state === 'running' ? (
        <View style={styles.buttons}>
          <Text size="xs" color="warning" style={styles.flex}>
            {forced ? t('changes.forced') : t('changes.waitAgent')}
          </Text>
          {forced ? null : (
            <Button label={t('changes.doItAnyway')} variant="ghost" compact onPress={doItAnyway} />
          )}
        </View>
      ) : null}

      <ConfirmSheet
        visible={sheet === 'commit'}
        title={t('changes.confirmCommit')}
        confirmLabel={t('changes.commit', { count: paths.length })}
        confirmDisabled={offerBranch && newBranchOn && !newBranch.trim()}
        busy={actions.busy === 'commit'}
        onConfirm={commit}
        onClose={() => setSheet(null)}
      >
        <Text size="sm" numberOfLines={3}>
          {message.split('\n')[0]}
        </Text>
        {paths.slice(0, LISTED_FILES).map((path) => (
          <Text key={path} size="xs" color="textMuted" numberOfLines={1}>
            {path}
          </Text>
        ))}
        {paths.length > LISTED_FILES ? (
          <Text size="xs" color="textDim">
            {t('changes.moreFiles', { count: paths.length - LISTED_FILES })}
          </Text>
        ) : null}
        <ConfirmRow label={t('changes.branch')} value={branch ?? t('changes.detached')} />
        <ConfirmRow label={t('changes.remote')} value={remoteLabel} />
        {offerBranch ? (
          <View style={styles.branchBox}>
            <View style={styles.buttons}>
              <Text size="sm" style={styles.flex}>
                {t('changes.newBranchFirst', { branch })}
              </Text>
              <Switch value={newBranchOn} onValueChange={setNewBranchOn} />
            </View>
            {newBranchOn ? (
              <TextInput
                value={newBranch}
                onChangeText={setNewBranch}
                accessibilityLabel={t('changes.newBranchName')}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                style={inputStyle}
              />
            ) : null}
          </View>
        ) : null}
      </ConfirmSheet>

      <ConfirmSheet
        visible={sheet === 'push'}
        title={changes.gh ? t('changes.confirmPush') : t('changes.confirmPushCompare')}
        confirmLabel={t('changes.push')}
        busy={actions.busy === 'push'}
        onConfirm={push}
        onClose={() => setSheet(null)}
      >
        <ConfirmRow label={t('changes.branch')} value={branch ?? ''} />
        <ConfirmRow label={t('changes.remote')} value={remoteLabel} />
        <Text size="xs" color="textMuted">
          {t('changes.unpushed', { count: changes.unpushed })}
        </Text>
        {protectedWarning}
      </ConfirmSheet>

      <ConfirmSheet
        visible={sheet === 'pr'}
        title={t('changes.confirmPr')}
        confirmLabel={t('changes.openPr')}
        confirmDisabled={!prTitle.trim()}
        busy={actions.busy === 'pr'}
        onConfirm={pr}
        onClose={() => setSheet(null)}
      >
        <ConfirmRow label={t('changes.branch')} value={branch ?? ''} />
        <ConfirmRow label={t('changes.base')} value={changes.defaultBranch ?? t('changes.ghDefault')} />
        <ConfirmRow label={t('changes.remote')} value={remoteLabel} />
        {protectedWarning}
        <TextInput
          value={prTitle}
          onChangeText={setPrTitle}
          placeholder={t('changes.prTitlePlaceholder')}
          placeholderTextColor={colors.textDim}
          accessibilityLabel={t('changes.prTitlePlaceholder')}
          style={inputStyle}
        />
        <TextInput
          value={prBody}
          onChangeText={setPrBody}
          placeholder={t('changes.prBodyPlaceholder')}
          placeholderTextColor={colors.textDim}
          accessibilityLabel={t('changes.prBodyPlaceholder')}
          multiline
          style={[inputStyle, styles.body]}
        />
        <Button
          label={actions.busy === 'generate' ? t('changes.generating') : t('changes.generate')}
          variant="ghost"
          compact
          disabled={actions.busy !== null}
          onPress={() => generate('pr')}
        />
      </ConfirmSheet>
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  panel: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  input: {
    minHeight: 40,
    maxHeight: 140,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    fontFamily: fonts.regular,
    fontSize: fontSize.md,
  },
  body: { minHeight: 100 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm },
  branchBox: { gap: space.xs, paddingTop: space.xs },
  flex: { flex: 1 },
}))
