---
title: Usando o app
description: Lista de sessões, conversa, prompts, permissões, terminal, sessões e worktrees, status ao vivo, notificações, perfis e OpenRouter, ajustes.
applies: 0.7+
---

## Lista de sessões

A tela inicial lista as sessões de todos os perfis do computador pareado, da atividade mais recente para a mais antiga (o chip de ordenação troca para agrupamento por estado). Cada linha mostra o selo do agente, o título, a pasta e a branch, o estado (`rodando`, `esperando`, `parada`, `encerrada`) e a etiqueta do perfil; os chips filtram por perfil. Uma faixa **Esperando você** no topo reúne os pedidos de permissão, com Permitir, Sempre e Negar ali mesmo. Deslize uma linha para as ações rápidas (encerrar ou retomar, silenciar, fixar); segure ou toque no menu da linha para o resto (copiar o caminho, ocultar uma sessão encerrada, limpar o worktree dela). Sessões que dividem um checkout git com outra sessão ao vivo ficam marcadas, porque podem atropelar os arquivos uma da outra.

A linha sob o título mostra o computador e quantas sessões ele tem; toque no nome para trocar para outro computador pareado ou adicionar um. "via relay" ali quer dizer que o app o alcança pelo relay de conexão: em casa ele passa sozinho para o caminho direto, sem perder a conversa. As notificações continuam chegando de todos os computadores pareados, e tocar numa abre no computador dela. O botão `+` abre uma sessão nova.

## Conversa

Abra uma sessão para ler a conversa enquanto acontece: prompts, o texto do agente em Markdown, o raciocínio, as chamadas de ferramenta com seus resultados, diffs e imagens, paginados até o começo. Sob o cabeçalho, a primeira linha de contexto mostra o selo do agente, o perfil, a pasta (toque para os detalhes da sessão), o estado e o modo de permissão; a segunda mostra o modelo (com o nível de esforço), o provedor quando o perfil tem um, a branch, o uso da janela de contexto e os limites de uso da conta. Toque nela para ver os números.

**Histórico da conversa** (no menu) lista os seus prompts do mais recente para o mais antigo e salta para um deles. **Seguir a saída** mantém a tela no fim enquanto o agente trabalha; role para cima para pausar.

## Enviando prompts

Digite no compositor e envie. Enquanto o agente está ocupado o prompt entra na fila e é entregue em ordem quando o turno termina; o cartão **Fila** deixa editar, reordenar, remover ou enviar um item agora. Segure o botão de enviar (ou pressione ⌘⏎ com um teclado) para enviar na hora, como Ctrl+Enter no terminal.

O que você digita fica como rascunho da sessão: saia da sessão, abra outra ou feche o app, e ele estará lá quando você voltar, com as fotos. A lista de sessões marca as linhas com rascunho (**Rascunho:** e o começo do texto). Enviar limpa o rascunho; esvaziar o campo o descarta. Os rascunhos ficam só no celular e expiram depois de 7 dias.

- `@` completa arquivos do projeto, `/` completa os comandos de barra do Claude Code.
- O botão da câmera anexa fotos; o microfone dita no aparelho (escolha o idioma em Ajustes → Voz).
- **Mostrar atalhos de teclado** (menu) acrescenta uma barra com Esc, Ctrl+C, as setas, Tab e Enter para os menus do próprio agente.

## Permissões

Quando o agente pede permissão, o app mostra a ferramenta e o comando ou arquivo, com **Permitir**, **Negar** e **Sempre**. O "Sempre" grava uma regra nas configurações do agente, para o projeto ou para o seu usuário, exatamente como o diálogo do terminal faria; Ajustes → Permissões → **Regras** lista todas as regras de "permitir sempre" do computador: as criadas por um aparelho podem ser desfeitas, e as que você escreveu no computador só podem ser apagadas ali, depois do Face ID ou da senha do aparelho (um backup do arquivo de configurações fica ao lado). **Atividade** mostra o que cada aparelho permitiu, negou, desfez e apagou nos últimos 30 dias, nunca o input da ferramenta. No computador, `remote-harness rules list`, `remote-harness rules undo <id>` e `remote-harness approvals list` fazem o mesmo. O daemon espera a sua resposta por alguns minutos antes de deixar o diálogo do terminal assumir, então um pedido sem resposta nunca trava a sessão para sempre. Quando o agente faz uma pergunta com opções, as opções aparecem também.

