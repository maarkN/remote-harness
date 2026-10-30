---
title: Servidor na nuvem
description: Rodar o daemon numa VM na nuvem (AWS, DigitalOcean, GCP, Oracle): portas e firewalls, o serviço sem sessão de login, o terminal por SSH, conexões instáveis.
applies: 0.21+
---

O daemon roda numa VM na nuvem do mesmo jeito que num computador em casa: instale com o instalador de uma linha pelo SSH, rode `remote-harness setup` e pareie o celular escaneando o QR code que a instalação mostra no terminal. Esta página cobre o que muda num servidor: ninguém está logado, você chega nele por SSH e a rede fica atrás do firewall do provedor.

## Portas e rede

**Nenhuma porta de entrada é necessária.** O daemon abre uma conexão de saída para o seu [relay de conexão](/pt-br/docs/daemon/#hospedar-o-proprio-relay-de-conexao) e o app o encontra lá, com criptografia de ponta a ponta. A VM só precisa de HTTPS de saída (TCP 443) para:

- `us.relay.remoteharness.app` e `br.relay.remoteharness.app`, os relays de conexão (ou o seu próprio);
- `push.remoteharness.app`, para as notificações, a menos que você use a sua própria conta de serviço do Firebase;
- `github.com`, para o `remote-harness update`.

A maioria dos provedores libera todo o tráfego de saída por padrão. Numa rede que filtra a saída, libere esses hosts; o `remote-harness doctor` diz se os relays respondem.

O **caminho direto** (o WebSocket na porta `7337`, `wsPort` na configuração) é opcional num servidor. O daemon anuncia os endereços das próprias interfaces de rede, e na AWS, no GCP e na Oracle Cloud o IP público não é um deles (o provedor faz a tradução), então o celular só alcança esses endereços por uma VPN como Tailscale ou WireGuard, cujo endereço de interface o daemon também anuncia. Bridges de contêiner e de VM (`docker0`, `br-…`, `virbr0`…) ficam de fora. Na DigitalOcean o IP público está na `eth0`, então abrir a `7337` faz o caminho direto funcionar de qualquer lugar; o canal continua cifrado com Noise e só celulares pareados entram, mas prefira a VPN ou limite a regra a endereços em que você confia. Nunca abra a porta dos hooks (`7338`): ela só escuta em `127.0.0.1`.

### Regras de firewall por provedor

Só para o caminho direto; pule esta seção quando o relay bastar.

| Provedor | Onde | Regra |
| --- | --- | --- |
| AWS EC2 / Lightsail | O security group da instância (Lightsail: Networking → IPv4 firewall) | Entrada TCP `7337` a partir da sua faixa de origem |
| DigitalOcean | Networking → Firewalls (Cloud Firewall ligado ao droplet) | Entrada TCP `7337` a partir da sua faixa de origem |
| Google Cloud | VPC network → Firewall | `gcloud compute firewall-rules create remote-harness --allow tcp:7337 --source-ranges <faixa> --target-tags remote-harness`, e a tag na VM |
| Oracle Cloud | A security list da sub-rede ou o network security group da VNIC, **e** o `iptables` da própria VM | Entrada TCP `7337`, depois `sudo iptables -I INPUT -p tcp --dport 7337 -j ACCEPT` e `sudo netfilter-persistent save` (as imagens Ubuntu da Oracle rejeitam tudo menos SSH no `iptables`) |

Com `ufw` na VM, rode também `sudo ufw allow 7337/tcp`. Para desligar o caminho direto de vez, ponha `"direct": "off"` no [arquivo de configuração](/pt-br/docs/daemon/#arquivo-de-configuracao).

## Manter o daemon rodando sem login

- **Serviço**: `remote-harness service install` (a instalação já faz) cria uma unidade de usuário do systemd. Uma unidade de usuário para quando a sua última sessão SSH termina, a menos que o linger esteja ligado; a instalação oferece `loginctl enable-linger`, ou rode `sudo loginctl enable-linger "$USER"` você mesmo. `loginctl show-user "$USER" -p Linger` deve dizer `Linger=yes`, e `remote-harness service status` que a unidade está ativa.
- **Chaves**: o daemon guarda as chaves no Secret Service quando o `secret-tool` está instalado e um chaveiro responde. Um servidor sem sessão gráfica em geral não tem chaveiro, então o daemon usa um arquivo `0600` em `~/.remote-harness/secrets/` e lembra essa escolha. O `remote-harness doctor` mostra o armazenamento em uso; `REMOTE_HARNESS_TOKEN_STORE=file` força o arquivo. Trocar de armazenamento perde as chaves: pareie o celular de novo depois.
- **Sem systemd** (algumas imagens de contêiner): rode `remote-harness start` numa janela do tmux e reconecte depois de um reboot.
- **Suspensão**: uma VM na nuvem não suspende por inatividade, então a opção de manter acordado não muda nada lá. Parar a instância (ou uma instância spot ser recolhida) para o daemon e as sessões junto; o serviço volta com a VM, as sessões do tmux não.

## O terminal por SSH

- **`TERM`**: entrar por SSH a partir do Ghostty ou do kitty manda um tipo de terminal que o servidor pode não conhecer (`xterm-ghostty`, `xterm-kitty`). Os atalhos caem para `xterm-256color`; para manter os recursos do seu terminal copie a descrição dele: `infocmp -x "$TERM" | ssh <host> -- tic -x -`. Veja [o alias diz "missing or unsuitable terminal"](/pt-br/docs/troubleshooting/#o-alias-diz-missing-or-unsuitable-terminal).
- **Locale**: imagens mínimas muitas vezes não têm um locale UTF-8, e aí o tmux desenha caixas e acentos errado. Instale um e defina no perfil do shell: `sudo locale-gen pt_BR.UTF-8` (Debian/Ubuntu), depois `export LANG=pt_BR.UTF-8` no `~/.profile`. O próprio daemon já roda o tmux em modo UTF-8.
- **Anexar**: o seu alias abre a sessão na sessão `claude-remote` do tmux e se anexa a ela; desanexe com `Ctrl-b d` antes de fechar o SSH. A sessão continua rodando e controlável pelo celular.

## Conexões instáveis

Os keepalives são mais curtos que qualquer tempo ocioso comum: o relay pinga o daemon e o celular a cada 25 s, o daemon derruba uma conexão com o relay que fica 90 s em silêncio e reconecta, e o app pinga uma conexão quieta a cada 30 s e troca uma que não responde em 10 s. Gateways de NAT (AWS 350 s, Google Cloud NAT 20 minutos) e balanceadores de carga (em geral de 60 a 350 s) portanto não devem cortar uma conexão em uso.

Se o app ainda vive reconectando:

- Atualize os dois lados: `remote-harness update` no servidor e o app em Ajustes → App. Versões anteriores deixavam o relay fechar uma conexão quieta depois de 10 minutos, e o app tentava todos os endereços anunciados antes do relay a cada reconexão.
- Procure `relay connection closed` e `relay connection failed` em `~/.remote-harness/logs/daemon.log`: muitas delas apontam para a rede do servidor (um proxy de saída, um firewall que corta conexões longas). O `remote-harness doctor` confere se os relays respondem.
- Não ponha a porta do daemon atrás de um balanceador de carga: o caminho pelo relay não precisa de nada de entrada. Se expuser a `7337` por um, ligue o suporte a WebSocket e ponha o tempo ocioso em pelo menos 60 s.
- Um firewall que descarta em silêncio (em vez de recusar) a porta `7337` não atrapalha: o app desiste de um endereço direto depois de 3 s e, uma vez conectado pelo relay, reconecta por ele primeiro.

A investigação por trás desses valores está na [issue #442](https://github.com/maarkN/remote-harness/issues/442). Ainda com problema? Abra uma issue com a saída do `remote-harness doctor` e as linhas do log do daemon em volta das quedas, como em [pedindo ajuda](/pt-br/docs/troubleshooting/#pedindo-ajuda).
