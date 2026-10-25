---
title: Segurança e privacidade
description: O que o daemon pode fazer, o que sai da sua máquina, chaves e pareamento, e como relatar um problema.
applies: 0.7+
---

## O que o daemon pode fazer

O daemon pode digitar nas suas sessões do Claude Code e aprovar chamadas de ferramenta, então ele é na prática um shell remoto no seu computador. Vem trancado por padrão e nada nele é alcançável pela internet.

## Rede

- O app chega ao daemon direto (um WebSocket em todas as interfaces do computador, ou só em `127.0.0.1` com `--dev`) ou por um relay de conexão. Nos dois caminhos cada byte é criptografado de ponta a ponta, e uma conexão que não completa o handshake com uma chave pareada não recebe nada; o relay só repassa texto cifrado e não consegue ler suas sessões.
- Os hooks do Claude Code chegam ao daemon só por `127.0.0.1`, com um segredo local compartilhado.
- `relay: off` ou `direct: off` na configuração desligam um caminho; `remote-harness devices revoke <id>` despareia um celular na hora.

## Chaves e pareamento

- Toda conexão é uma sessão do protocolo Noise (X25519, ChaCha20-Poly1305) criptografada de ponta a ponta entre o celular e o daemon. As chaves do daemon ficam no Keychain do macOS, no Secret Service do Linux (`secret-tool`) ou num arquivo `0600`; cada celular cria o seu par de chaves ao parear e o guarda no armazenamento seguro, só naquele aparelho.
- Um código de pareamento (`remote-harness pair`, a instalação ou a bandeja) funciona uma vez e só por 5 minutos. O daemon guarda as chaves públicas dos celulares pareados (no máximo 10) e derruba qualquer conexão cuja chave não conhece, antes de enviar qualquer coisa.
- Chaves de provedor (OpenRouter) ficam no mesmo cofre, numa conta própria. Nunca são gravadas em `config.json`, `settings.json`, arquivos do shell ou atalhos, nunca vão para o log e nunca são enviadas ao celular: o atalho lê a chave dentro da janela do tmux, e o daemon só a usa para pedir ao provedor os seus créditos.

## O que sai da sua máquina

- As notificações push levam um título, o perfil e o id da sessão. O status ao vivo acrescenta o nome da sessão, a pasta, o estado, o passo atual (a ferramenta e um alvo curto, como o nome de um arquivo ou o programa de um comando, nunca os argumentos) e o progresso das tarefas. Nunca a conversa.
- Com o relay de push, o relay vê essas mesmas mensagens sem conteúdo e um grant selado (o seu token do FCM); ele não guarda nada. Com o seu próprio projeto Firebase, nada passa por mais ninguém.
- O daemon não envia telemetria. A verificação de atualização fala com o remoto git do código instalado.
- Os pedidos de catálogo e créditos do OpenRouter vão do computador para o OpenRouter, e para mais ninguém.

## Comandos de shell

Rodar comandos pelo app (**Rodar comando…**) vem desligado e só pode ser ligado no computador (`remote-harness commands on`). Ligado, um celular pareado pode rodar qualquer comando com o seu usuário na pasta de uma sessão, por isso o app confirma cada comando antes. Cada execução tem limite de tempo e de saída, é encerrada com todo o grupo de processos ao cancelar, e a saída vai só para o celular que a iniciou: comandos e saídas nunca são registrados em log, guardados, enviados a outros celulares nem colocados numa notificação push.

## Permissões

O app nunca oferece o modo "bypass permissions" do agente. O "permitir sempre" grava uma regra nas configurações do próprio Claude Code, para o projeto ou para o seu usuário, e `remote-harness rules undo` a desfaz. Um pedido sem resposta volta para o diálogo do terminal depois de alguns minutos.

## Os seus arquivos

O instalador edita `settings.json`, `~/.zshrc` e `~/.bashrc` sempre do mesmo jeito: lê, mescla, faz backup, grava de forma atômica. `remote-harness uninstall` remove exatamente o que foi adicionado. O comando `claude` puro nunca é alterado.

## Relatar uma vulnerabilidade

Por favor não abra uma issue pública. Relate em privado pelos [GitHub Security Advisories](https://github.com/maarkN/remote-harness/security/advisories/new) com uma descrição, o impacto, os passos para reproduzir (versões do sistema, do Node, do Claude Code e do app) e qualquer sugestão de correção. Você recebe uma confirmação em poucos dias; corrigido, o aviso é publicado com crédito, a menos que prefira ficar anônimo. Só a versão mais recente em `main` recebe correções de segurança. A política completa está em [SECURITY.md](https://github.com/maarkN/remote-harness/blob/main/SECURITY.md).
