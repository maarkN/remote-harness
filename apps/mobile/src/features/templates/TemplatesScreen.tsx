import { Plus } from 'lucide-react-native'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView } from 'react-native'
import { makeStyles, space, useTheme } from '@/core/theme'
import { relativeTime } from '@/core/utils/time'
import { Button, Card, EmptyState, Screen, Text } from '@/ui'
import { type PromptTemplate, templatePreview } from './logic'
import { useTemplatesStore } from './store'
import { TemplateEditorSheet } from './TemplateEditorSheet'

/** Settings → Prompt templates: the templates on this device, sorted by title; tap one to edit it. */
export function TemplatesScreen() {
  const { t } = useTranslation()
  const { colors } = useTheme()
  const styles = useStyles()
  const templates = useTemplatesStore((s) => s.templates)
  // The sheet is mounted per edit, so its fields start from the chosen template.
  const [editing, setEditing] = useState<{ template: PromptTemplate | null } | null>(null)
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text size="xs" color="textMuted">
          {t('templates.placeholdersHint')}
        </Text>
        <Button
          label={t('templates.new')}
          variant="primary"
          icon={<Plus size={16} color={colors.accentInk} />}
          onPress={() => setEditing({ template: null })}
        />
        {templates.length === 0 ? (
          <EmptyState title={t('templates.empty')}>
            <Text color="textMuted">{t('templates.emptyHint')}</Text>
          </EmptyState>
        ) : null}
        {templates.map((template) => (
          <Pressable
            key={template.id}
            accessibilityRole="button"
            accessibilityLabel={template.title}
            onPress={() => setEditing({ template })}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Card>
              <Text weight="bold" numberOfLines={1}>
                {template.title}
              </Text>
              <Text size="sm" color="textMuted" numberOfLines={3}>
                {templatePreview(template.text)}
              </Text>
              {template.updatedAt > 0 ? (
                <Text size="xs" color="textDim">
                  {t('templates.updated', {
                    when: relativeTime(new Date(template.updatedAt).toISOString(), t),
                  })}
                </Text>
              ) : null}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
      {editing ? <TemplateEditorSheet template={editing.template} onClose={() => setEditing(null)} /> : null}
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  content: { padding: space.lg, gap: space.md },
  pressed: { opacity: 0.7 },
}))
