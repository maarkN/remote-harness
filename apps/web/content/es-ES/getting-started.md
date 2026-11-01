---
title: Primeros pasos
description: Requisitos, la instalación de una línea en macOS, Linux y Windows (WSL2), la app y el emparejamiento.
applies: 0.7+
---

## Requisitos

- Un ordenador con macOS, Linux (systemd recomendado) o Windows 10 2004+ / 11 mediante WSL2, con `tmux`, `git`, `rg` (ripgrep), `zsh` y `claude` (o `codex`, `gemini`, `kimi`, `qwen`) en el `PATH`. El instalador añade las herramientas que falten.
- Node 24+. El instalador descarga un Node privado en `~/.remote-harness/node` cuando falta, sin tocar el Node del sistema.
- Nada que instalar en el móvil aparte de la app, ninguna VPN: en casa la app llega al ordenador directamente, fuera a través de un relay de conexión con cifrado de extremo a extremo.
- Un iPhone o iPad (iOS 17+) o un móvil Android (Android 10+).

## Instalar en el ordenador

Una dirección para todos los sistemas: `https://remoteharness.app/install` entrega a curl el script de macOS / Linux y a PowerShell el de Windows. Abierta en el navegador del ordenador, muestra el comando correcto con un botón de copiar. Añade `?ref=<rama|tag>` para otra versión, por ejemplo `curl -fsSL "https://remoteharness.app/install?ref=development" | bash`.

### macOS y Linux

```bash
curl -fsSL https://remoteharness.app/install | bash
```

El instalador comprueba el sistema y Node, instala las herramientas que faltan (Homebrew en macOS; apt, dnf, pacman o zypper en Linux, con `sudo` tras explicar el motivo), deja el código en `~/.remote-harness/src`, compila el daemon y abre la instalación guiada (`remote-harness setup`), que:

