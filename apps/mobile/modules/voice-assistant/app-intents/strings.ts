/**
 * Texts of the Siri / Shortcuts intents, per language. The keys are the English texts written in the
 * Swift sources (`{name}` stands for `\(\.$name)` / `\(.applicationName)`; it becomes `{name}` in the catalogs), except `assistant.*`,
 * which have their English text here. `app.config.ts` turns them into `Localizable.xcstrings` and
 * `AppShortcuts.xcstrings` on prebuild; `strings.test.ts` checks them against the Swift sources.
 * Spoken answers come from the app catalogs (`assistant.*` in `src/core/i18n/locales`).
 */
type Texts = { en?: string; 'pt-BR': string; es: string }

export const INTENT_STRINGS: Record<string, Texts> = {
  'Reply to a session': { 'pt-BR': 'Responder a uma sessão', es: 'Responder a una sesión' },
  'Sends a message to a coding session on your computer.': {
    'pt-BR': 'Envia uma mensagem para uma sessão de código no seu computador.',
    es: 'Envía un mensaje a una sesión de código en tu ordenador.',
  },
  Message: { 'pt-BR': 'Mensagem', es: 'Mensaje' },
  'What should I send?': { 'pt-BR': 'O que devo enviar?', es: '¿Qué envío?' },
  Session: { 'pt-BR': 'Sessão', es: 'Sesión' },
  'Send {text} to {session}': {
    'pt-BR': 'Enviar {text} para {session}',
    es: 'Enviar {text} a {session}',
  },
  Answer: { 'pt-BR': 'Resposta', es: 'Respuesta' },
  Allow: { 'pt-BR': 'Permitir', es: 'Permitir' },
  Deny: { 'pt-BR': 'Negar', es: 'Denegar' },
  'Answer the pending permission': {
    'pt-BR': 'Responder à permissão pendente',
    es: 'Responder al permiso pendiente',
  },
  'Allows or denies the oldest permission a session is waiting for.': {
    'pt-BR': 'Permite ou nega a permissão mais antiga que uma sessão está esperando.',
    es: 'Permite o deniega el permiso más antiguo que espera una sesión.',
  },
  'Allow or deny?': { 'pt-BR': 'Permitir ou negar?', es: '¿Permitir o denegar?' },
  '{answer} the pending permission': {
    'pt-BR': '{answer} a permissão pendente',
    es: '{answer} el permiso pendiente',
  },
  'What’s waiting': { 'pt-BR': 'O que está esperando', es: 'Qué está esperando' },
  'Tells which sessions on your computer are waiting for you.': {
    'pt-BR': 'Diz quais sessões no seu computador estão esperando por você.',
    es: 'Dice qué sesiones en tu ordenador te están esperando.',
  },
  'assistant.timeout': {
    en: 'Remote Harness didn’t answer in time. Try again.',
    'pt-BR': 'O Remote Harness não respondeu a tempo. Tente de novo.',
    es: 'Remote Harness no respondió a tiempo. Inténtalo de nuevo.',
  },
  'assistant.openApp': {
    en: 'Open Remote Harness once, then try again.',
    'pt-BR': 'Abra o Remote Harness uma vez e tente de novo.',
    es: 'Abre Remote Harness una vez y vuelve a intentarlo.',
  },
}

/** App Shortcuts phrases (each must name the app). */
export const SHORTCUT_PHRASES: Record<string, Texts> = {
  'Reply in {applicationName}': {
    'pt-BR': 'Responder no {applicationName}',
    es: 'Responder en {applicationName}',
  },
  'Send a message in {applicationName}': {
    'pt-BR': 'Enviar uma mensagem no {applicationName}',
    es: 'Enviar un mensaje en {applicationName}',
  },
  'Answer the permission in {applicationName}': {
    'pt-BR': 'Responder a permissão no {applicationName}',
    es: 'Responder al permiso en {applicationName}',
  },
  'Answer {applicationName}': {
    'pt-BR': 'Responder ao {applicationName}',
    es: 'Responder a {applicationName}',
  },
  'What’s waiting in {applicationName}': {
    'pt-BR': 'O que está esperando no {applicationName}',
    es: 'Qué está esperando en {applicationName}',
  },
  'Check {applicationName}': { 'pt-BR': 'Verificar o {applicationName}', es: 'Revisar {applicationName}' },
}

type StringCatalog = {
  sourceLanguage: 'en'
  version: '1.0'
  strings: Record<
    string,
    { localizations: Record<string, { stringUnit: { state: 'translated'; value: string } }> }
  >
}

/** Folders of the per-language `.strings` files (`<lang>.lproj`), matching the app's languages. */
export const STRINGS_LANGUAGES = ['en', 'pt-BR', 'es'] as const

/**
 * `<lang>.lproj/AppShortcuts.strings`: phrases must use `.strings` below iOS 17 (Xcode rejects
 * `AppShortcuts.xcstrings` for the app's 16.4 deployment target).
 */
export function stringsFile(
  texts: Record<string, Texts>,
  language: (typeof STRINGS_LANGUAGES)[number],
): string {
  const quote = (text: string) =>
    `"${text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\{(\w+)\}/g, (_, name: string) => `$\{${name}}`)}"`
  const lines = Object.keys(texts)
    .sort()
    .map((key) => {
      const text = texts[key]
      const value = language === 'en' ? (text?.en ?? key) : (text?.[language] ?? key)
      return `${quote(key)} = ${quote(value)};`
    })
  return `${lines.join('\n')}\n`
}

/** A String Catalog (`.xcstrings`) with every language of `texts`; Xcode compiles it per language. */
export function stringCatalog(texts: Record<string, Texts>): string {
  const catalog: StringCatalog = { sourceLanguage: 'en', version: '1.0', strings: {} }
  // String Catalogs write App Intents placeholders as `${name}`.
  const placeholders = (text: string) => text.replace(/\{(\w+)\}/g, (_, name: string) => `$\{${name}}`)
  for (const key of Object.keys(texts).sort()) {
    const text = texts[key]
    if (!text) continue
    const unit = (value: string) => ({
      stringUnit: { state: 'translated' as const, value: placeholders(value) },
    })
    catalog.strings[placeholders(key)] = {
      localizations: {
        en: unit(text.en ?? key),
        es: unit(text.es),
        'pt-BR': unit(text['pt-BR']),
      },
    }
  }
  return `${JSON.stringify(catalog, null, 2)}\n`
}
