---
title: Seguridad y privacidad
description: Qué puede hacer el daemon, qué sale de tu máquina, claves y emparejamiento, y cómo informar de un problema.
applies: 0.7+
---

## Qué puede hacer el daemon

El daemon puede escribir en tus sesiones de Claude Code y aprobar llamadas a herramientas, así que en la práctica es un shell remoto en tu ordenador. Viene cerrado por defecto y nada de él es accesible desde internet.

## Red

- La app llega al daemon directo (un WebSocket en todas las interfaces del ordenador, o solo en `127.0.0.1` con `--dev`) o a través de un relay de conexión. En los dos caminos cada byte va cifrado de extremo a extremo, y una conexión que no completa el handshake con una clave emparejada no recibe nada; el relay solo reenvía texto cifrado y no puede leer tus sesiones.
- Los hooks de Claude Code llegan al daemon solo por `127.0.0.1`, con un secreto local compartido.
- `relay: off` o `direct: off` en la configuración apagan un camino; `remote-harness devices revoke <id>` desempareja un móvil al momento.

## Claves y emparejamiento

- Cada conexión es una sesión del protocolo Noise (X25519, ChaCha20-Poly1305) cifrada de extremo a extremo entre el móvil y el daemon. Las claves del daemon están en el Llavero de macOS, el Secret Service de Linux (`secret-tool`) o un archivo `0600`; cada móvil crea su par de claves al emparejarse y lo guarda en el almacenamiento seguro, solo en ese dispositivo.
- Un código de emparejamiento (`remote-harness pair`, la instalación o la bandeja) funciona una vez y solo durante 5 minutos. El daemon guarda las claves públicas de los móviles emparejados (como máximo 10) y corta cualquier conexión cuya clave no conoce, antes de enviar nada.
- Las claves de proveedor (OpenRouter) viven en el mismo almacén, en su propia cuenta. Nunca se escriben en `config.json`, `settings.json`, archivos del shell ni lanzadores, nunca se registran y nunca se envían al móvil: el lanzador lee la clave dentro de la ventana de tmux, y el daemon solo la usa para pedir al proveedor tus créditos.

## Qué sale de tu máquina

- Las notificaciones push llevan un título, el perfil y el id de la sesión. El estado en vivo añade el nombre de la sesión, la carpeta, el estado, el paso actual (la herramienta y un objetivo corto, como el nombre de un archivo o el programa de un comando, nunca sus argumentos) y el progreso de las tareas. Nunca la conversación.
- Con el relay de push, el relay ve esos mismos mensajes sin contenido y un grant sellado (tu token de FCM); no guarda nada. Con tu propio proyecto de Firebase, nada pasa por nadie más.
- El daemon no envía telemetría. La comprobación de actualizaciones habla con el remoto de git del código instalado.
- Las peticiones de catálogo y créditos de OpenRouter van del ordenador a OpenRouter, y a nadie más.

## Comandos de shell

Ejecutar comandos desde la app (**Ejecutar comando…**) viene desactivado y solo puede activarse desde el ordenador (`remote-harness commands on`). Activado, un móvil emparejado puede ejecutar cualquier comando con tu usuario en la carpeta de una sesión, por eso la app confirma cada comando antes. Cada ejecución tiene límite de tiempo y de salida, se termina con todo su grupo de procesos al cancelar, y la salida va solo al móvil que la inició: los comandos y su salida nunca se registran, se guardan, se envían a otros móviles ni van en una notificación push.

## Permisos

La app nunca ofrece el modo "bypass permissions" del agente. "Permitir siempre" escribe una regla en los ajustes del propio Claude Code, para el proyecto o para tu usuario, y `remote-harness rules undo` la revierte. Una petición sin responder vuelve al diálogo del terminal pasados unos minutos.

## Tus archivos

El instalador edita `settings.json`, `~/.zshrc` y `~/.bashrc` siempre de la misma manera: lee, fusiona, hace copia de seguridad, escribe de forma atómica. `remote-harness uninstall` quita exactamente lo que añadió. El comando `claude` a secas nunca se modifica.

## Informar de una vulnerabilidad

Por favor, no abras una issue pública. Informa en privado a través de [GitHub Security Advisories](https://github.com/maarkN/remote-harness/security/advisories/new) con una descripción, el impacto, los pasos para reproducirla (versiones del sistema, de Node, de Claude Code y de la app) y cualquier corrección sugerida. Recibirás un acuse en pocos días; una vez corregida, el aviso se publica con crédito, salvo que prefieras permanecer anónimo. Solo la última versión en `main` recibe correcciones de seguridad. La política completa está en [SECURITY.md](https://github.com/maarkN/remote-harness/blob/main/SECURITY.md).
