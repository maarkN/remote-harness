---
title: Política de privacidad
description: Qué recopila Remote Harness (solo los informes de errores y los datos de rendimiento que aceptes enviar), qué se queda en tus dispositivos, qué sale de tu máquina y cuándo, y cómo contactarnos.
applies: 0.7+
---

Remote Harness es software autoalojado: el daemon se ejecuta en tu ordenador, la app en tu móvil, y ambos hablan por tu propia red Tailscale. Esta página es la política de privacidad de la app distribuida por las tiendas, del daemon y de este sitio web, publicada por Alvyn Tech ("nosotros"). Su dirección corta es [remoteharness.app/privacy](/privacy). Última actualización: 2026-10-24.

## Qué recopilamos

Solo los informes de errores y los datos de rendimiento que aceptes enviar. No hay cuenta ni analítica, y la app, el daemon y este sitio no recopilan nada más. Los mantenedores nunca reciben tus conversaciones, tus archivos, tus prompts, tus tokens ni tus claves.

**Informes de errores (opcionales).** La app guarda en el móvil un pequeño registro de sus propios errores. Los envía a Firebase Crashlytics (Google) solo como elijas en Ajustes → Informes de errores: tras preguntarte, que es lo predeterminado, automáticamente, o nunca. Un informe contiene la hora y el tipo de error, el nombre del error, el mensaje y la pila ya filtrados, el tipo de la petición que falló y el código de error, el patrón de ruta de la pantalla, y las versiones de la app, de la actualización, del sistema y del daemon; Crashlytics añade el modelo del dispositivo y un id de instalación. Los informes nunca incluyen prompts, conversación, salida del terminal, comandos, rutas de archivos, nombres de proyectos o sesiones, tokens ni datos de emparejamiento. En Ajustes → Informar de un problema también puedes compartir un informe o publicarlo como issue en GitHub. El tratamiento de los datos de Crashlytics por parte de Google se rige por la política de privacidad de Google.

**Datos de rendimiento (opcionales, desactivados por defecto).** Con Ajustes → Informes de errores → Enviar datos de rendimiento activado, la app envía a Firebase Performance Monitoring (Google) cuánto tarda en arrancar y en llegar a tu ordenador, sus fotogramas lentos y congelados, con qué frecuencia y durante cuánto tiempo se bloquea su JavaScript (con la clase de diseño: móvil, tableta o ancho) y, en iOS, el tiempo de sus propias peticiones al relay de push y al servidor de actualizaciones. Firebase añade el modelo del dispositivo, las versiones del sistema y de la app, el país y un id de instalación. Estos datos nunca incluyen tus sesiones, prompts, rutas, nombres ni la dirección de tu ordenador. Desactivar la opción detiene el envío en ese móvil.

## Qué se queda en tus dispositivos

- En el móvil: las claves del emparejamiento (en el almacenamiento seguro del sistema, solo en este dispositivo), las preferencias de la app (tema, idioma, nombre de la máquina, opciones de notificación), los borradores de prompts sin enviar de cada sesión (en el almacenamiento seguro del sistema, nunca enviados a ningún sitio, borrados al enviarlos, a los 7 días o al olvidar la máquina) y nada más de las conversaciones más allá de lo que hay en pantalla.
- En el ordenador: la configuración del daemon, la lista de sesiones conocidas, sus registros y las claves de proveedor en el almacén seguro del sistema.

Borrar la app y ejecutar `remote-harness uninstall` lo elimina todo.

## Qué sale de tu máquina, y cuándo

