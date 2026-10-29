---
title: Usar la app
description: Lista de sesiones, conversación, prompts, permisos, terminal, sesiones y worktrees, estado en vivo, notificaciones, perfiles y OpenRouter, ajustes.
applies: 0.7+
---

## Lista de sesiones

La pantalla de inicio lista las sesiones de todos los perfiles del ordenador emparejado, de la actividad más reciente a la más antigua (el chip de orden cambia a agrupar por estado). Cada fila muestra la insignia del agente, el título, la carpeta y la rama, el estado (`en marcha`, `esperando`, `parada`, `terminada`) y la etiqueta del perfil; los chips filtran por perfil. Una franja **Esperándote** arriba reúne las peticiones de permiso, con Permitir, Siempre y Denegar ahí mismo. Desliza una fila para las acciones rápidas (cerrar o reanudar, silenciar, fijar); mantén pulsado o abre el menú de la fila para el resto (copiar la ruta, ocultar una sesión terminada, limpiar su worktree). Las sesiones que comparten un checkout de git con otra sesión en vivo quedan marcadas, porque pueden pisarse los archivos.

La línea bajo el título muestra el ordenador y cuántas sesiones tiene; toca el nombre para cambiar a otro ordenador emparejado o añadir uno. "por relay" ahí significa que la app lo alcanza a través del relay de conexión: en casa pasa sola al camino directo, sin perder la conversación. Las notificaciones siguen llegando de todos los ordenadores emparejados, y tocar una la abre en su ordenador. El botón `+` abre una sesión nueva.

## Conversación

Abre una sesión para leer la conversación según ocurre: prompts, el texto del agente en Markdown, el razonamiento, las llamadas a herramientas con sus resultados, diffs e imágenes, paginados hasta el principio. Bajo la cabecera, la primera línea de contexto muestra la insignia del agente, el perfil, la carpeta (tócala para los detalles de la sesión), el estado y el modo de permisos; la segunda muestra el modelo (con el nivel de esfuerzo), el proveedor cuando el perfil tiene uno, la rama, el uso de la ventana de contexto y los límites de uso de la cuenta. Tócala para ver los números.

**Historial de la conversación** (en el menú) lista tus prompts del más reciente al más antiguo y salta a uno. **Seguir la salida** mantiene la vista al final mientras el agente trabaja; desplázate hacia arriba para pausarlo.

## Enviar prompts

Escribe en el compositor y envía. Mientras el agente está ocupado el prompt entra en la cola y se entrega en orden cuando termina el turno; la tarjeta **Cola** permite editar, reordenar, quitar o enviar ya un elemento. Mantén pulsado el botón de enviar (o pulsa ⌘⏎ con un teclado) para enviarlo al instante, como Ctrl+Enter en el terminal.

Lo que escribes se guarda como borrador de la sesión: sal de la sesión, abre otra o cierra la app, y seguirá ahí cuando vuelvas, con las fotos. La lista de sesiones marca las filas con borrador (**Borrador:** y el comienzo del texto). Enviar lo limpia; vaciar el campo lo descarta. Los borradores se quedan en el móvil y caducan a los 7 días.

- `@` completa archivos del proyecto, `/` completa los comandos de barra de Claude Code.
- El botón de la cámara adjunta fotos; el micrófono dicta en el dispositivo (elige el idioma en Ajustes → Voz).
- **Mostrar atajos de teclado** (menú) añade una barra con Esc, Ctrl+C, las flechas, Tab e Intro para los menús del propio agente.

## Permisos

Cuando el agente pide permiso, la app muestra la herramienta y el comando o archivo, con **Permitir**, **Denegar** y **Siempre**. "Siempre" escribe una regla en los ajustes del agente, para el proyecto o para tu usuario, exactamente como haría el diálogo del terminal; Ajustes → Permisos → **Reglas** lista todas las reglas de "permitir siempre" del ordenador: las creadas desde un dispositivo se pueden deshacer, y las que escribiste en el ordenador solo se pueden borrar ahí, tras Face ID o el código del dispositivo (queda una copia de seguridad del archivo de ajustes al lado). **Actividad** muestra lo que cada dispositivo permitió, denegó, deshizo y borró en los últimos 30 días, nunca la entrada de la herramienta. En el ordenador, `remote-harness rules list`, `remote-harness rules undo <id>` y `remote-harness approvals list` hacen lo mismo. El daemon espera tu respuesta unos minutos antes de dejar que el diálogo del terminal tome el control, así que una petición sin responder nunca bloquea la sesión para siempre. Cuando el agente hace una pregunta con opciones, las opciones también se muestran.

El chip de **modo** cambia el modo de permisos: predeterminado, aceptar ediciones, plan y auto. La app nunca ofrece "bypass permissions".

## Terminal en bruto