O chip de **modo** troca o modo de permissão: padrão, aceitar edições, plano e auto. O app nunca oferece "bypass permissions".

## Terminal bruto

**Ver terminal** (menu, ou o botão de terminal no cabeçalho) mostra o próprio painel do tmux, para menus e tudo o que a visão estruturada não cobre, com a mesma barra de teclas. Sessões somente leitura (sem painel do tmux) não aceitam digitação.

## Rodar um comando

**Rodar comando…** (menu da sessão) roda um comando de shell na pasta da sessão no computador, como o `!` do Claude Code, e mostra a saída ao vivo: `git status`, `ls`, `pnpm test`. O app confirma antes de cada comando; **Parar** encerra, **Copiar saída** copia e **Adicionar ao prompt** coloca o comando e a saída no composer como bloco de código para o agente, sem enviar. Fica desligado até você rodar `remote-harness commands on` no computador; os comandos têm limite de tempo e de saída, e nada interativo funciona (não há entrada pelo teclado).

## Revisando alterações

**Revisar alterações** (menu da sessão) lista os arquivos do checkout (ou worktree) da sessão que diferem do `HEAD`: adicionados, modificados, apagados, renomeados e não rastreados, com as contagens `+adicionadas −removidas`, sem perguntar ao agente. Toque num arquivo para ver o diff; lockfiles, arquivos gerados (`dist/`, `*.generated.ts`) e diffs grandes começam recolhidos, arquivos binários só dizem "binário alterado", e diffs longos carregam 2.000 linhas por vez com **Mostrar o resto**. A lista se atualiza enquanto a sessão trabalha e ao puxar, faça a sessão o que fizer.

Na mesma tela dá para fechar o ciclo: desmarque os arquivos que ficam de fora, escreva a mensagem do commit ou toque em **Gerar** (o próprio Claude Code da sessão a escreve a partir do diff, com um modelo pequeno e sem ferramentas), depois **Commitar**, **Push** e **Abrir PR**. Cada um mostra antes o que vai tocar: os arquivos, o branch e o remoto. No branch padrão o commit oferece criar um branch novo antes, com o nome tirado da mensagem; um push direto em `main` ou `master` recebe um aviso. **Abrir PR** usa o `gh` quando ele está instalado no computador (título e descrição também podem ser gerados); sem ele, **Push e comparar** faz o push e abre a página "compare & open PR" do GitHub. Enquanto o agente trabalha esses botões esperam por ele, com um **Fazer mesmo assim** depois de um aviso. São operações fixas do daemon, não comandos de shell, então funcionam com `remote-harness commands` desligado.

## Subagentes

Enquanto o agente delega trabalho, o menu do cabeçalho mostra **Subagentes (N · M rodando)**; a planilha lista cada um com descrição, estado, contagem de ferramentas e horário de início, além das tarefas em segundo plano.

## Abrir, retomar e encerrar sessões

**Nova sessão** (o botão `+`) pede o perfil, o modelo quando o perfil tem um provedor, e o diretório: digite com autocompletar, navegue pelas pastas ou escolha uma recente (com a branch e quantas vezes foi usada na semana). Ative **Cópia isolada (git worktree)** para abrir o Claude Code com `--worktree`: ele trabalha numa branch própria em `<repo>/.claude/worktrees/<nome>`, e duas sessões podem dividir um repositório sem se tocar. A cópia mantém as permissões locais do projeto: o Claude Code lê no worktree o `.claude/settings.local.json` do checkout principal (ou o copia), e copia os arquivos ignorados pelo git listados em `.worktreeinclude` na raiz do repositório (sintaxe do gitignore, ex.: `.env`). A tela lista sob a chave o que vai junto. Abrir num checkout que outra sessão ao vivo já usa pede confirmação antes. Um **Nome** opcional (com a branch e nomes de sessões recentes como sugestões) vira o título da sessão na hora, o `--name` do Claude Code e o nome do worktree quando a cópia isolada está ligada.