- encuentra tus cuentas de Claude Code (`~/.claude`, `~/.claude-*`) y te deja elegir cuáles controlar, o crea una nueva y abre Claude Code en ella para que inicies sesión;
- pregunta el alias de cada una: el comando que abre esa cuenta dentro de tmux (por ejemplo `personal`, `trabajo`);
- puede añadir un [perfil de OpenRouter](/es/docs/daemon/#perfiles-y-openrouter): Claude Code pagado con tu clave de OpenRouter, que comprueba y guarda en el almacén de secretos del sistema;
- instala los lanzadores, la entrada en el `PATH` y los hooks (con copias de seguridad), y el servicio en segundo plano;
- termina con el emparejamiento: muestra el código QR de emparejamiento.

Opciones: `bash -s -- --yes` se salta las preguntas, `bash -s -- --ref <rama|etiqueta>` instala otra versión, `bash -s -- --update` actualiza sin la instalación guiada.

### Windows (WSL2)

Remote Harness controla Claude Code a través de tmux, así que en Windows se ejecuta dentro de WSL2, donde Claude Code también funciona mejor. En PowerShell:

```powershell
irm https://remoteharness.app/install | iex
```

El script comprueba Windows 10 2004+ o Windows 11, instala WSL2 con Ubuntu cuando falta (Windows pide permiso de administrador; reinicia si lo pide y vuelve a ejecutar el mismo comando), ayuda a crear el usuario de Linux y ejecuta el instalador de Linux dentro de la distribución. Node y Claude Code deben estar instalados dentro de WSL, no solo en Windows. Opciones: `& ([scriptblock]::Create((irm https://remoteharness.app/install))) -Distro Ubuntu-24.04 -Ref main -Yes -NoService`.

systemd, el inicio al iniciar sesión y la red de WSL están en [Resolución de problemas](/es/docs/troubleshooting/#windows-wsl2).

### Desde un clon

```bash
git clone https://github.com/maarkN/remote-harness.git
cd remote-harness
pnpm install
pnpm --filter @remote-harness/daemon build
node apps/daemon/dist/cli.js setup
```

## Instalar la app

- **iPhone y iPad**: instálala de forma inalámbrica desde la tarjeta **Descargar la app** de [remoteharness.app](/es/#app) (ábrela en Safari; iOS 17+). Es un build ad-hoc, así que solo se instala en dispositivos registrados en el equipo de desarrollador: consulta [Registrar un iPhone o iPad](#registrar-un-iphone-o-ipad). O compílala desde el código: con Xcode en un Mac, `cd apps/mobile && pnpm ios` la ejecuta en el simulador o en un dispositivo conectado; `make install-ios` hace un release build en un iPhone o iPad conectado. El [CONTRIBUTING.md](https://github.com/maarkN/remote-harness/blob/main/CONTRIBUTING.md#building-and-releasing) tiene los detalles de firma.
- **Android**: desde [Google Play (prueba)](https://play.google.com/apps/test/com.alvyntech.remoteharness): únete a la prueba e instálala desde Play Store; o el APK de los [Releases de GitHub](https://github.com/maarkN/remote-harness/releases) (permite instalar desde el navegador cuando lo pida), o `pnpm android` y `pnpm build:android` desde el repositorio.

No hace falta nada más en el móvil: ninguna VPN. En casa la app llega al ordenador directamente por la red de casa; fuera, pasa por el relay de conexión, que solo reenvía tráfico cifrado de extremo a extremo que no puede leer.

### Registrar un iPhone o iPad

Mientras la app no esté en TestFlight, Apple solo deja instalar el build inalámbrico en dispositivos cuyo identificador (UDID) está en el perfil de aprovisionamiento del equipo de desarrollador. En cualquier otro dispositivo la instalación falla. Para añadir el tuyo:

1. Busca el UDID: conecta el iPhone o iPad a un Mac, selecciónalo en Finder y haz clic en la línea bajo su nombre hasta que aparezca el UDID (Control-clic para copiarlo). Xcode también lo muestra, en Window → Devices and Simulators.
2. Envíalo en privado al mantenedor, por el contacto de [maarkn.dev](https://maarkn.dev), no en una issue pública.
3. Una vez añadido, el siguiente build publicado en el enlace de instalación se instala en ese dispositivo.

Compilar desde el código con tu propia cuenta de desarrollador de Apple no tiene esa lista: Xcode registra tus propios dispositivos.

## Emparejar el móvil

La instalación termina con un código QR; `remote-harness pair` pide uno nuevo al daemon en ejecución cuando quieras, igual que la bandeja y **Añadir dispositivo** en Ajustes → Dispositivos de un móvil ya emparejado. Cada código empareja un dispositivo y caduca a los 5 minutos; un ordenador admite hasta 10 dispositivos, y la app puede emparejar varios ordenadores y cambiar entre ellos. Abre la app, escanéalo y listo: el móvil crea su propio par de claves, lo guarda en el almacenamiento seguro y se conecta directamente en casa o a través del relay de conexión fuera de ella, con todo cifrado de extremo a extremo (Noise, X25519 y ChaCha20-Poly1305).

¿Instalaste primero la app? Su pantalla de emparejamiento tiene una guía paso a paso para el lado del ordenador, con el comando de instalación para compartir.

Probando en un simulador: `remote-harness start --dev` ata el daemon a `127.0.0.1` (sin usar nunca un relay) y `remote-harness pair` imprime un código con esa dirección: pega el enlace en la pestaña **Pegar enlace** de la app. En el emulador de Android ejecuta también `adb reverse tcp:7337 tcp:7337`.

## Primera sesión

Ejecuta tu alias en vez de `claude`, con los mismos argumentos:

```bash
personal            # abre Claude Code en tmux con esa cuenta
trabajo --resume    # otra cuenta
```

Ambas aparecen en la app, totalmente controlables. Las sesiones abiertas con `claude` a secas fuera de tmux también aparecen, en solo lectura, y se pueden reanudar desde el móvil.

## Actualizar

`remote-harness update` descarga la nueva versión, recompila, actualiza los hooks y reinicia el servicio sin las preguntas de la instalación. El servicio en segundo plano también busca actualizaciones cada 6 horas y muestra una notificación de escritorio; consulta [actualizaciones y canales](/es/docs/daemon/#actualizaciones-y-canales).
