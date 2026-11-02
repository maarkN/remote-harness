import type { Locale } from '@remote-harness/protocol'

/**
 * Store listing texts (App Store Connect and Google Play) in the three languages. en-US is the
 * reference shape; `scripts/store-metadata.mts` writes them in fastlane's layout and
 * `scripts/store-metadata.test.ts` enforces the stores' limits. Agent-neutral copy, product names
 * untranslated, no private project named.
 *
 * The description and the release notes come in an App Store (`ios`) and a Google Play (`android`)
 * variant: Apple's guideline 2.3.10 forbids naming other mobile platforms in App Store metadata, and
 * each store gets its own wording for the voice assistant, the live status and the tablet layout.
 * Both variants are built from the same parts, so a sentence that applies to both is written once.
 */

export type Platform = 'ios' | 'android'

/** A text with an App Store and a Google Play variant. */
export type PlatformText = Record<Platform, string>

export type StoreListing = {
  /** App Store name and Play title. */
  name: string
  /** App Store subtitle. */
  subtitle: string
  /** Play short description. */
  shortDescription: string
  /** App Store description (`ios`) and Play full description (`android`). */
  description: PlatformText
  /** App Store keywords; joined with commas on output. */
  keywords: string[]
  /** App Store promotional text (editable without a new build). */
  promotionalText: string
  /** What's new on the App Store (`ios`) and the Play changelog (`android`), 500 characters each. */
  releaseNotes: PlatformText
  supportUrl: string
  marketingUrl: string
  privacyUrl: string
}

/** Character limits of the stores, checked by the tests. */
export const STORE_LIMITS = {
  name: 30,
  subtitle: 30,
  shortDescription: 80,
  description: 4000,
  keywords: 100,
  promotionalText: 170,
  releaseNotes: 500,
} as const

/** The parts of a description; a part given per platform is picked for each store. */
type DescriptionParts = {
  intro: PlatformText
  heading: string
  bullets: Array<string | PlatformText>
  how: string
  privacy: string
}

function buildDescription(parts: DescriptionParts): PlatformText {
  const build = (platform: Platform): string =>
    [
      parts.intro[platform],
      '',
      parts.heading,
      ...parts.bullets.map((bullet) => (typeof bullet === 'string' ? bullet : bullet[platform])),
      '',
      parts.how,
      '',
      parts.privacy,
    ].join('\n')
  return { ios: build('ios'), android: build('android') }
}

const introEn = (device: string): string =>
  `Remote Harness lets you follow and drive the coding agents on your own computer from your ${device}: Claude Code and Codex sessions running in tmux, from anywhere. No account, and everything is encrypted end to end between the phone and the computer: nothing in between can read your sessions.`

