import type { WebMessages } from './en-US.ts'

export const esES: WebMessages = {
  meta: {
    title: 'Remote Harness: sigue y dirige tus agentes de código desde el móvil',
    description:
      'Autoalojado: Claude Code, Codex, Gemini CLI, Kimi CLI o Qwen Code se ejecuta en tmux en tu propia máquina y Remote Harness transmite la conversación a tu móvil con cifrado de extremo a extremo. Permisos, prompts y sesiones nuevas desde cualquier lugar.',
  },
  nav: {
    skip: 'Ir al contenido',
    how: 'Cómo funciona',
    features: 'Funciones',
    security: 'Seguridad',
    install: 'Instalar',
    docs: 'Docs',
    github: 'GitHub',
    language: 'Idioma',
    menu: 'Menú',
  },
  hero: {
    eyebrow: 'Cifrado de extremo a extremo · tmux · código abierto',
    title: 'Sigue y dirige tus agentes de código desde el móvil.',
    lead: 'Claude Code, Codex, Gemini CLI, Kimi CLI o Qwen Code se ejecuta en tmux en tu propia máquina. Remote Harness transmite la conversación a tu móvil desde cualquier lugar, con cifrado de extremo a extremo: lees lo que hizo el agente, respondes a sus peticiones de permiso, envías el siguiente prompt y abres sesiones nuevas.',
    install: 'Instalar en la máquina',
    app: 'Descargar la app',
    platforms: 'macOS · Linux · Windows (WSL2)',
    phones: 'iOS · Android',
    terms: 'MIT, sin cuenta, sin VPN',
    carousel: {
      label: 'Pantallas de la app',
      role: 'carrusel',
      previous: 'Pantalla anterior',
      next: 'Pantalla siguiente',
    },
    slides: [
      { name: 'Sesiones', label: 'La lista de sesiones en la app, con una petición de permiso esperando' },
      {
        name: 'Conversación',
        label:
          'Una sesión en la app: el prompt, la respuesta del agente, sus llamadas a herramientas y el cuadro de mensaje',
      },
      {
        name: 'Estado en vivo',
        label:
          'La pantalla de bloqueo con dos actividades en vivo: una sesión trabajando y otra esperando un permiso',
      },
    ],
  },
  mock: {
    title: 'Sesiones',
    host: 'MacBook Pro',
    count: '· 5 sesiones',
    filters: ['todas', 'Personal', 'Trabajo'],
    waiting: 'Esperándote · 1',
    timer: '0:52',
    permission: {
      title: 'Añadir rate limit en el login',
      tool: 'Bash',
      command: 'gh pr create --fill --base main',
    },
    deny: 'Denegar',
    always: 'Siempre',
    allow: 'Permitir',
    states: { running: 'en marcha', waiting: 'esperando', idle: 'parada', ended: 'terminada' },
    profiles: { personal: 'Personal', work: 'Trabajo' },
    sessions: [
      {
        title: 'Migrar la landing a Tailwind 4',
        folder: '~/projects/landing',
        branch: 'main',
        state: 'running',
        profile: 'personal',
        ago: '2 min',
      },
      {
        title: 'Añadir rate limit en el login',
        folder: '~/projects/acme-api',
        branch: 'feat/rate-limit',
        state: 'waiting',
        profile: 'work',
        ago: '4 min',
      },
      {
        title: 'Arreglar el crash del onboarding',
        folder: '~/projects/acme-mobile',
        branch: 'fix/onboarding',
        state: 'idle',
        profile: 'work',
        ago: '12 min',
      },
      {
        title: 'Escribir un post sobre tmux + agentes',
        folder: '~/projects/blog',
        branch: 'main',
        state: 'idle',
        profile: 'personal',
        ago: '40 min',
      },
      {
        title: 'Revisar el pipeline de deploy',
        folder: '~/projects/acme-infra',
        branch: null,
        state: 'ended',
        profile: 'work',
        ago: '2 h',
      },
    ],
    conversation: {
      title: 'Arreglar el crash del onboarding',
      folder: '~/projects/acme-mobile',
      branch: 'fix/onboarding',
      mode: 'aceptar ediciones',
      model: 'sonnet',
      context: '38% del contexto',
      prompt:
        'La app se cierra en el segundo paso del onboarding cuando el usuario se salta la foto. Averigua por qué y arréglalo',
      intro: 'Voy a ver cómo leen la foto los pasos del onboarding.',
      tools: [
        { name: 'Grep("photo" in src/onboarding)', result: 'src/onboarding/Profile.tsx:31: photo.uri' },
        { name: 'Edit(src/onboarding/Profile.tsx)', result: 'ok · +3 −1' },
        { name: 'Bash(pnpm test onboarding)', result: '✓ 12 tests · 1,4 s' },
      ],
      reply: 'Arreglado. `Profile.tsx` leía `photo.uri` antes de comprobar que se había elegido una foto:',
      points: ['el paso ahora usa el avatar con las iniciales', 'un test nuevo cubre saltarse la foto'],
      placeholder: 'Mensaje para Claude Code…',
    },
    live: {
      date: 'martes, 21 de octubre',
      working: {
        who: 'Personal · MacBook Pro',
        title: 'Migrar la landing a Tailwind 4',
        folder: '~/projects/landing',
        timer: '4:36',
        sub: 'trabajando',
        state: 'Trabajando',
        step: 'Bash · pnpm',
        tools: '6 herramientas',
      },
      waiting: {
        who: 'Trabajo · MacBook Pro',
        title: 'Añadir rate limit en el login',
        folder: '~/projects/acme-api',
        timer: '0:52',
        sub: 'esperando',
        state: 'Esperándote',
        step: 'permiso · Bash',
        tools: '9 herramientas',
      },
    },
  },
  agents: {
    label: 'Funciona con',
    claude: 'Claude Code',
    openrouter: 'Modelos de OpenRouter',
    openrouterNote: 'vía perfiles',
    codex: 'Codex CLI',
    gemini: 'Gemini CLI',
    kimi: 'Kimi',
    qwen: 'Qwen Code',
    soon: 'pronto',
  },
  how: {
    eyebrow: 'Cómo funciona',
    title: 'Tu móvil, tu máquina. Nada en medio puede leerlo.',
    lead: 'Las sesiones se ejecutan dentro de tmux. El agente cuenta lo que pasa por sus hooks nativos, un pequeño daemon en la máquina hace de puente con el móvil, y el cifrado de extremo a extremo lo mantiene todo privado.',
    phone: {
      title: 'Tu móvil',
      body: 'App nativa para iOS y Android. Lee la conversación, responde permisos, envía prompts, teclas, fotos y voz. Push y estado en vivo, sin contenido dentro.',
    },
    link1: {
      top: 'WebSocket: directo o relay',
      bottom: 'Noise, extremo a extremo · solo dispositivos emparejados',
    },
    machine: {
      title: 'Tu máquina',
      body: 'El daemon `remote-harness`: sigue los transcripts, controla tmux, recibe los hooks del agente en 127.0.0.1. Una línea para instalar, un elemento de inicio o una unidad systemd para mantenerlo en marcha.',
    },
    link2: { top: 'hooks + tmux', bottom: 'send-keys · capture-pane' },
    agents: {
      title: 'Tus agentes, en tmux',
      body: 'Una ventana por sesión, un alias por perfil, para Claude Code, Codex, Gemini CLI, Kimi CLI o Qwen Code.',
      aliases: [
        { mark: 'claude', text: 'personal → ~/.claude' },
        { mark: 'claude', text: 'trabajo → ~/.claude-work' },
        { mark: 'codex', text: 'codex → ~/.codex' },
        { mark: 'gemini', text: 'gem → ~/.gemini' },
        { mark: 'kimi', text: 'km → ~/.kimi' },
        { mark: 'qwen', text: 'qw → ~/.qwen' },
        { mark: 'claude', text: 'openrouter → ~/.claude-openrouter' },
      ],
    },
    steps: [
      {
        title: 'Instala en la máquina',
        body: 'Un comando. Comprueba tmux, git, ripgrep y Node, encuentra tus perfiles e instala los lanzadores.',
      },
      {
        title: 'Escanea el código QR',
        body: 'La instalación lo muestra al final (o `remote-harness pair`). En casa o fuera, el móvil encuentra la máquina, listo.',
      },
      {
        title: 'Ejecuta tu alias',
        body: '`trabajo` abre Claude Code en tmux con ese perfil. La sesión aparece en el móvil, totalmente controlable.',
      },
    ],
  },
  features: {
    eyebrow: 'Funciones',
    title: 'Todo lo que muestra el terminal, y las partes que el terminal no puede.',
    items: [
      {
        glyph: '≡',
        title: 'Una lista, todos los perfiles',
        body: 'Sesiones de todos tus perfiles, ordenadas por lo último que se movió, con una franja “esperándote” arriba.',
      },
      {
        glyph: '●',
        title: 'Conversación en vivo',
        body: 'Markdown, razonamiento, llamadas a herramientas, diffs y resultados, transmitidos al momento y paginados hasta el principio.',
      },
      {
        glyph: '⛨',
        title: 'Permisos desde el bolsillo',
        body: 'Permitir, denegar o permitir siempre. El “siempre” queda como regla escrita por el propio agente, reversible desde la CLI.',
      },
      {
        glyph: '⏎',
        title: 'En cola o enviar ya',
        body: 'Encola los siguientes mensajes mientras el agente trabaja; entran en orden cuando termina el turno. Mantén pulsado para enviar al instante.',
      },
      {
        glyph: '▣',
        title: 'Terminal en bruto',
        body: 'El propio panel de tmux, para menús y todo lo que la vista estructurada no cubre, con una barra de teclas para Esc, Ctrl+C, flechas y Tab.',
      },
      {
        glyph: '⎇',
        title: 'Abrir, reanudar, cerrar',
        body: 'Sesiones nuevas en cualquier carpeta, opcionalmente en su propio worktree de git. Reanuda las de solo lectura. Cierra con limpieza del worktree que nunca descarta trabajo en silencio.',
      },
      {
        glyph: '◔',
        title: 'Estado en vivo',
        body: 'Pantalla de bloqueo y Dynamic Island en iOS, una notificación silenciosa en Android: estado, tipo de paso y tiempo transcurrido, nunca el texto.',
      },
      {
        glyph: '⌥',
        title: 'Subagentes, voz, fotos',
        body: 'Sigue subagentes y tareas en segundo plano, dicta prompts en el dispositivo, adjunta fotos. Autocompletado para @archivos y /comandos.',
      },
    ],
  },
  security: {
    eyebrow: 'Privacidad y seguridad',
    title: 'El daemon es un shell remoto, así que viene cerrado por defecto.',
    items: [
      {
        title: 'El relay no puede leerlo',
        body: 'En casa la app habla directamente con el daemon; fuera, a través de un relay de conexión. Ambos caminos van cifrados de extremo a extremo con Noise y claves por dispositivo, así que el relay solo reenvía bytes que no puede leer, y no guarda registros.',
      },
      {
        title: 'Claves por dispositivo',
        body: 'Cada móvil se empareja con un código de un solo uso que caduca en 5 minutos y recibe sus propias claves, guardadas en el Llavero (macOS), el Secret Service (Linux) o el almacenamiento seguro del móvil. Revoca cualquiera cuando quieras.',
      },
      {
        title: 'Push sin contenido',
        body: 'Las notificaciones llevan un título, un perfil y un id de sesión. El estado en vivo añade el nombre y la carpeta de la sesión, nada de la conversación.',
      },
      {
        title: 'Sin bypass',
        body: 'La app nunca ofrece el modo “bypass permissions” del agente. Los cambios en tus dotfiles se fusionan, se respaldan y son totalmente reversibles.',
      },
      {
        title: 'Solo si tú quieres',
        body: 'No se envía nada a ninguna parte sin tu elección: push con tu propio proyecto de Firebase o con el relay sin contenido, informes de errores y datos de rendimiento, siempre sin contenido de las sesiones.',
      },
      {
        title: 'Código abierto',
        body: 'Licencia MIT, construido a la vista con OpenSpec. Lee [SECURITY.md](https://github.com/maarkN/remote-harness/blob/main/SECURITY.md) para informar de un problema.',
      },
    ],
  },
  install: {
    eyebrow: 'Instalar',
    title: 'Una línea en la máquina, un escaneo en el móvil.',
    tabUnix: 'macOS · Linux',
    tabWindows: 'Windows (WSL2)',
    copy: 'Copiar',
    copied: 'Copiado',
    copyLabel: 'Copiar el comando de instalación',
    unixNote:
      'Comprueba el sistema, instala lo que falte (Homebrew, apt, dnf, pacman o zypper), compila el daemon y abre la instalación guiada.',
    windowsNote:
      'En PowerShell. Configura WSL2 con Ubuntu cuando falta (reinicia si lo pide y vuelve a ejecutarlo) y después lanza el instalador de Linux dentro.',
    requirements: [
      'Node 24+ (incluido si falta)',
      'tmux',
      'git',
      'ripgrep',
      'claude, codex, gemini, kimi o qwen en el PATH',
    ],
    appTitle: 'Descargar la app',
    ios: {
      title: 'iPhone y iPad',
      detail: 'Instalación inalámbrica · dispositivos registrados · iOS 17+',
      source: 'Compílala desde el código por ahora · TestFlight pronto · iOS 17+',
      note: 'El build de iPhone y iPad solo se instala en dispositivos registrados: [cómo añadir el tuyo](/es/docs/getting-started/#registrar-un-iphone-o-ipad), o compílala desde el código.',
    },
    android: { title: 'Android', detail: 'Google Play (prueba) · Android 10+' },
    appNote:
      'No hace falta nada más en el móvil. ¿Instalaste primero la app? Su pantalla de emparejamiento te guía en la instalación de la máquina.',
  },
  faq: {
    eyebrow: 'Docs y FAQ',
    title: 'Las primeras preguntas',
    lead: 'La guía completa está en [la documentación](/es/docs/): primeros pasos, uso de la app, la CLI del daemon, seguridad, resolución de problemas.',
    items: [
      {
        q: '¿Funciona fuera de casa?',
        a: 'Sí: directamente en casa y, fuera, a través del relay de conexión con cifrado de extremo a extremo, sin abrir puertos ni VPN. La máquina tiene que estar despierta; la página Solución de problemas de la documentación cubre las opciones de suspensión y bloqueo.',
      },
      {
        q: '¿Qué agentes están soportados?',
        a: 'Claude Code, Codex CLI, Gemini CLI, Kimi CLI y Qwen Code, con todos los perfiles (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `~/.gemini`, `KIMI_SHARE_DIR`, `QWEN_HOME`) en una sola lista, incluidos los perfiles de Claude Code enrutados por OpenRouter.',
      },
      {
        q: '¿Puede ejecutar mi agente sin supervisión?',
        a: 'Solo hasta donde lo permiten los modos de permiso del propio agente. La app ofrece predeterminado, aceptar ediciones, plan y auto; nunca ofrece bypass. Cada permiso sigue pasando por ti, desde el móvil o la máquina.',
      },
      {
        q: '¿Y las sesiones abiertas fuera de tmux?',
        a: 'Siguen apareciendo, en solo lectura. Reanuda una desde el móvil y se reabre dentro de tmux, totalmente controlable.',
      },
      {
        q: '¿Hay algún componente en la nube?',
        a: 'Solo relays que no pueden leer nada. Fuera de casa el relay de conexión reenvía el tráfico cifrado de extremo a extremo (o aloja el tuyo), y el push opcional pasa por FCM (tu proyecto de Firebase o el relay de push sin contenido). Nada guarda tus sesiones.',
      },
      {
        q: '¿El daemon necesita un Mac?',
        a: 'No: macOS, Linux (systemd) y Windows mediante WSL2 están soportados. La app funciona en iOS y Android.',
      },
    ],
  },
  footer: {
    docs: 'Docs',
    github: 'GitHub',
    releases: 'Releases',
    security: 'Seguridad',
    privacy: 'Privacidad',
    license: 'MIT',
    legal:
      'Remote Harness es un proyecto independiente, sin afiliación, respaldo ni patrocinio de Anthropic, OpenAI, Google, Moonshot AI, Alibaba Cloud ni OpenRouter. “Claude” y “Claude Code” son marcas de Anthropic, PBC; “Codex” es marca de OpenAI; “Gemini” es marca de Google LLC; Kimi, Qwen y OpenRouter y sus logotipos pertenecen a sus dueños. Las capturas muestran sesiones de demostración.',
    contributors: 'Colaboradores',
    madeBy: 'Hecho por',
  },
  docs: {
    title: 'Documentación',
    home: 'Inicio',
    pages: 'Páginas',
    search: 'Buscar en la documentación',
    noResults: 'Sin resultados',
    onThisPage: 'En esta página',
    previous: 'Anterior',
    next: 'Siguiente',
    applies: 'Válido para {{version}}',
    fallback: 'Esta página aún no está traducida; aquí tienes la versión en inglés.',
  },
  installPage: {
    title: 'Instalar Remote Harness',
    description:
      'Un comando instala Remote Harness en macOS, Linux o Windows (WSL2): comprueba el sistema, compila el daemon y abre la configuración guiada.',
    eyebrow: 'Instalar',
    heading: 'Una línea en una terminal de tu ordenador.',
    lead: 'La misma dirección sirve para todos: curl y wget reciben el script de macOS · Linux, PowerShell recibe el de Windows y el navegador recibe esta página.',
    unix: 'macOS · Linux · WSL',
    windows: 'Windows (PowerShell)',
    detected: 'Para tu sistema',
    others: 'Otros sistemas',
    phone:
      'Ejecútalo en una terminal del ordenador en el que se ejecuta tu agente de código, no en el móvil.',
    version: 'Instalando `{{ref}}` en lugar de la última versión.',
    next: 'Paso a paso, con qué hacer después de la configuración: [primeros pasos]({{docs}}).',
  },
  appLink: {
    title: 'Instalar la app',
    lead: 'Remote Harness para tu móvil, compilado y publicado desde tu ordenador.',
    version: 'Versión {{version}} ({{build}}) · {{date}}',
    notPublished: 'Todavía no publicado.',
    size: '{{size}} MB',
    ios: {
      title: 'iPhone y iPad',
      install: 'Instalar',
      registered:
        'Solo los iPhone y iPad registrados en el equipo de desarrollador pueden instalar este build ([cómo añadir el tuyo](/es/docs/getting-started/#registrar-un-iphone-o-ipad)). Abre esta página en Safari.',
      developerMode:
        'La primera vez, iOS pide activar el Modo de desarrollador: Ajustes → Privacidad y seguridad → Modo de desarrollador, y reiniciar.',
    },
    android: {
      title: 'Android',
      download: 'Descargar el APK',
      unknownApps:
        'El navegador pide permitir instalar apps desconocidas (Ajustes → Aplicaciones → Acceso especial → Instalar aplicaciones desconocidas). Después abre el archivo descargado.',
      updates: 'Un APK más nuevo se instala encima del anterior y mantiene el emparejamiento.',
    },
    qr: 'Escanéalo con la cámara del móvil para abrir esta página allí.',
    qrLabel: 'Código QR de esta página',
    showAll: '¿No es tu dispositivo? Mostrar todas las opciones',
    private: 'Enlace privado: quien lo tenga puede descargar estos builds. No lo publiques.',
  },
  notFound: {
    title: 'Página no encontrada',
    body: 'No hay nada en esta dirección. La página de inicio explica la app; el repositorio tiene el código y la documentación.',
    home: 'Volver a la página de inicio',
    github: 'Abrir el repositorio',
  },
}
