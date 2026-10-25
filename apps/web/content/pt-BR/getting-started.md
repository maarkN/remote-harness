---
title: Primeiros passos
description: Requisitos, a instalação de uma linha no macOS, Linux e Windows (WSL2), o app e o pareamento.
applies: 0.7+
---

## Requisitos

- Um computador com macOS, Linux (systemd recomendado) ou Windows 10 2004+ / 11 via WSL2, com `tmux`, `git`, `rg` (ripgrep), `zsh` e `claude` (ou `codex`) no `PATH`. O instalador adiciona as ferramentas que faltam.
- Node 24+. O instalador baixa um Node privado para `~/.remote-harness/node` quando ele falta, sem mexer no Node do sistema.
- [Tailscale](https://tailscale.com) no computador e no celular, com a mesma conta (mesma tailnet).
- Um iPhone ou iPad (iOS 17+) ou um celular Android (Android 10+).

## Instalar no computador

Um endereço para todos os sistemas: `https://remoteharness.app/install` entrega ao curl o script de macOS / Linux e ao PowerShell o do Windows. Aberto no navegador do computador, mostra o comando certo com um botão de copiar. Acrescente `?ref=<branch|tag>` para outra versão, por exemplo `curl -fsSL "https://remoteharness.app/install?ref=development" | bash`.

### macOS e Linux

```bash
curl -fsSL https://remoteharness.app/install | bash
```

O instalador confere o sistema e o Node, instala as ferramentas que faltam (Homebrew no macOS; apt, dnf, pacman ou zypper no Linux, com `sudo` depois de explicar o motivo), coloca o código em `~/.remote-harness/src`, compila o daemon e abre a instalação guiada (`remote-harness setup`), que:

- encontra as suas contas do Claude Code (`~/.claude`, `~/.claude-*`) e deixa escolher quais controlar, ou cria uma nova e abre o Claude Code nela para você fazer login;
- pergunta o alias de cada uma: o comando que abre aquela conta dentro do tmux (por exemplo `pessoal`, `trabalho`);
- pode adicionar um [perfil OpenRouter](/pt-br/docs/daemon/#perfis-e-openrouter): o Claude Code pago com a sua chave do OpenRouter, que ele confere e guarda no cofre de segredos do sistema;
- instala os atalhos, a entrada no `PATH` e os hooks (com backups), e o serviço em segundo plano;
- ajuda com o Tailscale e mostra o QR code de pareamento.

Opções: `bash -s -- --yes` pula as perguntas, `bash -s -- --ref <branch|tag>` instala outra versão, `bash -s -- --update` atualiza sem a instalação guiada.

### Windows (WSL2)

O Remote Harness controla o Claude Code pelo tmux, então no Windows ele roda dentro do WSL2, onde o Claude Code também funciona melhor. No PowerShell:

```powershell
irm https://remoteharness.app/install | iex
```

O script confere o Windows 10 2004+ ou Windows 11, instala o WSL2 com Ubuntu quando falta (o Windows pede permissão de administrador; reinicie se pedir e rode o mesmo comando de novo), ajuda a criar o usuário Linux e executa o instalador Linux dentro da distribuição. Node e Claude Code precisam estar instalados dentro do WSL, não só no Windows. Opções: `& ([scriptblock]::Create((irm https://remoteharness.app/install))) -Distro Ubuntu-24.04 -Ref main -Yes -NoService`.

systemd, início no logon e Tailscale dentro do WSL estão em [Solução de problemas](/pt-br/docs/troubleshooting/#windows-wsl2).

### A partir de um clone

```bash
git clone https://github.com/maarkN/remote-harness.git
cd remote-harness
pnpm install
pnpm --filter @remote-harness/daemon build
node apps/daemon/dist/cli.js setup
```

## Instalar o app

- **iPhone e iPad**: instale pelo ar a partir do cartão **Baixar o app** em [remoteharness.app](/pt-br/#app) (abra no Safari; iOS 17+). É um build ad-hoc, então só instala em aparelhos cadastrados no time de desenvolvedor: veja [Cadastrar um iPhone ou iPad](#cadastrar-um-iphone-ou-ipad). Ou compile a partir do código: com o Xcode num Mac, `cd apps/mobile && pnpm ios` roda no simulador ou num aparelho conectado; `make install-ios` faz um release build num iPhone ou iPad conectado. O [CONTRIBUTING.md](https://github.com/maarkN/remote-harness/blob/main/CONTRIBUTING.md#building-and-releasing) tem os detalhes de assinatura.
- **Android**: pelo [Google Play (teste)](https://play.google.com/apps/test/com.alvyntech.remoteharness): entre no teste e instale pela Play Store; ou o APK dos [Releases no GitHub](https://github.com/maarkN/remote-harness/releases) (permita instalar pelo navegador quando pedir), ou `pnpm android` e `pnpm build:android` a partir do repositório.

Instale o Tailscale no celular também e entre na mesma tailnet do computador.

### Cadastrar um iPhone ou iPad

Enquanto o app não está no TestFlight, a Apple só deixa o build pelo ar instalar em aparelhos cujo identificador (UDID) está no perfil de provisionamento do time de desenvolvedor. Em qualquer outro aparelho a instalação falha. Para incluir o seu:

1. Ache o UDID: conecte o iPhone ou iPad num Mac, selecione-o no Finder e clique na linha abaixo do nome até o UDID aparecer (Control-clique para copiar). O Xcode também mostra, em Window → Devices and Simulators.
2. Mande-o em particular para o mantenedor, pelo contato em [maarkn.dev](https://maarkn.dev), não numa issue pública.
3. Depois de incluído, o próximo build publicado no link de instalação instala nesse aparelho.

Compilar a partir do código com a sua própria conta de desenvolvedor da Apple não tem essa lista: o Xcode cadastra os seus próprios aparelhos.

## Parear o celular

A instalação termina com um QR code; `remote-harness pair` pede um novo ao daemon em execução quando quiser. Cada código pareia um celular e expira depois de 5 minutos. Abra o app, escaneie e pronto: o celular cria o próprio par de chaves, guarda no armazenamento seguro e conecta pelo Tailscale, com tudo criptografado de ponta a ponta.

Instalou o app primeiro? A tela de pareamento tem um passo a passo para o lado do computador, com o comando de instalação para compartilhar.

Testando num simulador sem Tailscale: `remote-harness start --dev` prende o daemon a `127.0.0.1` e `remote-harness pair` imprime um código com esse endereço: cole o link na aba **Colar link** do app. No emulador Android rode também `adb reverse tcp:7337 tcp:7337`.

## Primeira sessão

Rode o seu alias em vez de `claude`, com os mesmos argumentos:

```bash
pessoal             # abre o Claude Code no tmux com aquela conta
trabalho --resume   # outra conta
```

As duas aparecem no app, totalmente controláveis. Sessões abertas com `claude` puro fora do tmux também aparecem, somente leitura, e podem ser retomadas pelo celular.

## Atualizar

`remote-harness update` baixa a nova versão, recompila, atualiza os hooks e reinicia o serviço sem as perguntas da instalação. O serviço em segundo plano também procura atualizações a cada 6 horas e mostra uma notificação na área de trabalho; veja [atualizações e canais](/pt-br/docs/daemon/#atualizacoes-e-canais).