const enUS: StoreListing = {
  name: 'Remote Harness',
  subtitle: 'Coding agents from your phone',
  shortDescription: 'Follow and drive Claude Code and Codex on your computer, from your phone.',
  description: buildDescription({
    intro: { ios: introEn('iPhone or iPad'), android: introEn('phone or tablet') },
    heading: 'WHAT YOU CAN DO',
    bullets: [
      '• See every session of every profile in one list, compact or expanded, with the ones waiting for you on top.',
      '• Read the conversation as it happens: Markdown, thinking, tool calls, diffs, images. Conversations you opened stay readable on the phone, encrypted, even when the computer is out of reach.',
      '• Answer permission requests: allow, deny or always allow, with the rule written by the agent itself and every answer in an approval log.',
      '• Send the next prompt, queue follow-ups while the agent works, attach photos and keep a draft per session.',
      {
        ios: '• Dictate on the device for as long as you need, switch to hands-free to hear answers and permissions read aloud and reply by voice, or reply through Siri.',
        android:
          '• Dictate on the device for as long as you need, switch to hands-free to hear answers and permissions read aloud and reply by voice, or reply through Google Assistant.',
      },
      "• Run a shell command in the session's folder and add its output to the prompt (off until you turn it on on the computer).",
      '• Start sessions in any folder, optionally in a git worktree; resume, rename and close them.',
      '• Open the raw terminal with a key bar for Esc, Ctrl+C, arrows and Tab.',
      '• Follow subagents, background tasks, the model, the context window and your usage limits.',
      {
        ios: '• Keep an eye on a session from the Lock Screen and the Dynamic Island with the live status, and from Home Screen and Lock Screen widgets, Allow and Deny included.',
        android:
          '• Keep an eye on a session from a notification with the live status, and from home screen widgets, Allow and Deny included.',
      },
      '• Route a profile through OpenRouter and pick the model from the phone.',
      {
        ios: '• Five themes, an iPad layout with a sidebar and inspector, hardware keyboard shortcuts, and English, Portuguese and Spanish.',
        android:
          '• Five themes, a tablet layout with a sidebar and inspector, hardware keyboard shortcuts, and English, Portuguese and Spanish.',
      },
    ],
    how: `HOW IT WORKS
A small daemon on your macOS, Linux or Windows (WSL2) computer, or on a cloud server, bridges the agents' own hooks and tmux to the phone: directly on your network, or through an end-to-end encrypted connection relay when you are away (you can host your own). One command installs it: curl -fsSL https://remoteharness.app/install | bash. Scan the QR code it shows, and you are paired.`,
    privacy: `PRIVACY
Your sessions stay on your devices: the relay only forwards encrypted traffic it cannot read. Push notifications carry a title, the profile and the session; the live status adds the session's title, folder and current step, never the conversation. No account and no analytics; error reports and performance data only if you opt in, never with your sessions. Privacy policy: remoteharness.app/privacy. The code is open source (MIT) at github.com/maarkN/remote-harness; the documentation lives at remoteharness.app/docs.

REQUIREMENTS
Claude Code or Codex on the computer (the installer adds tmux, git and ripgrep if they are missing).

Remote Harness is an independent project, not affiliated with Anthropic or OpenAI. "Claude" and "Claude Code" are trademarks of Anthropic, PBC; "Codex" is a trademark of OpenAI.`,
  }),
  keywords: [
    'claude code',
    'codex',
    'vibe coding',
    'ai agent',
    'cli',
    'tmux',
    'ssh',
    'terminal',
    'remote',
    'developer',
    'permissions',
    'encrypted',
  ],
  promotionalText:
    'Claude Code and Codex on your own computer, driven from your phone: approve permissions, send prompts, read every step. End-to-end encrypted, no account.',
  releaseNotes: {
    ios: 'First release on the App Store. Follow and drive the coding agents on your own computer from your iPhone or iPad: Claude Code, Codex, Gemini CLI, Kimi CLI and Qwen Code sessions in tmux, from anywhere. Read the conversation as it happens, answer permission requests, send the next prompt, dictate or go hands-free, start sessions with a first prompt or a template, and keep an eye on them from the Lock Screen and the widgets. No account; encrypted end to end between the phone and the computer.',
    android:
      'First release on Google Play. Follow and drive the coding agents on your own computer from your phone: Claude Code, Codex, Gemini CLI, Kimi CLI and Qwen Code sessions in tmux, from anywhere. Read the conversation as it happens, answer permission requests, send the next prompt, dictate or go hands-free, start sessions with a first prompt or a template, and keep an eye on them from the live notification and home screen widgets. No account; encrypted end to end between the phone and the computer.',
  },
  supportUrl: 'https://remoteharness.app/en/docs/troubleshooting/',
  marketingUrl: 'https://remoteharness.app/en/',
  privacyUrl: 'https://remoteharness.app/en/docs/privacy/',
}

const introPt = (device: string): string =>
  `O Remote Harness permite acompanhar e comandar, pelo ${device}, os agentes de código do seu próprio computador: sessões do Claude Code e do Codex que rodam no tmux, de qualquer lugar. Sem conta, e tudo criptografado de ponta a ponta entre o celular e o computador: nada no meio do caminho consegue ler as suas sessões.`