- **Entre tu móvil y tu ordenador**: la conversación, los permisos que respondes y los prompts que envías viajan solo por tu red Tailscale, cifrados de extremo a extremo con las claves del emparejamiento. Nada de eso nos llega. Los comandos ejecutados desde la app (**Ejecutar comando…**, desactivado por defecto) y su salida hacen el mismo camino, solo hasta el móvil que los inició, y nunca se guardan. Con **Mejorar dictado** activado (desactivado por defecto), el texto transcrito de un dictado va a tu ordenador, donde el propio comando `claude` de la sesión lo reescribe con tu cuenta de Anthropic, como cualquier prompt que envías; el audio nunca sale del móvil.
- **Notificaciones push (opcional)**: un título, el nombre del perfil, el id de la sesión y el tipo de evento pasan por Firebase Cloud Messaging (Google) hasta tu móvil; el estado en vivo añade el título de la sesión, la carpeta, el estado, el paso actual (la herramienta y un objetivo corto: el nombre de un archivo sin la carpeta, el programa de un comando, el host de una dirección web o el tipo de un subagente, nunca argumentos, contenido de archivos ni términos de búsqueda) el progreso de la lista de tareas y una frase fija de lo que hace la sesión (como "Ejecutando pruebas…"). Solo si activas Ajustes → Notificaciones → Mostrar la tarea actual en la pantalla de bloqueo (desactivado por defecto), lleva también la tarea en curso de la lista de tareas de la sesión, con hasta 48 caracteres. El relay de push es un pequeño servicio que mantenemos, que reenvía esos mismos mensajes y no guarda nada; con tu propio proyecto de Firebase, nada pasa por nosotros. El tratamiento de Firebase Cloud Messaging por parte de Google se rige por la política de privacidad de Google.
- **Actualizaciones**: el daemon consulta el remoto de git del código instalado en busca de versiones nuevas; la app consulta el servidor de actualizaciones configurado en su build en busca de JavaScript nuevo (la petición lleva la versión de la app y la plataforma, ningún dato personal).
- **Perfiles de OpenRouter (opcional)**: las peticiones del catálogo de modelos y de créditos van de tu ordenador a OpenRouter con tu clave; ningún tráfico de modelos pasa por nosotros.
- **Este sitio web**: servido desde el servidor del propio proyecto a través de Cloudflare, y ambos registran peticiones como cualquier alojamiento; las fuentes vienen de Google Fonts. Sin cookies, sin analítica.

## Permisos que pide la app

- **Cámara**: para escanear el código de emparejamiento y adjuntar fotos a un prompt.
- **Micrófono y reconocimiento de voz**: para dictar prompts; la transcripción se hace en el dispositivo.
- **Notificaciones**: para el push y el estado en vivo, que puedes desactivar cuando quieras.

## Cómo se protegen tus datos

El tráfico entre el móvil y el ordenador va cifrado de extremo a extremo con el protocolo Noise, con claves que solo tienen el móvil y el ordenador, y pasa por Tailscale (WireGuard), la única interfaz en la que escucha el daemon. Los informes de errores, los datos de rendimiento, los mensajes de push y las actualizaciones viajan por HTTPS. Las actualizaciones van firmadas, y la app rechaza una sin firma válida. Las claves y los borradores se guardan en el almacenamiento seguro del sistema.

## Tus opciones y solicitudes

- Desactiva los informes de errores y los datos de rendimiento cuando quieras en Ajustes → Informes de errores; no se envía nada más desde ese móvil.
- Borra lo que se queda en tus dispositivos olvidando la máquina en la app, borrando la app y ejecutando `remote-harness uninstall`.
- Para acceder a los informes de errores y datos de rendimiento ya enviados a Firebase o borrarlos, escribe a [privacy@remoteharness.app](mailto:privacy@remoteharness.app). No llevan nombre ni cuenta, así que indícanos la fecha aproximada y el modelo del dispositivo, y borramos los datos correspondientes. Firebase también los borra por sí mismo tras su plazo de retención ([privacidad de Firebase](https://firebase.google.com/support/privacy)).

## Menores

Remote Harness no está dirigido a menores de 13 años y no recopila datos de nadie.

## Cambios y contacto

Remote Harness lo publica Alvyn Tech. Preguntas y solicitudes sobre privacidad: [privacy@remoteharness.app](mailto:privacy@remoteharness.app). Esta política solo cambia a través del [repositorio](https://github.com/maarkN/remote-harness), donde su historial es público, y la fecha de arriba cambia con ella. Las demás preguntas van a una issue de GitHub; los informes de seguridad, a través de [GitHub Security Advisories](https://github.com/maarkN/remote-harness/security/advisories/new), como se describe en [Seguridad y privacidad](/es/docs/security/).