**Retomar** reabre uma sessão encerrada ou somente leitura dentro do tmux, com o mesmo histórico. **Encerrar** termina a sessão; quando ela rodou num worktree, o app oferece apagar só se estiver limpo e enviado, fazer commit e push antes, ou descartar o trabalho, perguntando duas vezes antes de descartar qualquer coisa.

## Status ao vivo

No iOS, uma sessão em andamento mostra uma Live Activity na tela de bloqueio e na Dynamic Island com o estado, o passo atual e o tempo decorrido; um pedido de permissão acrescenta os botões Permitir e Negar. No Android é uma notificação silenciosa sem botões: toque para responder no app. Nunca leva a conversa. Desligue em Ajustes → Notificações → Status ao vivo.

## Notificações e silêncio

As notificações push avisam quando uma sessão precisa de permissão, termina um turno ou faz uma pergunta; levam um título, o perfil e o id da sessão, nunca o conteúdo. Ajustes → Notificações tem o interruptor deste celular, um botão de teste e o interruptor do status ao vivo. Silencie um perfil ou uma sessão pela linha dela ou pelo menu da sessão; a linha **Silenciados** nos Ajustes lista tudo o que está silenciado.

## Perfis e OpenRouter

Um perfil é uma conta do Claude Code, ou seja um `CLAUDE_CONFIG_DIR`, com nome, cor e alias. Um perfil também pode rotear o Claude Code pelo **OpenRouter**: as linhas dele mostram um chip tracejado `via OpenRouter`, **Nova sessão** ganha uma linha **Modelo** com um seletor pesquisável (tamanho do contexto, preços por milhão de tokens, suporte a ferramentas, raciocínio e cache, créditos restantes), e **Trocar modelo…** no menu da sessão troca uma sessão em andamento. A chave fica no computador: veja [o daemon](/pt-br/docs/daemon/#perfis-e-openrouter).

Um perfil também pode rodar o **Codex** (selo `cx`, verde): as sessões dele mostram a política de aprovação (`on-request`, `never`…) no lugar do chip de modo, chamadas `exec(…)` e `apply_patch(…)` com saída e diff, e aprovações com Permitir / Negar. Veja [Perfis do Codex](/pt-br/docs/daemon/#perfis-do-codex).

## Ajustes

- **Máquina**: a conexão e o caminho (direto ou via relay), o nome da máquina (um apelido à sua escolha, senão o hostname), a versão do daemon e **Esquecer esta máquina**.
- **Computadores**: todos os computadores pareados; trocar, renomear neste aparelho, esquecer ou adicionar outro.
- **Aparelhos**: os celulares e tablets pareados com este computador e quando cada um foi visto por último. **Adicionar aparelho** mostra um código de pareamento de uso único (QR e link, válido por 5 minutos) para escanear com o outro aparelho; **Revogar** desconecta um na hora, e ele precisa parear de novo.
- **Aparência**: Sistema, Escuro, Claro, Dracula, Catppuccin Mocha e Catppuccin Latte.
- **Perfis**: cada perfil com agente, alias, pasta de config, interruptor de notificações e, com provedor, o provedor, o modelo padrão e os créditos.
- **Notificações**: push para este celular, teste, status ao vivo, os perfis e sessões silenciados.
- **Voz**: o idioma da transcrição.
- **App**: versão, atualizações over-the-air e o canal delas, **Verificar atualizações**, **Documentação**.
- **Relatórios de erro**: enviar automaticamente, perguntar sempre (padrão) ou nunca, e **Relatar um problema** (descreva o bug, veja exatamente o que será enviado e envie, compartilhe ou abra uma issue no GitHub). Os relatórios nunca levam o conteúdo das suas sessões; veja a [política de privacidade](/pt-br/docs/privacy/).

## iPad e teclados

Num iPad (ou qualquer tela larga) a lista e a conversa ficam lado a lado, e um painel de inspeção guarda o terminal, os subagentes e os detalhes da sessão. Com um teclado físico, ⌘⏎ envia agora, Enter envia ou quebra a linha conforme o ajuste do compositor, e os atalhos aparecem nas dicas de teclas.
