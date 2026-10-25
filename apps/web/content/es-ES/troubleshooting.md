---
title: Resolución de problemas
description: Conexión, relay de conexión, push, suspensión, sesiones de solo lectura, alias, WSL, versiones distintas, OpenRouter.
applies: 0.7+
---

Empieza por `remote-harness doctor` en el ordenador: comprueba las herramientas, la configuración, los perfiles y sus claves de proveedor, la identidad del daemon, si los relays de conexión responden, el servicio, el push y los móviles registrados, e imprime el comando que arregla cada comprobación fallida.

## La app no se conecta

- En casa la app llega al ordenador directamente por la red de casa; fuera, pasa por el relay de conexión, ambos con cifrado de extremo a extremo. El ordenador y el móvil deben tener conexión. Si solo se conecta en casa, consulta [fuera de casa](#el-movil-no-llega-al-ordenador-fuera-de-casa).
- El daemon debe estar en marcha: `remote-harness service status`, o `remote-harness start` en un terminal para ver el registro.
- Una reinstalación que borró las claves del daemon obliga a emparejar de nuevo: **Olvidar esta máquina** en Ajustes y escanear un nuevo `remote-harness pair`. Tras la actualización que trajo el cifrado de extremo a extremo, cada móvil se empareja una vez más; la pantalla de emparejamiento lo avisa.
- "Ya se usó o caducó": un código de emparejamiento funciona una vez, durante 5 minutos. Ejecuta `remote-harness pair` para obtener otro.
- En un simulador o emulador, usa `remote-harness start --dev` y `remote-harness pair` y pega el enlace en la pestaña **Pegar enlace** de la app (emulador de Android: ejecuta también `adb reverse tcp:7337 tcp:7337`).

## La app dice que el ordenador no responde

Cuando el ordenador emparejado no responde en absoluto, la lista de sesiones muestra la misma lista de comprobaciones, además de **Reintentar** y un enlace a esta página: el ordenador está encendido y despierto (sin suspenderse, con la tapa abierta o configurado para no suspenderse), el daemon está en ejecución (`remote-harness status`), y el ordenador y este móvil tienen conexión. Las secciones de esta página detallan cada uno de estos puntos; el aviso desaparece por sí solo en cuanto se abre la conexión.

## El móvil no llega al ordenador fuera de casa

Fuera de casa la app pasa por el relay de conexión. Si se conecta en casa pero no fuera:

- `remote-harness doctor` muestra si los relays de conexión responden desde el ordenador.
- Un firewall o proxy que bloquea `wss://` de salida (puerto 443) hacia el relay deja al daemon fuera de él: permite `us.relay.remoteharness.app` y `br.relay.remoteharness.app`, o [aloja el tuyo](/es/docs/daemon/#alojar-tu-propio-relay-de-conexion).
- `"relay": "off"` en la configuración deja al daemon fuera de los relays; entonces solo funciona el camino directo.
- Un daemon iniciado con `--dev` nunca usa un relay.

## El push no llega

- La app necesita el permiso de notificaciones; Ajustes → Notificaciones muestra el estado y tiene **Enviar notificación de prueba**.
- `remote-harness push status` muestra el modo: el relay (el build de la app necesita la URL del relay), tu cuenta de servicio de Firebase en `~/.remote-harness/firebase-service-account.json`, u `off` en la configuración.
- Un perfil o una sesión puede estar silenciado: mira la fila **Silenciados** en Ajustes.
- Con el relay, cada móvil necesita un grant: `doctor` avisa cuando ninguno lo tiene.
- En Android, las notificaciones usan el canal de alta prioridad `claude-remote`; comprueba que no esté silenciado en los ajustes del sistema. Los botones Permitir y Denegar no aparecen en las notificaciones de Android: toca para responder en la app.

## El ordenador se suspende o se bloquea

El daemon solo funciona con el ordenador despierto. Bloquear la pantalla no molesta. Por defecto, el servicio en segundo plano impide la suspensión por inactividad mientras una sesión está en marcha o esperando, y durante 10 minutos después; la pantalla sigue apagándose y bloqueándose. Cámbialo con `remote-harness keep-awake off`, `sessions` o `always`; `doctor` muestra si lo está manteniendo. Un portátil sigue suspendiéndose al cerrar la tapa, salvo enchufado y con monitor externo. Cuando la app dice que el ordenador no responde, probablemente está dormido: despiértalo y la app se reconecta sola. Las sesiones en tmux sobreviven a una desconexión de la app.

La app no puede despertar un ordenador dormido: Wake-on-LAN solo funciona en la red del propio ordenador. Si el ordenador admite Wake-on-LAN (normalmente por cable de red) y otro dispositivo de la misma red siempre está encendido y es accesible desde el móvil (una Raspberry Pi, un NAS, un router con WoL), puedes despertarlo desde él, por ejemplo `ssh pi@raspberrypi wakeonlan AA:BB:CC:DD:EE:FF` con la dirección MAC del ordenador.

## macOS pide acceso a carpetas

La primera vez que una sesión trabaja en Documentos, Escritorio, Descargas o un disco externo, macOS pregunta si **Remote Harness** puede acceder a esa carpeta: permítelo una vez y queda guardado, también tras `remote-harness update`. Para no recibir una solicitud por carpeta, añade Remote Harness en Ajustes del Sistema → Privacidad y seguridad → Acceso total al disco. Si la solicitud muestra **node**, faltan las Command Line Tools: ejecuta `xcode-select --install` y luego `remote-harness service install` (`doctor` muestra esta comprobación).

## Las sesiones son de solo lectura

Una sesión abierta con `claude` a secas fuera de tmux aparece en la app pero no admite escritura. Toca **Reanudar** para volver a abrirla dentro de tmux, totalmente controlable, con el mismo historial. Abre siempre las sesiones con tu alias para evitarlo.

## No se encuentra el alias

Los lanzadores están en `~/.remote-harness/bin`, añadido al `PATH` en `~/.zshrc` y `~/.bashrc` por la instalación. Abre un terminal nuevo (o `source ~/.zshrc`); si el alias sigue faltando, ejecuta `remote-harness install`. Los lanzadores funcionan con `zsh`, que el instalador añade en Linux cuando falta.

## La app y el daemon tienen versiones distintas

La app avisa cuando el daemon es más antiguo de lo que necesita. Ejecuta `remote-harness update` en el ordenador (o actualiza desde la bandeja). La propia app se actualiza over-the-air cuando se compiló con un servidor de actualizaciones; Ajustes → App muestra la versión y **Buscar actualizaciones**.

## Windows (WSL2)

- **systemd**: el servicio en segundo plano necesita `[boot] systemd=true` en `/etc/wsl.conf`; la instalación muestra el comando y pide ejecutar `wsl --shutdown` desde PowerShell después.
- **Inicio al iniciar sesión**: WSL solo funciona mientras algo lo usa. La instalación puede crear la tarea programada de Windows "Remote Harness", que inicia la distribución al iniciar sesión; `remote-harness service uninstall` la quita. Si WSL sigue parándose al quedar inactivo, sube `vmIdleTimeout` en `[wsl2]` de `%UserProfile%\.wslconfig`.
- **Red**: el relay de conexión funciona con la red NAT por defecto de WSL2. Para que los dispositivos de la misma red usen también el camino directo, activa la red en espejo (Windows 11 22H2+): la instalación ofrece añadir `networkingMode=mirrored` en `[wsl2]` de `%UserProfile%\.wslconfig`; después ejecuta `wsl --shutdown`.
- `remote-harness doctor` muestra la distribución, el modo de red, systemd y la tarea de inicio de sesión.

## Un perfil de OpenRouter no arranca

El lanzador se niega a abrir una ventana cuando el perfil no tiene clave e imprime el comando que hay que ejecutar: `remote-harness provider key <perfil>`. `doctor` lista los perfiles con proveedor y si cada uno tiene clave. Las sesiones abiertas conservan la clave con la que empezaron; las nuevas la leen de nuevo.

## Pasar de un development build al build de la tienda

Cuando el build de TestFlight o de Google Play esté disponible, instálalo junto al build que tienes: es otra app (`com.alvyntech.remoteharness`; los builds hasta la v0.19 son `tech.doctorx.clauderemote`), así que empieza vacío. Empareja de nuevo escaneando `remote-harness pair`; el emparejamiento antiguo sigue funcionando hasta que toques **Olvidar esta máquina** en ese build. El push se registra solo en el primer arranque del nuevo build, y el ordenador descarta el registro antiguo cuando deja de conectarse. Después borra el development build.

## La app va lenta o se congela

Activa Ajustes → Informes de errores → **Enviar datos de rendimiento** en ese móvil (solo en builds con Firebase) y usa la app como siempre. Tras unos minutos, la página **Performance** de la consola de Firebase muestra, por modelo de dispositivo y sistema:

- `_app_start` y la traza `app_ready` (`ready_ms`: desde el arranque de la app hasta la primera conexión con tu ordenador; `outcome` `connected` o `timeout`);
- `js_responsiveness`: una traza por periodo en primer plano, con `stalls` (JavaScript bloqueado 1 s o más), `long_stalls` (5 s o más), `stall_max_ms` y `stall_total_ms`, filtrable por `layout`;
- fotogramas lentos y congelados en **Screen rendering**.

Un bloqueo que termina con el sistema cerrando la app pierde su última traza `js_responsiveness`. Un `app_ready` largo o un crash en Crashlytics en el siguiente arranque siguen siendo una pista. Los builds de depuración solo envían con el flag de depuración de Firebase activado.

## Pedir ayuda

Abre una issue con la salida de `remote-harness doctor`, las versiones (sistema, Node, Claude Code, app) y los registros del daemon de `~/.remote-harness/logs`, tras quitar tokens y contenido de sesiones. Los problemas de seguridad van a [Seguridad y privacidad](/es/docs/security/#informar-de-una-vulnerabilidad), nunca a issues públicas.
