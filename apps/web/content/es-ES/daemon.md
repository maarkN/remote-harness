---
title: El daemon
description: Comandos de la CLI, el archivo de configuración, el servicio en segundo plano, actualizaciones y canales, el icono de la bandeja, registros.
applies: 0.7+
---

El daemon se ejecuta en el ordenador: sigue los transcripts de las sesiones, controla tmux, recibe los hooks de Claude Code en `127.0.0.1` y sirve a la app por dos caminos con el mismo cifrado de extremo a extremo: directo, en un WebSocket que escucha en todas las interfaces (la red de casa, o cualquier dirección VPN del ordenador), y a través de su relay de conexión, donde mantiene una sala abierta. `remote-harness --help` es la fuente de verdad de los comandos.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `remote-harness setup` | Instalación guiada: cuentas y alias, hooks, servicio, emparejamiento. `--yes` mantiene la configuración, `--lang` elige el idioma. |
| `remote-harness start` | Ejecuta el daemon en primer plano. `--dev` lo ata solo a `127.0.0.1` y nunca usa un relay, `--host` fija la dirección directa. |
| `remote-harness pair` | Pide al daemon en ejecución un código QR de emparejamiento: empareja un móvil y caduca en 5 minutos. |
| `remote-harness doctor` | Comprueba las herramientas, la configuración, los perfiles y sus claves de proveedor, la identidad del daemon, si los relays de conexión responden, el servicio, el push y los móviles registrados. |
| `remote-harness install` / `uninstall` | Instala o quita los lanzadores, la entrada en el `PATH`, los hooks y el envoltorio de la status line, sin preguntas. |
| `remote-harness service install` / `uninstall` / `status` | El servicio en segundo plano: un LaunchAgent de launchd en macOS, una unidad de usuario de systemd en Linux y WSL. |
| `remote-harness update` | Descarga la nueva versión, recompila, actualiza los hooks y reinicia el servicio. `--ref <rama|etiqueta>` elige la versión. |
| `remote-harness updates status` / `check` / `channel [main|development]` / `auto on|off` | La comprobación de actualizaciones en segundo plano. |
| `remote-harness push status` / `test` | Modo de push en uso y móviles registrados; envía una notificación de prueba. |
| `remote-harness push off` / `on` | Detiene (o reanuda) todos los push y el estado en vivo de este ordenador, sin reiniciar el daemon. |
| `remote-harness provider key <perfil>` | Guarda la clave del proveedor (OpenRouter) de un perfil en el almacén seguro del sistema. `--stdin` la lee de una tubería. |
| `remote-harness devices list` / `revoke <id>` | Los móviles y tabletas emparejados con este ordenador (ID, nombre, plataforma, emparejado, visto por última vez); `revoke` desconecta uno, que debe volver a emparejarse. |
| `remote-harness rules list` / `undo <id>` | Las reglas "permitir siempre" creadas desde el móvil. |
| `remote-harness approvals list` | El registro de aprobaciones: lo que los dispositivos permitieron, denegaron, deshicieron y borraron (últimos 30 días). |
| `remote-harness commands [on|off]` | Muestra, permite o prohíbe ejecutar comandos de shell desde la app en la carpeta de una sesión (desactivado por defecto), aplicado al daemon en ejecución. |

El comando antiguo `claude-remote` y las variables `CLAUDE_REMOTE_*` siguen funcionando en instalaciones hechas antes del cambio de nombre.

## Archivo de configuración

`~/.remote-harness/config.json` (las instalaciones anteriores al cambio de nombre siguen usando `~/.claude-remote`):

```json
{
  "profiles": [
    { "id": "personal", "name": "Personal", "configDir": "~/.claude", "color": "#D97757" },
    { "id": "trabajo", "name": "Trabajo", "configDir": "~/.claude-work", "color": "#61AFEF" }
  ],
  "wsPort": 7337,
  "hookPort": 7338,
  "defaultRuleScope": "project",
  "permissionTimeoutSec": 280,
  "questionTimeoutSec": 3300,
  "inputStrategy": "paste",
  "recentDays": 7,
  "tmuxSession": "claude-remote",
  "push": "auto",
  "update": { "channel": "main", "auto": false },
  "tray": true,
  "relays": ["wss://us.relay.remoteharness.app", "wss://br.relay.remoteharness.app"],
  "relay": "on",
  "direct": "on"
}
```

