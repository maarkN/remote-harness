---
title: Servidor en la nube
description: Ejecutar el daemon en una VM en la nube (AWS, DigitalOcean, GCP, Oracle): puertos y cortafuegos, el servicio sin sesión iniciada, el terminal por SSH, conexiones inestables.
applies: 0.21+
---

El daemon funciona en una VM en la nube igual que en un ordenador en casa: instálalo con el instalador de una línea por SSH, ejecuta `remote-harness setup` y empareja el móvil escaneando el código QR que la instalación muestra en el terminal. Esta página cubre lo que cambia en un servidor: nadie tiene la sesión iniciada, llegas a él por SSH y la red está detrás del cortafuegos del proveedor.

## Puertos y red

**No hace falta ningún puerto de entrada.** El daemon abre una conexión saliente a su [relay de conexión](/es/docs/daemon/#alojar-tu-propio-relay-de-conexion) y la app se encuentra con él allí, cifrado de extremo a extremo. La VM solo necesita HTTPS saliente (TCP 443) hacia:

- `us.relay.remoteharness.app` y `br.relay.remoteharness.app`, los relays de conexión (o el tuyo);
- `push.remoteharness.app`, para las notificaciones, salvo que uses tu propia cuenta de servicio de Firebase;
- `github.com`, para `remote-harness update`.

La mayoría de los proveedores permiten todo el tráfico saliente por defecto. En una red que filtra la salida, permite esos hosts; `remote-harness doctor` dice si los relays responden.

El **camino directo** (el WebSocket en el puerto `7337`, `wsPort` en la configuración) es opcional en un servidor. El daemon anuncia las direcciones de sus propias interfaces de red, y en AWS, GCP y Oracle Cloud la IP pública no es una de ellas (el proveedor la traduce), así que el móvil solo llega a esas direcciones por una VPN como Tailscale o WireGuard, cuya dirección de interfaz el daemon también anuncia. Los bridges de contenedores y de VM (`docker0`, `br-…`, `virbr0`…) quedan fuera. En DigitalOcean la IP pública está en `eth0`, así que abrir el `7337` hace que el camino directo funcione desde cualquier lugar; el canal sigue cifrado con Noise y solo entran móviles emparejados, pero prefiere la VPN o limita la regla a direcciones de confianza. Nunca abras el puerto de los hooks (`7338`): solo escucha en `127.0.0.1`.

### Reglas de cortafuegos por proveedor

Solo para el camino directo; sáltate esta sección cuando el relay baste.

| Proveedor | Dónde | Regla |
| --- | --- | --- |
| AWS EC2 / Lightsail | El security group de la instancia (Lightsail: Networking → IPv4 firewall) | Entrada TCP `7337` desde tu rango de origen |
| DigitalOcean | Networking → Firewalls (Cloud Firewall asociado al droplet) | Entrada TCP `7337` desde tu rango de origen |
| Google Cloud | VPC network → Firewall | `gcloud compute firewall-rules create remote-harness --allow tcp:7337 --source-ranges <rango> --target-tags remote-harness`, y la etiqueta en la VM |
| Oracle Cloud | La security list de la subred o el network security group de la VNIC, **y** el `iptables` de la propia VM | Entrada TCP `7337`, luego `sudo iptables -I INPUT -p tcp --dport 7337 -j ACCEPT` y `sudo netfilter-persistent save` (las imágenes Ubuntu de Oracle rechazan todo salvo SSH en `iptables`) |

Con `ufw` en la VM, ejecuta también `sudo ufw allow 7337/tcp`. Para apagar del todo el camino directo, pon `"direct": "off"` en el [archivo de configuración](/es/docs/daemon/#archivo-de-configuracion).

## Mantener el daemon en marcha sin sesión iniciada

- **Servicio**: `remote-harness service install` (la instalación ya lo hace) crea una unidad de usuario de systemd. Una unidad de usuario se detiene cuando termina tu última sesión SSH, salvo que el linger esté activado; la instalación ofrece `loginctl enable-linger`, o ejecuta `sudo loginctl enable-linger "$USER"` tú mismo. `loginctl show-user "$USER" -p Linger` debe decir `Linger=yes`, y `remote-harness service status` que la unidad está activa.
- **Claves**: el daemon guarda sus claves en el Secret Service cuando `secret-tool` está instalado y un llavero responde. Un servidor sin sesión de escritorio no suele tener llavero, así que el daemon usa un archivo `0600` en `~/.remote-harness/secrets/` y recuerda esa elección. `remote-harness doctor` muestra el almacén en uso; `REMOTE_HARNESS_TOKEN_STORE=file` fuerza el archivo. Cambiar de almacén pierde las claves: vuelve a emparejar el móvil después.
- **Sin systemd** (algunas imágenes de contenedor): ejecuta `remote-harness start` en una ventana de tmux y vuelve a conectarte tras un reinicio.
- **Suspensión**: una VM en la nube no se suspende por inactividad, así que la opción de mantener despierto no cambia nada allí. Detener la instancia (o que se recupere una instancia spot) detiene el daemon y las sesiones con él; el servicio vuelve con la VM, las sesiones de tmux no.

## El terminal por SSH

- **`TERM`**: entrar por SSH desde Ghostty o kitty envía un tipo de terminal que el servidor puede no conocer (`xterm-ghostty`, `xterm-kitty`). Los lanzadores recurren a `xterm-256color`; para conservar las funciones de tu terminal copia su descripción: `infocmp -x "$TERM" | ssh <host> -- tic -x -`. Mira [el alias dice "missing or unsuitable terminal"](/es/docs/troubleshooting/#el-alias-dice-missing-or-unsuitable-terminal).
- **Locale**: las imágenes mínimas a menudo no tienen un locale UTF-8, y entonces tmux dibuja mal los recuadros y los acentos. Instala uno y defínelo en el perfil del shell: `sudo locale-gen es_ES.UTF-8` (Debian/Ubuntu), luego `export LANG=es_ES.UTF-8` en `~/.profile`. El propio daemon ya ejecuta tmux en modo UTF-8.
- **Adjuntar**: tu alias abre la sesión en la sesión `claude-remote` de tmux y se adjunta a ella; desconéctate con `Ctrl-b d` antes de cerrar el SSH. La sesión sigue en marcha y controlable desde el móvil.

## Conexiones inestables

Los keepalives son más cortos que cualquier tiempo de inactividad habitual: el relay hace ping al daemon y al móvil cada 25 s, el daemon corta una conexión con el relay que lleva 90 s en silencio y se reconecta, y la app hace ping a una conexión tranquila cada 30 s y sustituye la que no responde en 10 s. Las pasarelas NAT (AWS 350 s, Google Cloud NAT 20 minutos) y los balanceadores de carga (normalmente de 60 a 350 s) por tanto no deberían cortar una conexión en uso.

Si la app sigue reconectándose:

- Actualiza los dos lados: `remote-harness update` en el servidor y la app en Ajustes → App. Las versiones anteriores dejaban que el relay cerrara una conexión tranquila a los 10 minutos, y la app probaba todas las direcciones anunciadas antes del relay en cada reconexión.
- Busca `relay connection closed` y `relay connection failed` en `~/.remote-harness/logs/daemon.log`: muchas apuntan a la red del servidor (un proxy de salida, un cortafuegos que corta conexiones largas). `remote-harness doctor` comprueba que los relays responden.
- No pongas el puerto del daemon detrás de un balanceador de carga: el camino por el relay no necesita nada de entrada. Si expones el `7337` a través de uno, activa el soporte de WebSocket y pon su tiempo de inactividad en al menos 60 s.
- Un cortafuegos que descarta en silencio (en lugar de rechazar) el puerto `7337` no molesta: la app abandona una dirección directa a los 3 s y, una vez conectada por el relay, se reconecta por él primero.

La investigación detrás de estos valores está en la [issue #442](https://github.com/maarkN/remote-harness/issues/442). ¿Sigue sin funcionar? Abre una issue con la salida de `remote-harness doctor` y las líneas del registro del daemon alrededor de las caídas, como en [pedir ayuda](/es/docs/troubleshooting/#pedir-ayuda).