**Ver terminal** (menú, o el botón de terminal en la cabecera) muestra el propio panel de tmux, para menús y todo lo que la vista estructurada no cubre, con la misma barra de teclas. En las sesiones de solo lectura (sin panel de tmux) no se puede escribir.

## Ejecutar un comando

**Ejecutar comando…** (menú de la sesión) ejecuta un comando de shell en la carpeta de la sesión en el ordenador, como el `!` de Claude Code, y muestra la salida en directo: `git status`, `ls`, `pnpm test`. La app pide confirmación antes de cada comando; **Detener** lo termina, **Copiar salida** la copia y **Añadir al prompt** pone el comando y su salida en el compositor como bloque de código para el agente, sin enviarlo. Está desactivado hasta que ejecutes `remote-harness commands on` en el ordenador; los comandos tienen límite de tiempo y de salida, y nada interactivo funciona (no hay entrada de teclado).

## Revisar cambios

**Revisar cambios** (menú de la sesión) lista los archivos del checkout (o worktree) de la sesión que difieren de `HEAD`: añadidos, modificados, borrados, renombrados y sin seguimiento, con los recuentos `+añadidas −borradas`, sin preguntar al agente. Toca un archivo para ver su diff; los lockfiles, los archivos generados (`dist/`, `*.generated.ts`) y los diffs grandes empiezan plegados, los binarios solo dicen "binario modificado", y los diffs largos cargan 2.000 líneas cada vez con **Mostrar el resto**. La lista se actualiza mientras la sesión trabaja y al deslizar, haga lo que haga la sesión.

Desde la misma pantalla puedes cerrar el ciclo: desmarca los archivos que se quedan fuera, escribe el mensaje del commit o toca **Generar** (el propio Claude Code de la sesión lo escribe a partir del diff, con un modelo pequeño y sin herramientas), y luego **Hacer commit**, **Push** y **Abrir PR**. Cada uno muestra antes lo que toca: los archivos, la rama y el remoto. En la rama por defecto el commit ofrece crear antes una rama nueva, con el nombre sacado del mensaje; un push directo a `main` o `master` recibe un aviso. **Abrir PR** usa `gh` cuando está instalado en el ordenador (el título y la descripción también se pueden generar); sin él, **Push y comparar** hace el push y abre la página "compare & open PR" de GitHub. Mientras el agente trabaja estos botones lo esperan, con un **Hacerlo igualmente** tras un aviso. Son operaciones fijas del daemon, no comandos de shell, así que funcionan con `remote-harness commands` desactivado.

## Subagentes

Mientras el agente delega trabajo, el menú de la cabecera muestra **Subagentes (N · M en marcha)**; la hoja lista cada uno con su descripción, estado, número de herramientas y hora de inicio, además de las tareas en segundo plano.

## Abrir, reanudar y cerrar sesiones

**Nueva sesión** (el botón `+`) pide el perfil, el modelo cuando el perfil tiene un proveedor, y el directorio: escríbelo con autocompletado, navega por las carpetas o elige uno reciente (con su rama y cuántas veces se usó esta semana). Activa **Copia aislada (git worktree)** para abrir Claude Code con `--worktree`: trabaja en su propia rama en `<repo>/.claude/worktrees/<nombre>`, así dos sesiones pueden compartir un repositorio sin tocarse. La copia conserva los permisos locales del proyecto: Claude Code lee desde el worktree el `.claude/settings.local.json` del checkout principal (o lo copia), y copia los archivos ignorados por git listados en `.worktreeinclude` en la raíz del repositorio (sintaxis de gitignore, p. ej. `.env`). La pantalla lista bajo el interruptor lo que se lleva. Abrir en un checkout que otra sesión en vivo ya usa pide confirmación antes. Un **Nombre** opcional (con la rama y nombres de sesiones recientes como sugerencias) se convierte en el título de la sesión al momento, en el `--name` de Claude Code y en el nombre del worktree cuando la copia aislada está activada.

**Reanudar** vuelve a abrir una sesión terminada o de solo lectura dentro de tmux, con el mismo historial. **Cerrar** termina la sesión; cuando se ejecutó en un worktree, la app ofrece borrarlo solo si está limpio y subido, hacer commit y push antes, o descartar el trabajo, preguntando dos veces antes de descartar nada.

## Estado en vivo

En iOS, una sesión en marcha muestra una Live Activity en la pantalla de bloqueo y en la Dynamic Island con el estado, el paso actual y el tiempo transcurrido; una petición de permiso añade los botones Permitir y Denegar. En Android es una notificación silenciosa sin botones: tócala para responder en la app. Nunca lleva la conversación. Desactívalo en Ajustes → Notificaciones → Estado en vivo.

## Notificaciones y silencio