- `profiles`: uno por cuenta de Claude Code. `id` es el alias (el nombre del lanzador), `configDir` el `CLAUDE_CONFIG_DIR` de la cuenta, `color` el color de la etiqueta en la app. Opcionales: `agent` (`claude` por defecto) y `provider` (abajo).
- `wsPort`, `hookPort`: los puertos de la app y de los hooks.
- `defaultRuleScope`: adónde van las reglas "permitir siempre" por defecto, `project` o `user`.
- `permissionTimeoutSec`: cuánto tiempo retiene el daemon una petición de permiso para el móvil antes de que el diálogo del terminal tome el control. La petición sigue en la app como "Responde en la terminal" hasta que la sesión avance.
- `questionTimeoutSec`: lo mismo para preguntas y aprobación de planes (3300 por defecto). Una pregunta todavía abierta después de 10 minutos envía un push de recordatorio. El timeout del hook escrito en la configuración del agente cubre ambos, y `remote-harness install` o `update` lo reescribe.
- `inputStrategy`: `paste` (por defecto) o `type` para los prompts enviados desde el móvil.
- `recentDays`: hasta cuándo se listan las sesiones terminadas.
- `tmuxSession`: la sesión de tmux que usan los lanzadores.
- `language`: `pt-BR`, `en-US` o `es-ES` para la CLI, la instalación y los textos de push; el idioma del sistema cuando falta.
- `push`: `auto` (tu cuenta de servicio de Firebase cuando existe, si no el relay) u `off`.
- `update`: el canal que siguen `update` y la comprobación, y si las actualizaciones se aplican solas.
- `tray`: el icono de la barra de menús / bandeja.
- `relays`: los relays de conexión que puede usar el daemon. Al iniciar los mide y mantiene la sala en el más rápido, cambiando solo cuando ese cae; cambia la lista para [alojar el tuyo](#alojar-tu-propio-relay-de-conexion).
- `relay`: `off` deja el daemon fuera de los relays (los móviles solo lo alcanzan directo). `direct`: `off` deja de escuchar conexiones directas (solo el relay). No ambos. `start --dev` nunca usa relay.
- `trayPermissions`: si la bandeja ofrece Permitir / Permitir siempre / Denegar para un permiso pendiente (activado por defecto; también en las Preferencias de la bandeja).
- `shellCommands`: `enabled` (desactivado por defecto; cámbialo con `remote-harness commands on|off`), `timeoutSec` (300) y `maxOutputKb` (1024) para los comandos ejecutados desde la app.

Los cambios en el archivo se aplican cuando el daemon se reinicia (`remote-harness service install` de nuevo, o reiniciar desde la bandeja).

## Perfiles y OpenRouter

Un perfil puede enrutar Claude Code por OpenRouter en vez de la cuenta de Anthropic. Lo más fácil es `remote-harness setup` → "Añadir un perfil de OpenRouter": pregunta el nombre, el alias, la carpeta (`~/.claude-openrouter`), un modelo por defecto opcional y la clave (oculta), comprueba la clave con OpenRouter y muestra los créditos que quedan cuando la clave puede leerlos. Al ejecutar el setup de nuevo se listan estos perfiles y puedes mantenerlos, cambiar la clave o eliminar el perfil (su lanzador, sus hooks y su clave; la carpeta se queda).

A mano: añade un `provider` con `kind: "openrouter"` y, opcionalmente, `baseUrl` (otra pasarela compatible con Anthropic), un `model` predeterminado y un `smallFastModel`.

```json
{
  "id": "openrouter",
  "name": "OpenRouter",
  "configDir": "~/.claude-openrouter",
  "color": "#8A8784",
  "provider": { "kind": "openrouter", "model": "anthropic/claude-sonnet-5.5" }
}
```

Después, `remote-harness install` regenera los lanzadores y `remote-harness provider key openrouter` guarda la clave en el mismo almacén que las claves del propio daemon (Llavero en macOS, Secret Service o archivo `0600` en Linux). El lanzador lee la clave solo dentro de la ventana de tmux, nunca en una línea de comandos, y el daemon solo la usa para mostrar tus créditos en la app. `doctor` informa de si cada perfil con proveedor tiene clave.

## Perfiles de Codex

Un perfil puede ejecutar OpenAI Codex CLI en vez de Claude Code: define `"agent": "codex"` y apunta `configDir` a la carpeta de Codex (`CODEX_HOME`, `~/.codex` por defecto). `remote-harness setup` ofrece `~/.codex` cuando Codex ya lo ha usado.

```json
{ "id": "cdx", "name": "Codex", "configDir": "~/.codex", "color": "#2FBF8F", "agent": "codex" }
```

`remote-harness install` escribe el lanzador del perfil (abre `codex` con el `CODEX_HOME` correcto) y fusiona los hooks del daemon en `<CODEX_HOME>/hooks.json`, junto a los tuyos y con copia de seguridad; tu `config.toml` no se toca. **Codex pide una vez confiar en los hooks nuevos**: abre `codex` y elige "Trust all and continue" (o revísalos en `/hooks`). Hasta entonces sus sesiones aparecen de solo lectura y las aprobaciones se quedan en el terminal. `doctor` comprueba que `codex` está en el `PATH` y que los hooks están instalados.

Lo que funciona como en Claude Code: la lista de sesiones (rollouts recientes en `sessions/`), la conversación, prompts, fotos y teclas, iniciar y reanudar desde el móvil (en un worktree con `codex --worktree`, y con nombre, enviado como `/rename`), push, estado en vivo, aprobaciones con Permitir / Denegar, Mejorar dictado y mensajes de commit generados (con `codex exec`). Diferencias: el chip de modo muestra el perfil de permisos y alterna entre solo lectura y workspace (`/permissions`, Codex 0.164 o posterior); el acceso total solo en el terminal. No hay "Siempre" (los hooks de Codex no crean reglas) ni proveedor.

## Perfiles de Gemini CLI

Un perfil puede ejecutar Gemini CLI de Google: define `"agent": "gemini"` y apunta `configDir` a una carpeta de configuración de Gemini, que siempre se llama `.gemini` (`~/.gemini` por defecto; para otra, `~/work/.gemini`, el lanzador define `GEMINI_CLI_HOME=~/work`). `remote-harness setup` ofrece `~/.gemini` cuando Gemini CLI ya la usó.

```json
{ "id": "gem", "name": "Gemini", "configDir": "~/.gemini", "color": "#E3729E", "agent": "gemini" }
```

`remote-harness install` escribe el lanzador del perfil (abre `gemini`) y combina los hooks del daemon en `<configDir>/settings.json`, junto a tus hooks y ajustes y con copia de seguridad. **Gemini CLI no ejecuta hooks en una carpeta en la que no confía**: cuando `gemini` pregunte, confía en la carpeta (o usa `/permissions`). Hasta entonces sus sesiones en esa carpeta aparecen de solo lectura y las aprobaciones se quedan en el terminal. `doctor` comprueba que `gemini` está en el `PATH` y que los hooks están instalados.

Lo que funciona como en Claude Code: la lista de sesiones (archivos de sesión recientes en `tmp/`), la conversación (los comandos de shell, ediciones y búsquedas en archivos se muestran como los de Claude Code), prompts, fotos y teclas, iniciar y reanudar desde el móvil, push y estado en vivo. Aprobaciones: los hooks de Gemini CLI no pueden aprobar una herramienta, así que cuando se abre su diálogo de aprobación el móvil recibe Permitir / Denegar y el daemon pulsa las teclas del propio diálogo en el terminal ("Allow once" o Esc); si el diálogo ya se respondió allí, la app lo indica. Diferencias: sin "Siempre", sin cambio de modo (y nunca YOLO), sin worktree ni nombre al iniciar, sin dictado con Polish ni mensajes generados, y sin proveedor.

## Lanzadores y alias

Cada perfil recibe un pequeño lanzador en zsh en `~/.remote-harness/bin/<alias>` (añadido al `PATH` en `~/.zshrc` y `~/.bashrc`). Ejecuta el alias en vez de `claude`, con los mismos argumentos: abre Claude Code en una ventana de la sesión `claude-remote` de tmux con el `CLAUDE_CONFIG_DIR` correcto y conecta tu terminal a ella. El comando `claude` a secas nunca se modifica.

## Servicio en segundo plano

`remote-harness service install` mantiene el daemon en marcha después de cerrar el terminal y lo inicia al iniciar sesión: un LaunchAgent en macOS (aparece como elemento de inicio), una unidad de usuario de systemd en Linux (`~/.config/systemd/user/claude-remote.service`). En servidores Linux a los que llegas por SSH, la instalación ofrece `loginctl enable-linger`, para que el servicio sobreviva al cierre de sesión; [Servidor en la nube](/es/docs/cloud-server/) explica cómo ejecutar el daemon en una VM en la nube. Sin systemd (contenedores, algunos WSL) ejecuta `remote-harness start` tú mismo, por ejemplo en una ventana de tmux. En WSL la instalación también puede crear una tarea programada de Windows que inicie la distribución al iniciar sesión.

`remote-harness service status` muestra si está cargado; el menú de la bandeja lo reinicia.

## Actualizaciones y canales

El servicio comprueba su canal en el remoto de git cada 6 horas y muestra una notificación de escritorio cuando hay una versión nueva (nunca en un clon de desarrollo). `remote-harness update` la aplica; `remote-harness updates auto on` deja que el daemon se actualice solo, únicamente cuando ninguna sesión está en marcha o esperando y no hay permisos pendientes, y nunca a una versión más antigua. `remote-harness updates channel development` sigue la rama de integración; volver a `main` avisa de que instala una versión más antigua.

## Icono de la bandeja

El daemon del servicio muestra un icono en la barra de menús de macOS (un pequeño ayudante en Swift compilado en el primer inicio con las Command Line Tools) y un icono en la bandeja de Linux (`python3` con GTK 3 y AyatanaAppIndicator3 o AppIndicator3). El menú muestra las sesiones en marcha y los permisos pendientes (respóndelos desde ahí), abre una sesión nueva, muestra el código de emparejamiento, comprueba o aplica actualizaciones, elige el canal, abre los registros, la configuración y la documentación, y reinicia el daemon. **Emparejar un móvil** muestra el QR de emparejamiento en el propio menú en macOS, la dirección y el emparejamiento en la terminal; cada código es de un solo uso y caduca en 5 minutos. **Preferencias** activa o desactiva las respuestas de permisos en el menú, el modo de mantener despierto y las notificaciones push, aplicados al momento, y abre el archivo de configuración para lo demás. Con el servicio, **Salir** oculta el icono o detiene el servicio hasta el próximo inicio de sesión. `"tray": false` lo desactiva; sin el ayudante, el daemon funciona sin interfaz. En WSL el icono aparece en el área de notificación de Windows: el daemon inicia un pequeño ayudante en el lado de Windows mediante interop (Windows PowerShell lo compila al arrancar; no se instala nada en Windows), así que aparece al iniciar sesión con la tarea de inicio y desaparece cuando el daemon se detiene. Tiene el mismo menú que la bandeja de Linux, las notificaciones de actualización pasan a ser notificaciones de Windows y las acciones que abren una terminal usan Windows Terminal.

En macOS el icono abre un popover en lugar de un menú: el ordenador con sus rutas (directa y/o por relay, nunca una dirección), el permiso pendiente como una tarjeta con Denegar / Siempre / Permitir, hasta cinco sesiones (haz clic para abrir una en la terminal, clic derecho para renombrarla o cerrarla), los dispositivos vinculados y si están en línea, y las acciones rápidas. La ventana de **Preferencias** tiene las pestañas General, Perfiles (renombra un perfil), Notificaciones, Red (las direcciones de la ruta directa, el relay de conexión y el relay principal, los dispositivos conectados ahora), Dispositivos (cada dispositivo vinculado, con **Revocar…**), Emparejamiento, Actualizaciones y Avanzado. En Linux el menú sigue el mismo orden, y cada dispositivo tiene un submenú **Revocar…**.

## Alojar tu propio relay de conexión

Cuando el móvil no alcanza el ordenador directamente, el daemon y la app se encuentran en un relay de conexión: `us.relay.remoteharness.app` y `br.relay.remoteharness.app` por defecto. El relay solo reenvía el tráfico que el daemon y la app cifran de extremo a extremo; no puede leer sesiones, prompts ni archivos, y no guarda registros de lo que pasa ni de direcciones IP. Ejecutar el tuyo es un contenedor:

```sh
docker build -t remote-harness-relay apps/relay
docker run -d --restart unless-stopped -p 8080:8080 remote-harness-relay
```

Ponlo detrás de un proxy que termine el TLS (Traefik, Caddy, nginx), para que se acceda por `wss://`, y define `RELAY_CLIENT_IP_HEADER` con la cabecera en la que el proxy pone la dirección del cliente (`X-Real-Ip`, por ejemplo), para que los límites por dirección vean al cliente real. `GET /healthz` responde `{"status":"ok"}`. Los límites vienen del entorno: `RELAY_MAX_DEVICES` (10 móviles por ordenador), `RELAY_MAX_FRAME_BYTES` (8 MB), `RELAY_ROOM_RATE_BYTES` y `RELAY_ROOM_BURST_BYTES` (ancho de banda por ordenador), `RELAY_IDLE_TIMEOUT`, `RELAY_IP_CONNECTS_PER_MINUTE`, `RELAY_IP_BURST` y `RELAY_IP_MAX_CONNS`.

Después añádelo al archivo de configuración del daemon, en lugar de los relays por defecto o antes de ellos:

```json
{ "relays": ["wss://relay.example.com"] }
```

Vuelve a emparejar el móvil después: el código de emparejamiento le dice a la app qué relay usar.

## Datos y registros

Todo lo que guarda el daemon está en `~/.remote-harness/`: `config.json`, `state.json` (las sesiones conocidas), `secrets/` (claves de proveedor cuando el almacén es el archivo), `models-cache.json`, `bin/` (lanzadores), `logs/` y `src/` (el código que compiló el instalador). Adjunta los registros a un informe de error tras quitar tokens y contenido de sesiones.

Variables de entorno: `REMOTE_HARNESS_HOME` cambia la carpeta de datos, `REMOTE_HARNESS_TOKEN_STORE=keychain|secret-tool|file` fuerza el almacén de secretos (las claves del daemon y las de proveedor), `REMOTE_HARNESS_LANG` fija el idioma.
