---
title: Solução de problemas
description: Conexão, relay de conexão, push, suspensão, sessões somente leitura, aliases, WSL, versões diferentes, OpenRouter.
applies: 0.7+
---

Comece por `remote-harness doctor` no computador: ele confere as ferramentas, a configuração, os perfis e as chaves de provedor, a identidade do daemon, se os relays de conexão respondem, o serviço, o push e os celulares registrados, e imprime o comando que corrige cada verificação que falhou.

## O app não conecta

- Em casa o app alcança o computador direto pela rede de casa; fora dela, passa pelo relay de conexão, os dois com criptografia de ponta a ponta. O computador e o celular precisam estar online. Se só conecta em casa, veja [fora de casa](#o-celular-nao-alcanca-o-computador-fora-de-casa).
- O daemon precisa estar rodando: `remote-harness service status`, ou `remote-harness start` num terminal para ver o log.
- Uma reinstalação que apagou as chaves do daemon exige parear de novo: **Esquecer esta máquina** nos Ajustes e escanear um novo `remote-harness pair`. Depois da atualização que trouxe a criptografia de ponta a ponta, todo celular pareia mais uma vez; a tela de pareamento avisa.
- "Já foi usado ou expirou": um código de pareamento funciona uma vez, por 5 minutos. Rode `remote-harness pair` para gerar outro.
- Num simulador ou emulador, use `remote-harness start --dev` e `remote-harness pair` e cole o link na aba **Colar link** do app (emulador Android: rode também `adb reverse tcp:7337 tcp:7337`).

## O app diz que o computador não está respondendo

Quando o computador pareado não responde de forma alguma, a lista de sessões mostra a mesma checklist, além de **Tentar de novo** e um link para esta página: o computador está ligado e acordado (sem suspender, com a tela aberta ou configurado para não suspender), o daemon está em execução (`remote-harness status`), e o computador e este celular estão online. As seções desta página detalham cada um desses pontos; a mensagem desaparece por conta própria assim que a conexão abre.

## O celular não alcança o computador fora de casa

Fora de casa o app passa pelo relay de conexão. Se ele conecta em casa mas não fora:

- `remote-harness doctor` mostra se os relays de conexão respondem a partir do computador.
- Um firewall ou proxy que bloqueia `wss://` de saída (porta 443) para o relay deixa o daemon fora dele: libere `us.relay.remoteharness.app` e `br.relay.remoteharness.app`, ou [hospede o seu](/pt-br/docs/daemon/#hospedar-o-proprio-relay-de-conexao).
- `"relay": "off"` na configuração deixa o daemon fora dos relays; aí só o caminho direto funciona.
- Um daemon iniciado com `--dev` nunca usa relay.

## O push não chega

- O app precisa da permissão de notificações; Ajustes → Notificações mostra o estado e tem **Enviar notificação de teste**.
- `remote-harness push status` mostra o modo: o relay (o build do app precisa da URL do relay), a sua conta de serviço do Firebase em `~/.remote-harness/firebase-service-account.json`, ou `off` na configuração.
- Um perfil ou sessão pode estar silenciado: veja a linha **Silenciados** nos Ajustes.
- Com o relay, cada celular precisa de um grant: o `doctor` avisa quando nenhum tem.
- No Android, as notificações usam o canal de alta prioridade `claude-remote`; confira se ele não está silenciado nos ajustes do sistema. Os botões Permitir e Negar não aparecem nas notificações do Android: toque para responder no app.

## O computador suspende ou bloqueia

O daemon só funciona com o computador acordado. Bloquear a tela não atrapalha. Por padrão, o serviço em segundo plano impede a suspensão por inatividade enquanto uma sessão está rodando ou esperando, e por 10 minutos depois; a tela continua apagando e bloqueando. Mude com `remote-harness keep-awake off`, `sessions` ou `always`; o `doctor` mostra se está segurando. Um notebook ainda suspende ao fechar a tampa, a não ser na tomada e com monitor externo. Quando o app diz que o computador não responde, ele provavelmente está dormindo: acorde-o e o app reconecta sozinho. As sessões no tmux sobrevivem a uma desconexão do app.

O app não consegue acordar um computador dormindo: o Wake-on-LAN só funciona na rede do próprio computador. Se o computador aceita Wake-on-LAN (em geral pelo cabo de rede) e outro aparelho da mesma rede fica sempre ligado e é acessível pelo celular (um Raspberry Pi, um NAS, um roteador com WoL), dá para acordá-lo por ele, por exemplo `ssh pi@raspberrypi wakeonlan AA:BB:CC:DD:EE:FF` com o endereço MAC do computador.

## O macOS pede acesso a pastas

Na primeira vez que uma sessão trabalha em Documentos, Mesa, Downloads ou num disco externo, o macOS pergunta se o **Remote Harness** pode acessar essa pasta: permita uma vez e vale de vez, também depois de `remote-harness update`. Para não ter um pedido por pasta, adicione o Remote Harness em Ajustes do Sistema → Privacidade e Segurança → Acesso Total ao Disco. Se o pedido mostrar **node**, faltam as Command Line Tools: rode `xcode-select --install` e depois `remote-harness service install` (o `doctor` mostra essa verificação).

## As sessões estão somente leitura

Uma sessão aberta com `claude` puro fora do tmux aparece no app mas não aceita digitação. Toque em **Retomar** para reabri-la dentro do tmux, totalmente controlável, com o mesmo histórico. Abra as sessões sempre pelo seu alias para evitar isso.

## O alias não é encontrado

Os atalhos ficam em `~/.remote-harness/bin`, adicionado ao `PATH` em `~/.zshrc` e `~/.bashrc` pela instalação. Abra um terminal novo (ou `source ~/.zshrc`); se o alias continuar faltando, rode `remote-harness install`. Os atalhos rodam com `zsh`, que o instalador adiciona no Linux quando falta.

## App e daemon em versões diferentes

O app avisa quando o daemon é mais antigo do que precisa. Rode `remote-harness update` no computador (ou atualize pela bandeja). O próprio app se atualiza over-the-air quando foi compilado com um servidor de atualizações; Ajustes → App mostra a versão e **Verificar atualizações**.

## Windows (WSL2)

- **systemd**: o serviço em segundo plano precisa de `[boot] systemd=true` em `/etc/wsl.conf`; a instalação mostra o comando e pede para rodar `wsl --shutdown` no PowerShell depois.
- **Início no logon**: o WSL só roda enquanto algo o usa. A instalação pode criar a tarefa agendada do Windows "Remote Harness", que inicia a distribuição no logon; `remote-harness service uninstall` a remove. Se o WSL ainda parar quando ocioso, aumente `vmIdleTimeout` em `[wsl2]` no `%UserProfile%\.wslconfig`.
- **Rede**: o relay de conexão funciona com a rede NAT padrão do WSL2. Para que aparelhos na mesma rede usem também o caminho direto, ligue a rede espelhada (Windows 11 22H2+): a instalação oferece adicionar `networkingMode=mirrored` em `[wsl2]` no `%UserProfile%\.wslconfig`; depois rode `wsl --shutdown`.
- `remote-harness doctor` mostra a distribuição, o modo de rede, o systemd e a tarefa de logon.

## Um perfil do OpenRouter não abre

O atalho se recusa a abrir uma janela quando o perfil não tem chave e imprime o comando para rodar: `remote-harness provider key <perfil>`. O `doctor` lista os perfis com provedor e se cada um tem chave. Sessões abertas mantêm a chave com que começaram; as novas leem de novo.

## Migrando de um development build para a build da loja

Quando a build do TestFlight ou do Google Play estiver disponível, instale-a ao lado da build que você tem: ela é outro app (`com.alvyntech.remoteharness`; as builds até a v0.19 são `tech.doctorx.clauderemote`), então começa vazia. Pareie de novo escaneando `remote-harness pair`; o pareamento antigo continua funcionando até você tocar em **Esquecer esta máquina** naquela build. O push se registra sozinho na primeira abertura da nova build, e o computador descarta o registro antigo quando ele para de conectar. Depois apague o development build.

## O app está lento ou trava

Ligue Configurações → Relatórios de erro → **Enviar dados de desempenho** naquele celular (só nas builds com Firebase) e use o app normalmente. Depois de alguns minutos, a página **Performance** do console do Firebase mostra, por modelo de aparelho e sistema:

- `_app_start` e o trace `app_ready` (`ready_ms`: do início do app até a primeira conexão com o seu computador; `outcome` `connected` ou `timeout`);
- `js_responsiveness`: um trace por período em primeiro plano, com `stalls` (JavaScript travado 1 s ou mais), `long_stalls` (5 s ou mais), `stall_max_ms` e `stall_total_ms`, filtrável por `layout`;
- quadros lentos e congelados em **Screen rendering**.

Um travamento que termina com o sistema fechando o app perde o último `js_responsiveness`. Um `app_ready` longo ou um crash no Crashlytics na abertura seguinte ainda dão uma pista. Builds de debug só enviam com a flag de debug do Firebase ligada.

## Pedindo ajuda

Abra uma issue com a saída de `remote-harness doctor`, as versões (sistema, Node, Claude Code, app) e os logs do daemon em `~/.remote-harness/logs`, depois de remover tokens e conteúdo de sessões. Problemas de segurança vão para [Segurança e privacidade](/pt-br/docs/security/#relatar-uma-vulnerabilidade), nunca para issues públicas.
