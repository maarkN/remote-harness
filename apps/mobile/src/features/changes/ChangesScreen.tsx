import type { ChangedFile } from '@remote-harness/protocol'
import { ChevronDown, ChevronRight, Square, SquareCheck } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, RefreshControl, View } from 'react-native'
import { makeStyles, space, useTheme } from '@/core/theme'
import { shortPath } from '@/core/utils/time'
import { DiffView } from '@/features/conversation/components/DiffView'
import { useSessionsStore } from '@/features/sessions/store'
import { Badge, type BadgeTone, Button, Screen, Text } from '@/ui'
import { CommitPanel } from './CommitPanel'
import { changeTotals, STATUS_LETTER, selectedPaths, startsCollapsed, unifiedDiffLines } from './logic'
import { type FileDiff, useChanges } from './use-changes'

const STATUS_TONE: Record<ChangedFile['status'], BadgeTone> = {
  added: 'success',
  modified: 'warning',
  deleted: 'danger',
  renamed: 'info',
}

/** The session's working tree against `HEAD`: files with counts, each diff loaded when expanded. */
export function ChangesScreen({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const styles = useStyles()
  const { colors } = useTheme()
  const { changes, diffs, supported, error, refreshing, refresh, loadDiff } = useChanges(sessionId)
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  // Files left out of the next commit; everything else (new files too) is selected.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())
  const state = useSessionsStore((s) => s.sessions[sessionId]?.state)
  const files = changes?.files ?? []
  const totals = changeTotals(files)
  const paths = selectedPaths(files, excluded)
  const toggleSelected = (path: string) =>
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const header = (
    <View style={styles.header}>
      {!supported ? <Text color="textMuted">{t('changes.unsupported')}</Text> : null}
      {error ? <Text color="danger">{error}</Text> : null}
      {supported && changes === null && !error ? <Text color="textMuted">{t('changes.loading')}</Text> : null}
      {changes && changes.root === null ? <Text color="textMuted">{t('changes.notGit')}</Text> : null}
      {changes?.root ? (
        <>
          <Text size="xs" color="textMuted" numberOfLines={1}>
            {[changes.branch ?? t('changes.detached'), shortPath(changes.root)].join(' · ')}
          </Text>
          <Text size="sm">
            {files.length === 0
              ? t('changes.clean')
              : t('changes.summary', { count: totals.files, added: totals.added, deleted: totals.deleted })}
          </Text>
          {files.length > 0 || changes.unpushed > 0 ? (
            <CommitPanel
              sessionId={sessionId}
              changes={changes}
              paths={paths}
              state={state}
              onDone={() => {
                setExcluded(new Set())
                void refresh()
              }}
            />
          ) : null}
        </>
      ) : null}
    </View>
  )

  return (
    <Screen>
      <FlatList
        data={files}
        keyExtractor={(f) => f.path}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing && changes !== null}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
          />
        }
        renderItem={({ item }) => {
          const expanded = toggled[item.path] ?? !startsCollapsed(item)
          return (
            <FileRow
              file={item}
              expanded={expanded}
              selected={!excluded.has(item.path)}
              onSelect={() => toggleSelected(item.path)}
              diff={diffs[item.path]}
              onToggle={() => setToggled((s) => ({ ...s, [item.path]: !expanded }))}
              onLoad={(more) => void loadDiff(item.path, more)}
            />
          )
        }}
      />
    </Screen>
  )
}

function FileRow({
  file,
  expanded,
  selected,
  onSelect,
  diff,
  onToggle,
  onLoad,
}: {
  file: ChangedFile
  expanded: boolean
  selected: boolean
  onSelect: () => void
  diff: FileDiff | undefined
  onToggle: () => void
  onLoad: (more: boolean) => void
}) {
  const { t } = useTranslation()
  const styles = useStyles()
  const { colors } = useTheme()
  const canExpand = !file.binary

  // Loaded when the row is shown expanded (the list renders rows as they scroll in).
  useEffect(() => {
    if (expanded && canExpand && !diff) onLoad(false)
  }, [expanded, canExpand, diff, onLoad])

  const Chevron = expanded ? ChevronDown : ChevronRight
  const lines = diff ? unifiedDiffLines(diff.lines) : []
  const rest = diff ? diff.total - diff.lines.length : 0
  return (
    <View style={styles.file}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        disabled={!canExpand}
        onPress={onToggle}
        style={({ pressed }) => [styles.fileHeader, pressed && styles.pressed]}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={t('changes.includeFile', { path: file.path })}
          hitSlop={8}
          onPress={onSelect}
        >
          {selected ? (
            <SquareCheck size={18} color={colors.accentText} />
          ) : (
            <Square size={18} color={colors.textDim} />
          )}
        </Pressable>
        {canExpand ? <Chevron size={14} color={colors.textDim} /> : <View style={styles.chevronSpace} />}
        <Badge label={STATUS_LETTER[file.status]} tone={STATUS_TONE[file.status]} />
        <View style={styles.flex}>
          <Text size="sm" numberOfLines={2}>
            {file.path}
          </Text>
          {file.oldPath ? (
            <Text size="xs" color="textDim" numberOfLines={1}>
              {t('changes.renamedFrom', { path: file.oldPath })}
            </Text>
          ) : null}
          {file.generated ? (
            <Text size="xs" color="textDim">
              {t('changes.generated')}
            </Text>
          ) : null}
        </View>
        {file.binary ? (
          <Text size="xs" color="textMuted">
            {t('changes.binary')}
          </Text>
        ) : (
          <Counts added={file.added} deleted={file.deleted} />
        )}
      </Pressable>
      {expanded && canExpand ? (
        <View style={styles.diff}>
          {diff?.error ? <Text color="danger">{diff.error}</Text> : null}
          {diff && !diff.loading && lines.length === 0 && !diff.error ? (
            <Text size="xs" color="textMuted">
              {t('changes.noContentChange')}
            </Text>
          ) : null}
          {lines.length > 0 ? <DiffView lines={lines} /> : null}
          {diff?.loading ? (
            <Text size="xs" color="textMuted">
              {t('changes.loading')}
            </Text>
          ) : null}
          {diff && !diff.loading && rest > 0 ? (
            <Button
              label={t('changes.showRest', { count: rest })}
              variant="ghost"
              compact
              onPress={() => onLoad(true)}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function Counts({ added, deleted }: { added: number | null; deleted: number | null }) {
  if (added === null || deleted === null) return null
  return (
    <Text size="xs">
      <Text size="xs" color="success">{`+${added}`}</Text>{' '}
      <Text size="xs" color="danger">{`−${deleted}`}</Text>
    </Text>
  )
}

const useStyles = makeStyles((theme) => ({
  content: { padding: space.lg, gap: space.sm },
  header: { gap: space.xs, paddingBottom: space.sm },
  file: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  chevronSpace: { width: 14 },
  pressed: { opacity: 0.7 },
  flex: { flex: 1, gap: 2 },
  diff: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: space.xs },
}))
