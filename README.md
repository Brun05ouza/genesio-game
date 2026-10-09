# Genésio

Jogo 2D no navegador (HTML + Canvas, sem dependências). Lobby, Nova Iguaçu (corrida), Teresópolis (Nature, Solar do Bosque e Flow Residencial).

## Rodar localmente
```bash
python -m http.server 8000
```
Abra http://localhost:8000. No Windows também dá para dar duplo clique em `iniciar.bat`.

## Publicar (Netlify)
O Netlify publica a pasta `dist/` (veja `netlify.toml`), que contém só o que o jogo carrega.
Depois de mudar o jogo, refaça a pasta e envie ao Git:
```bash
python build-dist.py
git add -A && git commit -m "atualiza o jogo" && git push
```
O `build-dist.py` converte PNG/JPG em WebP (o jogo baixa ~3x menos dados no celular), reescreve os caminhos e dá uma versão nova ao cache offline (`sw.js`).
Se criar arquivos novos (imagens etc.), atualize antes a lista com `node build-trace.cjs` (com o jogo aberto em localhost:8000).

## Controles
- Teclado: WASD/setas, Shift, Espaço, J/C/F no Solar, Esc pausa.
- Celular (na horizontal): joystick e botões aparecem no lobby, Nature e Solar do Bosque.
- Solar no celular: o botão **Lançar** é também a mira — toque rápido lança para a frente; segure e arraste para mirar (a distância é a força) e solte para lançar.
- Solar do Bosque: escolha Fácil, Normal ou Difícil ao entrar pela placa. A dificuldade altera a vida, a resistência e o ritmo dos inimigos; as tentativas mantêm o modo escolhido. Recordes e ranking são separados por modo. O recorde antigo permanece no Normal.

## Multiplayer no lobby

Jogadores conectados à conta entram automaticamente no lobby online. O botão **Online** mostra quantos estão no mesmo mapa e permite ficar offline ou reconectar. Em **Configurações → Jogar offline**, escolha **Sim** para jogar sem entrar no multiplayer; a preferência fica salva no aparelho e também pode ser alterada pelo pause das fases. Lobby, Nova Iguaçu e Teresópolis têm presenças separadas; movimento, corrida, salto, nome e foto do perfil aparecem aos outros jogadores. Até 32 jogadores visíveis por mapa. As fases continuam individuais: ao entrar, o personagem sai da área compartilhada e reaparece ao retornar. Visitantes podem continuar jogando offline.

Para rodar tudo localmente, use `node server/server.js --port 8000 --static ..` (configure o banco em `server/.env`, ou omita `DATABASE_URL` para um banco de teste em memória). Teste com duas contas em navegadores/perfis diferentes. Só o servidor de arquivos do Python não oferece multiplayer.

Na VPS, atualize também `server/`, rode `npm ci` nessa pasta e reinicie o serviço `genesio-api`. O endpoint `/api/lobby` usa WebSocket no mesmo servidor da API; os blocos em `server/nginx-api.conf` e `server/nginx-site.conf` já incluem o encaminhamento necessário. A configuração precisa ser aplicada ao Nginx e validada com `nginx -t` antes de recarregar. Publicar somente `dist/` não atualiza o servidor multiplayer. As presenças são temporárias e usam um único processo de API; reiniciar o processo faz os clientes reconectarem.

Se a API estiver em outro domínio, `window.GENESIO_API` deve apontar para a URL pública HTTPS da API antes de carregar os scripts. O cliente deriva dela a conexão segura do lobby.

Teste automático (API com banco de teste): `node tests/multiplayer.test.cjs http://localhost:8012`.

## Conversa de boas-vindas
Ao tocar em **Começar** (jogo novo) o Genésio aparece e conversa com a pessoa no estilo Pokémon FireRed: o texto surge aos poucos e se toca/clica (ou Enter/Espaço) para passar; **Pular** ou Esc encerram. O roteiro fica em `welcomeScript()` no `game.js`; o módulo é o `talk.js`. Teste: `node tests/talk.test.cjs`.

## Instalar como app (PWA)
O site é instalável e funciona sem internet depois da primeira visita (tela cheia, ícone próprio):
- **Android (Chrome):** aparece o aviso "Instalar" (ou menu ⋮ → *Instalar app*).
- **iPhone/iPad (Safari):** Compartilhar → *Adicionar à Tela de Início* (o botão 📲 do menu mostra o passo a passo).
O service worker só é registrado fora do localhost (use `?sw=1` para testar). Teste automático: `node tests/pwa.test.cjs` com o `dist/` servido em localhost:8001.

## Pastas do projeto
- Raiz: o jogo (`index.html`, `*.js`, `*.css`), `assets/`, `fase-*/`, `frames/`, `map/`, `icons/` e o que publica (`build-dist.py`, `build-files.json`, `build-trace.cjs`, `netlify.toml`).
- `tests/`: testes automáticos (Playwright). Rode todos com `node tests/run-all.cjs` (jogo servido só como arquivos em localhost:8010: `python -m http.server 8010`; para testar o `dist/`, sirva-o em localhost:8001 e use `node tests/run-all.cjs http://localhost:8001`). As capturas de tela dos testes vão para `tests/out/` (ignorado pelo Git).
- `tools/`: scripts em Python que prepararam as imagens e os dados do jogo (recortes de sprites, máscaras de colisão do lobby e de Teresópolis, ícones do app etc.). Rodam a partir da raiz, por exemplo `python tools/make_serra_mask.py`.

## Contas, moedas e recordes (API + Neon)
A pasta `server/` tem uma API pequena (Node + Postgres do Neon) com cadastro e login (nome + senha, guardada com hash scrypt).
Depois de entrar, as GenesisCoins e os recordes de todas as fases vão para a conta e aparecem em qualquer aparelho.
Sem a API no ar (Netlify, localhost só com arquivos, ou sem internet e sem conta) o jogo funciona como antes, salvando só no aparelho.

- Configurar: copie `server/.env.example` para `server/.env` e coloque a `DATABASE_URL` do Neon. As tabelas são criadas sozinhas (`server/schema.sql`).
- Rodar no computador: `iniciar.bat` (ou `node server/server.js --port 8000 --static .. --db dev-db.json`) → http://localhost:8000 com login. Sem `.env`, as contas ficam em `server/dev-db.json`.
- VPS: `server/genesio-api.service` (systemd) e `server/nginx-site.conf` (site completo no Nginx: jogo, `/api/` na porta 3077 e HTTPS).
- Teste: `node tests/account.test.cjs` (com a API em localhost:8002).
