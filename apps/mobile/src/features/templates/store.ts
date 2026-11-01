import * as SecureStore from 'expo-secure-store'
import { create } from 'zustand'
import {
  newTemplateId,
  type PromptTemplate,
  parseTemplate,
  parseTemplateIndex,
  serializeTemplate,
  sortTemplates,
  TEMPLATE_INDEX_KEY,
  templateStorageKey,
  upsertTemplate,
} from './logic'

// Prompts the user wrote: encrypted by the Keychain / Keystore and never restored on another device.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}
const ignore = () => undefined

type TemplatesState = { templates: PromptTemplate[]; loaded: boolean }

/** The templates on this device, sorted by title; `persistence` below keeps them in SecureStore. */
export const useTemplatesStore = create<TemplatesState>(() => ({ templates: [], loaded: false }))

/** Writes land one at a time, in order. */
let chain: Promise<void> = Promise.resolve()
function enqueue(write: () => Promise<void>): Promise<void> {
  chain = chain.then(write, write)
  return chain
}

async function writeIndex(): Promise<void> {
  const ids = useTemplatesStore.getState().templates.map((template) => template.id)
  await SecureStore.setItemAsync(TEMPLATE_INDEX_KEY, JSON.stringify(ids), OPTIONS).catch(ignore)
}

/** Loads the saved templates; called once at app start. Edits made meanwhile win. */
export async function restoreTemplates(): Promise<void> {
  const ids = parseTemplateIndex(await SecureStore.getItemAsync(TEMPLATE_INDEX_KEY).catch(() => null))
  const saved: PromptTemplate[] = []
  for (const id of ids) {
    const template = parseTemplate(await SecureStore.getItemAsync(templateStorageKey(id)).catch(() => null))
    if (template) saved.push(template)
  }
  useTemplatesStore.setState((s) => {
    const own = new Set(s.templates.map((template) => template.id))
    return {
      templates: sortTemplates([...saved.filter((template) => !own.has(template.id)), ...s.templates]),
      loaded: true,
    }
  })
}

/** Creates (no `id`) or updates a template and saves it; returns it as saved. */
export function saveTemplate(
  input: { id?: string; title: string; text: string },
  now: number = Date.now(),
): PromptTemplate {
  const template: PromptTemplate = {
    id: input.id ?? newTemplateId(now),
    title: input.title,
    text: input.text,
    updatedAt: now,
  }
  useTemplatesStore.setState((s) => ({ templates: upsertTemplate(s.templates, template) }))
  void enqueue(async () => {
    await SecureStore.setItemAsync(
      templateStorageKey(template.id),
      serializeTemplate(template),
      OPTIONS,
    ).catch(ignore)
    await writeIndex()
  })
  return template
}

export function deleteTemplate(id: string): void {
  useTemplatesStore.setState((s) => ({ templates: s.templates.filter((template) => template.id !== id) }))
  void enqueue(async () => {
    await SecureStore.deleteItemAsync(templateStorageKey(id)).catch(ignore)
    await writeIndex()
  })
}