const ptBR: StoreListing = {
  name: 'Remote Harness',
  subtitle: 'Agentes de código no celular',
  shortDescription: 'Acompanhe e comande o Claude Code e o Codex do seu computador, pelo celular.',
  description: buildDescription({
    intro: { ios: introPt('iPhone ou iPad'), android: introPt('celular ou tablet') },
    heading: 'O QUE DÁ PARA FAZER',
    bullets: [
      '• Ver todas as sessões de todos os perfis numa lista só, compacta ou expandida, com as que esperam por você no topo.',
      '• Ler a conversa enquanto acontece: Markdown, raciocínio, chamadas de ferramenta, diffs, imagens. As conversas que você abriu continuam legíveis no celular, criptografadas, mesmo com o computador fora de alcance.',
      '• Responder aos pedidos de permissão: permitir, negar ou permitir sempre, com a regra gravada pelo próprio agente e cada resposta no registro de aprovações.',
      '• Mandar o próximo prompt, enfileirar os seguintes enquanto o agente trabalha, anexar fotos e manter um rascunho por sessão.',
      {
        ios: '• Ditar no aparelho pelo tempo que precisar, passar para o modo mãos livres para ouvir respostas e permissões em voz alta e responder falando, ou responder pela Siri.',
        android:
          '• Ditar no aparelho pelo tempo que precisar, passar para o modo mãos livres para ouvir respostas e permissões em voz alta e responder falando, ou responder pelo Google Assistente.',
      },
      '• Rodar um comando de shell na pasta da sessão e levar a saída para o prompt (desligado até você ligar no computador).',
      '• Abrir sessões em qualquer pasta, opcionalmente num worktree git; retomar, renomear e encerrar.',
      '• Abrir o terminal bruto com uma barra de teclas para Esc, Ctrl+C, setas e Tab.',
      '• Acompanhar subagentes, tarefas em segundo plano, o modelo, a janela de contexto e os seus limites de uso.',
      {
        ios: '• Ficar de olho numa sessão pela tela de bloqueio e pela Dynamic Island com o status ao vivo, e pelos widgets da tela inicial e de bloqueio, com Permitir e Negar.',
        android:
          '• Ficar de olho numa sessão por uma notificação com o status ao vivo e pelos widgets da tela inicial, com Permitir e Negar.',
      },
      '• Rotear um perfil pelo OpenRouter e escolher o modelo pelo celular.',
      {
        ios: '• Cinco temas, layout de iPad com barra lateral e inspetor, atalhos de teclado físico, e português, inglês e espanhol.',
        android:
          '• Cinco temas, layout de tablet com barra lateral e inspetor, atalhos de teclado físico, e português, inglês e espanhol.',
      },
    ],
    how: `COMO FUNCIONA
Um daemon pequeno no seu computador macOS, Linux ou Windows (WSL2), ou num servidor na nuvem, faz a ponte entre os hooks dos próprios agentes, o tmux e o celular: direto na sua rede, ou por um relay de conexão criptografado de ponta a ponta quando você está fora (você pode hospedar o seu). Um comando instala: curl -fsSL https://remoteharness.app/install | bash. Escaneie o QR code que ele mostra e está pareado.`,
    privacy: `PRIVACIDADE
As suas sessões ficam nos seus aparelhos: o relay só repassa tráfego criptografado que não consegue ler. As notificações push levam um título, o perfil e a sessão; o status ao vivo acrescenta o título, a pasta e o passo atual da sessão, nunca a conversa. Sem conta e sem analytics; relatórios de erro e dados de desempenho só se você aceitar, nunca com as suas sessões. Política de privacidade: remoteharness.app/privacy. O código é aberto (MIT) em github.com/maarkN/remote-harness; a documentação está em remoteharness.app/docs.

REQUISITOS
Claude Code ou Codex no computador (o instalador adiciona tmux, git e ripgrep se faltarem).

O Remote Harness é um projeto independente, sem afiliação com a Anthropic ou a OpenAI. "Claude" e "Claude Code" são marcas da Anthropic, PBC; "Codex" é marca da OpenAI.`,
  }),
  keywords: [
    'claude code',
    'codex',
    'agente ia',
    'cli',
    'tmux',
    'ssh',
    'terminal',
    'remoto',
    'programação',
    'permissões',
    'criptografia',
  ],
  promotionalText:
    'Claude Code e Codex no seu computador, comandados pelo celular: aprove permissões, mande prompts, acompanhe cada passo. Ponta a ponta, sem conta.',
  releaseNotes: {
    ios: 'Primeira versão na App Store. Acompanhe e comande os agentes de programação do seu computador pelo iPhone ou iPad: sessões do Claude Code, Codex, Gemini CLI, Kimi CLI e Qwen Code no tmux. Leia a conversa enquanto acontece, responda aos pedidos de permissão, mande o próximo prompt, dite ou use o modo mãos livres, inicie sessões com um primeiro prompt ou um modelo e acompanhe pela tela de bloqueio e pelos widgets. Sem conta; cifrado de ponta a ponta entre celular e computador.',
    android:
      'Primeira versão no Google Play. Acompanhe e comande os agentes de programação do seu computador pelo celular: sessões do Claude Code, Codex, Gemini CLI, Kimi CLI e Qwen Code no tmux. Leia a conversa enquanto acontece, responda aos pedidos de permissão, mande o próximo prompt, dite ou use o modo mãos livres, inicie sessões com um primeiro prompt ou um modelo e acompanhe pela notificação ao vivo e pelos widgets da tela inicial. Sem conta; cifrado de ponta a ponta entre celular e computador.',
  },
  supportUrl: 'https://remoteharness.app/pt-br/docs/troubleshooting/',
  marketingUrl: 'https://remoteharness.app/pt-br/',
  privacyUrl: 'https://remoteharness.app/pt-br/docs/privacy/',
}

