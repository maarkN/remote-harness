import type { Locale } from '@remote-harness/protocol'

/**
 * Store listing texts (App Store Connect and Google Play) in the three languages. en-US is the
 * reference shape; `scripts/store-metadata.mts` writes them in fastlane's layout and
 * `scripts/store-metadata.test.ts` enforces the stores' limits. Agent-neutral copy, product names
 * untranslated, no private project named.
 */
export type StoreListing = {
  /** App Store name and Play title. */
  name: string
  /** App Store subtitle. */
  subtitle: string
  /** Play short description. */
  shortDescription: string
  /** App Store description and Play full description. */
  description: string
  /** App Store keywords; joined with commas on output. */
  keywords: string[]
  /** App Store promotional text (editable without a new build). */
  promotionalText: string
  /** What's new, for both stores (Play allows 500 characters). */
  releaseNotes: string
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

const enUS: StoreListing = {
  name: 'Remote Harness',
  subtitle: 'Coding agents from your phone',
  shortDescription: 'Follow and drive Claude Code and Codex on your computer, from your phone.',
  description: `Remote Harness lets you follow and drive the coding agents on your own computer from your phone: Claude Code and Codex sessions running in tmux, over your Tailscale network. Self-hosted: no account, and no cloud service reading your sessions.

WHAT YOU CAN DO
• See every session of every profile in one list, with the ones waiting for you on top.
• Read the conversation as it happens: Markdown, thinking, tool calls, diffs, images.
• Answer permission requests: allow, deny or always allow, with the rule written by the agent itself.
• Send the next prompt, queue follow-ups, attach photos and keep a draft per session.
• Dictate on the device for as long as you need, with pause, push-to-talk and an optional polish pass.
• Run a shell command in the session's folder and add its output to the prompt (off until you turn it on on the computer).
• Start sessions in any folder (optionally in a git worktree), resume, rename and close them.
• Open the raw terminal with a key bar for Esc, Ctrl+C, arrows and Tab.
• Follow subagents, background tasks, the model, the context window and your usage limits.
• See the current step and the todo progress in a notification (Android) or on the lock screen (iOS).
• Route a profile through OpenRouter and pick the model from the phone.
• Themes, a tablet layout with a sidebar, and English, Portuguese and Spanish.

HOW IT WORKS
A small daemon on your macOS, Linux or Windows (WSL2) computer bridges the agents' own hooks and tmux to the phone over a WebSocket bound to the Tailscale interface. One command installs it: curl -fsSL https://remoteharness.app/install | bash. Scan the QR code it shows, and you are paired.

PRIVACY
Your sessions stay on your devices and your tailnet. Push notifications carry a title, the profile and the session; the live status adds the session's title, folder and current step, never the conversation. No account and no analytics; error reports and performance data only if you opt in, never with your sessions. Privacy policy: remoteharness.app/privacy. The code is open source (MIT) at github.com/maarkN/remote-harness; the documentation lives at remoteharness.app/docs.

REQUIREMENTS
Tailscale on the phone and on the computer; Claude Code or Codex on the computer (the installer adds tmux, git and ripgrep if they are missing).

Remote Harness is an independent project, not affiliated with Anthropic or OpenAI. "Claude" and "Claude Code" are trademarks of Anthropic, PBC; "Codex" is a trademark of OpenAI.`,
  keywords: [
    'claude code',
    'codex',
    'coding agent',
    'tmux',
    'tailscale',
    'remote',
    'terminal',
    'ai agent',
    'developer',
    'permissions',
  ],
  promotionalText:
    'Answer your coding agent’s permission requests, send the next prompt and run commands from anywhere, over your own Tailscale network.',
  releaseNotes:
    "Run shell commands in a session's folder and add the output to the prompt. The live status shows the current step and the todo progress. Codex sessions show the model, context usage and rate limits. A clear screen when the computer can't be reached, and fixes to voice settings, the queue card and the session details sheet.",
  supportUrl: 'https://remoteharness.app/en/docs/troubleshooting/',
  marketingUrl: 'https://remoteharness.app/en/',
  privacyUrl: 'https://remoteharness.app/en/docs/privacy/',
}

const ptBR: StoreListing = {
  name: 'Remote Harness',
  subtitle: 'Agentes de código no celular',
  shortDescription: 'Acompanhe e comande o Claude Code e o Codex do seu computador, pelo celular.',
  description: `O Remote Harness permite acompanhar e comandar, pelo celular, os agentes de código do seu próprio computador: sessões do Claude Code e do Codex que rodam no tmux, pela sua rede Tailscale. Self-hosted: sem conta e sem serviço na nuvem lendo as suas sessões.

O QUE DÁ PARA FAZER
• Ver todas as sessões de todos os perfis numa lista só, com as que esperam por você no topo.
• Ler a conversa enquanto acontece: Markdown, raciocínio, chamadas de ferramenta, diffs, imagens.
• Responder aos pedidos de permissão: permitir, negar ou permitir sempre, com a regra gravada pelo próprio agente.
• Mandar o próximo prompt, enfileirar os seguintes, anexar fotos e manter um rascunho por sessão.
• Ditar no aparelho pelo tempo que precisar, com pausa, apertar para falar e um aprimoramento opcional.
• Rodar um comando de shell na pasta da sessão e levar a saída para o prompt (desligado até você ligar no computador).
• Abrir sessões em qualquer pasta (opcionalmente num worktree git), retomar, renomear e encerrar.
• Abrir o terminal bruto com uma barra de teclas para Esc, Ctrl+C, setas e Tab.
• Acompanhar subagentes, tarefas em segundo plano, o modelo, a janela de contexto e os seus limites de uso.
• Ver o passo atual e o progresso das tarefas numa notificação (Android) ou na tela de bloqueio (iOS).
• Rotear um perfil pelo OpenRouter e escolher o modelo pelo celular.
• Temas, layout de tablet com barra lateral, e português, inglês e espanhol.

COMO FUNCIONA
Um daemon pequeno no seu computador macOS, Linux ou Windows (WSL2) faz a ponte entre os hooks dos próprios agentes, o tmux e o celular, por um WebSocket preso à interface do Tailscale. Um comando instala: curl -fsSL https://remoteharness.app/install | bash. Escaneie o QR code que ele mostra e está pareado.

PRIVACIDADE
As suas sessões ficam nos seus aparelhos e na sua tailnet. As notificações push levam um título, o perfil e a sessão; o status ao vivo acrescenta o título, a pasta e o passo atual da sessão, nunca a conversa. Sem conta e sem analytics; relatórios de erro e dados de desempenho só se você aceitar, nunca com as suas sessões. Política de privacidade: remoteharness.app/privacy. O código é aberto (MIT) em github.com/maarkN/remote-harness; a documentação está em remoteharness.app/docs.

REQUISITOS
Tailscale no celular e no computador; Claude Code ou Codex no computador (o instalador adiciona tmux, git e ripgrep se faltarem).

O Remote Harness é um projeto independente, sem afiliação com a Anthropic ou a OpenAI. "Claude" e "Claude Code" são marcas da Anthropic, PBC; "Codex" é marca da OpenAI.`,
  keywords: [
    'claude code',
    'codex',
    'agente de código',
    'tmux',
    'tailscale',
    'remoto',
    'terminal',
    'agente ia',
    'desenvolvedor',
    'permissões',
  ],
  promotionalText:
    'Responda aos pedidos de permissão do seu agente de código, mande o próximo prompt e rode comandos de onde estiver, pela sua rede Tailscale.',
  releaseNotes:
    'Rode comandos de shell na pasta de uma sessão e leve a saída para o prompt. O status ao vivo mostra o passo atual e o progresso das tarefas. Sessões do Codex mostram o modelo, o uso de contexto e os limites. Uma tela clara quando o computador está fora de alcance, e correções nos ajustes de voz, no card da fila e nos detalhes da sessão.',
  supportUrl: 'https://remoteharness.app/pt-br/docs/troubleshooting/',
  marketingUrl: 'https://remoteharness.app/pt-br/',
  privacyUrl: 'https://remoteharness.app/pt-br/docs/privacy/',
}

const esES: StoreListing = {
  name: 'Remote Harness',
  subtitle: 'Agentes de código en el móvil',
  shortDescription: 'Sigue y dirige Claude Code y Codex en tu ordenador desde el móvil.',
  description: `Remote Harness te permite seguir y dirigir desde el móvil los agentes de código de tu propio ordenador: sesiones de Claude Code y Codex que se ejecutan en tmux, a través de tu red Tailscale. Autoalojado: sin cuenta y sin ningún servicio en la nube leyendo tus sesiones.

QUÉ PUEDES HACER
• Ver todas las sesiones de todos los perfiles en una sola lista, con las que te esperan arriba.
• Leer la conversación según ocurre: Markdown, razonamiento, llamadas a herramientas, diffs, imágenes.
• Responder a las peticiones de permiso: permitir, denegar o permitir siempre, con la regla escrita por el propio agente.
• Enviar el siguiente prompt, encolar los siguientes, adjuntar fotos y guardar un borrador por sesión.
• Dictar en el dispositivo todo lo que necesites, con pausa, pulsar para hablar y una mejora opcional.
• Ejecutar un comando de shell en la carpeta de la sesión y llevar su salida al prompt (desactivado hasta que lo actives en el ordenador).
• Abrir sesiones en cualquier carpeta (opcionalmente en un worktree de git), reanudarlas, renombrarlas y cerrarlas.
• Abrir el terminal en bruto con una barra de teclas para Esc, Ctrl+C, flechas y Tab.
• Seguir subagentes, tareas en segundo plano, el modelo, la ventana de contexto y tus límites de uso.
• Ver el paso actual y el progreso de las tareas en una notificación (Android) o en la pantalla de bloqueo (iOS).
• Enrutar un perfil por OpenRouter y elegir el modelo desde el móvil.
• Temas, diseño para tableta con barra lateral, y español, inglés y portugués.

CÓMO FUNCIONA
Un pequeño daemon en tu ordenador macOS, Linux o Windows (WSL2) hace de puente entre los hooks de los propios agentes, tmux y el móvil, por un WebSocket atado a la interfaz de Tailscale. Un comando lo instala: curl -fsSL https://remoteharness.app/install | bash. Escanea el código QR que muestra y ya estás emparejado.

PRIVACIDAD
Tus sesiones se quedan en tus dispositivos y en tu tailnet. Las notificaciones push llevan un título, el perfil y la sesión; el estado en vivo añade el título, la carpeta y el paso actual de la sesión, nunca la conversación. Sin cuenta y sin analítica; informes de errores y datos de rendimiento solo si los aceptas, nunca con tus sesiones. Política de privacidad: remoteharness.app/privacy. El código es abierto (MIT) en github.com/maarkN/remote-harness; la documentación está en remoteharness.app/docs.

REQUISITOS
Tailscale en el móvil y en el ordenador; Claude Code o Codex en el ordenador (el instalador añade tmux, git y ripgrep si faltan).

Remote Harness es un proyecto independiente, sin afiliación con Anthropic ni OpenAI. "Claude" y "Claude Code" son marcas de Anthropic, PBC; "Codex" es una marca de OpenAI.`,
  keywords: [
    'claude code',
    'codex',
    'agente de código',
    'tmux',
    'tailscale',
    'remoto',
    'terminal',
    'agente ia',
    'desarrollador',
    'permisos',
  ],
  promotionalText:
    'Responde a las peticiones de permiso de tu agente de código, envía el siguiente prompt y ejecuta comandos desde cualquier lugar, por tu red Tailscale.',
  releaseNotes:
    'Ejecuta comandos de shell en la carpeta de una sesión y lleva la salida al prompt. El estado en vivo muestra el paso actual y el progreso de las tareas. Las sesiones de Codex muestran el modelo, el uso de contexto y los límites. Una pantalla clara cuando no se alcanza el ordenador, y correcciones en los ajustes de voz, la tarjeta de la cola y los detalles de la sesión.',
  supportUrl: 'https://remoteharness.app/es/docs/troubleshooting/',
  marketingUrl: 'https://remoteharness.app/es/',
  privacyUrl: 'https://remoteharness.app/es/docs/privacy/',
}

export const STORE_METADATA: Record<Locale, StoreListing> = { 'en-US': enUS, 'pt-BR': ptBR, 'es-ES': esES }