Las notificaciones push avisan cuando una sesión necesita un permiso, termina un turno o hace una pregunta; llevan un título, el perfil y el id de la sesión, nunca el contenido. Ajustes → Notificaciones tiene el interruptor de este móvil, un botón de prueba y el interruptor del estado en vivo. Silencia un perfil o una sesión desde su fila o desde el menú de la sesión; la fila **Silenciados** de Ajustes lista todo lo silenciado.

La notificación de una sesión que terminó o te espera tiene acciones: **Responder** (escribe, o dicta con el micrófono del teclado), **Responder por voz** (abre la sesión ya grabando y envía cuando terminas), **Interrumpir** (Escape) y, cuando hay prompts en cola, **Enviar el siguiente de la cola**. Las notificaciones de permiso siguen solo con Permitir y Denegar. Toda acción pide el móvil desbloqueado, y la respuesta va del móvil directamente al ordenador por la conexión cifrada, nunca por el relay de push. En Android las acciones llegan con las builds de la app desde esta versión; las antiguas muestran la notificación simple.

## Siri y Atajos

En iOS 16 o posterior, Siri y la app Atajos actúan en el ordenador activo sin tocar la app: **Responder a una sesión** ("Responder en Remote Harness" y dicta el mensaje; va a la sesión que te necesita, o a la que nombres), **Responder al permiso pendiente** ("Responder a Remote Harness": Siri lee lo que pide el permiso más antiguo y confirma antes de permitir o denegar) y **Qué está esperando** ("Qué está esperando en Remote Harness"). Las preguntas y los planes siguen necesitando la app. Toda acción pide el móvil desbloqueado y va directamente al ordenador por la conexión cifrada. Con la app cerrada, Siri pide continuar en Remote Harness (iOS 17 o posterior) y termina allí. Los títulos de sesión que se ofrecen a Siri se quedan en el móvil.

## Perfiles y OpenRouter

Un perfil es una cuenta de Claude Code, es decir un `CLAUDE_CONFIG_DIR`, con nombre, color y alias. Un perfil también puede enrutar Claude Code por **OpenRouter**: sus filas muestran un chip discontinuo `vía OpenRouter`, **Nueva sesión** gana una fila **Modelo** con un selector con búsqueda (tamaño del contexto, precios por millón de tokens, soporte de herramientas, razonamiento y caché, créditos restantes), y **Cambiar modelo…** en el menú de la sesión cambia una sesión en marcha. La clave se queda en el ordenador: consulta [el daemon](/es/docs/daemon/#perfiles-y-openrouter).

Un perfil también puede ejecutar **Codex** (insignia `cx`, verde): sus sesiones muestran la política de aprobación (`on-request`, `never`…) en lugar del chip de modo, llamadas `exec(…)` y `apply_patch(…)` con su salida y diff, y aprobaciones con Permitir / Denegar. Consulta [Perfiles de Codex](/es/docs/daemon/#perfiles-de-codex).

## Ajustes

- **Máquina**: la conexión y su camino (directo o por relay), el nombre de la máquina (un alias a tu elección, si no su hostname), la versión del daemon y **Olvidar esta máquina**.
- **Ordenadores**: todos los ordenadores emparejados; cambiar, renombrar en este dispositivo, olvidar o añadir otro.
- **Dispositivos**: los móviles y tabletas emparejados con este ordenador y cuándo se vio cada uno por última vez. **Añadir dispositivo** muestra un código de emparejamiento de un solo uso (QR y enlace, válido 5 minutos) para escanear con el otro dispositivo; **Revocar** desconecta uno al momento, y tiene que volver a emparejarse.
- **Apariencia**: Sistema, Oscuro, Claro, Dracula, Catppuccin Mocha y Catppuccin Latte.
- **Perfiles**: cada perfil con su agente, alias, carpeta de config, interruptor de notificaciones y, con proveedor, el proveedor, el modelo predeterminado y los créditos.
- **Notificaciones**: push para este móvil, prueba, estado en vivo, los perfiles y sesiones silenciados.
- **Voz**: el idioma de la transcripción.
- **App**: versión, actualizaciones over-the-air y su canal, **Buscar actualizaciones**, **Documentación**.
- **Informes de errores**: enviar automáticamente, preguntar cada vez (predeterminado) o nunca, e **Informar de un problema** (describe el fallo, mira exactamente lo que se enviará y envíalo, compártelo o abre una issue en GitHub). Los informes nunca llevan el contenido de tus sesiones; consulta la [política de privacidad](/es/docs/privacy/).

## iPad y teclados

En un iPad (o cualquier pantalla ancha) la lista y la conversación van lado a lado, y un panel inspector aloja el terminal, los subagentes y los detalles de la sesión. Con un teclado físico, ⌘⏎ envía ya, Intro envía o inserta un salto de línea según el ajuste del compositor, y los atajos aparecen en las pistas de teclas.