const introEs = (device: string): string =>
  `Remote Harness te permite seguir y dirigir desde ${device} los agentes de código de tu propio ordenador: sesiones de Claude Code y Codex que se ejecutan en tmux, desde cualquier sitio. Sin cuenta, y todo cifrado de extremo a extremo entre el móvil y el ordenador: nada por el camino puede leer tus sesiones.`

const esES: StoreListing = {
  name: 'Remote Harness',
  subtitle: 'Agentes de código en el móvil',
  shortDescription: 'Sigue y dirige Claude Code y Codex en tu ordenador desde el móvil.',
  description: buildDescription({
    intro: { ios: introEs('el iPhone o el iPad'), android: introEs('el móvil o la tableta') },
    heading: 'QUÉ PUEDES HACER',
    bullets: [
      '• Ver todas las sesiones de todos los perfiles en una sola lista, compacta o ampliada, con las que te esperan arriba.',
      '• Leer la conversación según ocurre: Markdown, razonamiento, llamadas a herramientas, diffs, imágenes. Las conversaciones que abriste siguen legibles en el móvil, cifradas, aunque el ordenador esté fuera de alcance.',
      '• Responder a las peticiones de permiso: permitir, denegar o permitir siempre, con la regla escrita por el propio agente y cada respuesta en el registro de aprobaciones.',
      '• Enviar el siguiente prompt, encolar los siguientes mientras el agente trabaja, adjuntar fotos y guardar un borrador por sesión.',
      {
        ios: '• Dictar en el dispositivo todo lo que necesites, pasar al modo manos libres para oír respuestas y permisos en voz alta y contestar hablando, o responder a través de Siri.',
        android:
          '• Dictar en el dispositivo todo lo que necesites, pasar al modo manos libres para oír respuestas y permisos en voz alta y contestar hablando, o responder a través del Asistente de Google.',
      },
      '• Ejecutar un comando de shell en la carpeta de la sesión y llevar su salida al prompt (desactivado hasta que lo actives en el ordenador).',
      '• Abrir sesiones en cualquier carpeta, opcionalmente en un worktree de git; reanudarlas, renombrarlas y cerrarlas.',
      '• Abrir el terminal en bruto con una barra de teclas para Esc, Ctrl+C, flechas y Tab.',
      '• Seguir subagentes, tareas en segundo plano, el modelo, la ventana de contexto y tus límites de uso.',
      {
        ios: '• No perder de vista una sesión desde la pantalla de bloqueo y la Dynamic Island con el estado en vivo, y desde los widgets de la pantalla de inicio y de bloqueo, con Permitir y Denegar.',
        android:
          '• No perder de vista una sesión desde una notificación con el estado en vivo y desde los widgets de la pantalla de inicio, con Permitir y Denegar.',
      },
      '• Enrutar un perfil por OpenRouter y elegir el modelo desde el móvil.',
      {
        ios: '• Cinco temas, un diseño para iPad con barra lateral e inspector, atajos de teclado físico, y español, inglés y portugués.',
        android:
          '• Cinco temas, un diseño para tableta con barra lateral e inspector, atajos de teclado físico, y español, inglés y portugués.',
      },
    ],
    how: `CÓMO FUNCIONA
Un pequeño daemon en tu ordenador macOS, Linux o Windows (WSL2), o en un servidor en la nube, hace de puente entre los hooks de los propios agentes, tmux y el móvil: directo en tu red, o a través de un relay de conexión cifrado de extremo a extremo cuando estás fuera (puedes alojar el tuyo). Un comando lo instala: curl -fsSL https://remoteharness.app/install | bash. Escanea el código QR que muestra y ya estás emparejado.`,
    privacy: `PRIVACIDAD
Tus sesiones se quedan en tus dispositivos: el relay solo reenvía tráfico cifrado que no puede leer. Las notificaciones push llevan un título, el perfil y la sesión; el estado en vivo añade el título, la carpeta y el paso actual de la sesión, nunca la conversación. Sin cuenta y sin analítica; informes de errores y datos de rendimiento solo si los aceptas, nunca con tus sesiones. Política de privacidad: remoteharness.app/privacy. El código es abierto (MIT) en github.com/maarkN/remote-harness; la documentación está en remoteharness.app/docs.

REQUISITOS
Claude Code o Codex en el ordenador (el instalador añade tmux, git y ripgrep si faltan).

Remote Harness es un proyecto independiente, sin afiliación con Anthropic ni OpenAI. "Claude" y "Claude Code" son marcas de Anthropic, PBC; "Codex" es una marca de OpenAI.`,
  }),
  keywords: [
    'claude code',
    'codex',
    'agente ia',
    'cli',
    'tmux',
    'ssh',
    'terminal',
    'remoto',
    'programación',
    'permisos',
    'cifrado',
  ],
  promotionalText:
    'Claude Code y Codex en tu ordenador, dirigidos desde el móvil: aprueba permisos, envía prompts, sigue cada paso. Cifrado de extremo a extremo, sin cuenta.',
  releaseNotes: {
    ios: 'Primera versión en el App Store. Sigue y dirige los agentes de programación de tu ordenador desde el iPhone o el iPad: sesiones de Claude Code, Codex, Gemini CLI, Kimi CLI y Qwen Code en tmux. Lee la conversación según ocurre, responde a las solicitudes de permiso, envía el siguiente prompt, dicta o usa el modo manos libres, inicia sesiones con un primer prompt o una plantilla y síguelas desde la pantalla de bloqueo y los widgets. Sin cuenta; cifrado de extremo a extremo entre móvil y ordenador.',
    android:
      'Primera versión en Google Play. Sigue y dirige los agentes de programación de tu ordenador desde el móvil: sesiones de Claude Code, Codex, Gemini CLI, Kimi CLI y Qwen Code en tmux. Lee la conversación según ocurre, responde a las solicitudes de permiso, envía el siguiente prompt, dicta o usa el modo manos libres, inicia sesiones con un primer prompt o una plantilla y síguelas desde la notificación en vivo y los widgets. Sin cuenta; cifrado de extremo a extremo entre el móvil y el ordenador.',
  },
  supportUrl: 'https://remoteharness.app/es/docs/troubleshooting/',
  marketingUrl: 'https://remoteharness.app/es/',
  privacyUrl: 'https://remoteharness.app/es/docs/privacy/',
}

export const STORE_METADATA: Record<Locale, StoreListing> = { 'en-US': enUS, 'pt-BR': ptBR, 'es-ES': esES }
