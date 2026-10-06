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

## Instalar como app (PWA)
O site é instalável e funciona sem internet depois da primeira visita (tela cheia, ícone próprio):
- **Android (Chrome):** aparece o aviso "Instalar" (ou menu ⋮ → *Instalar app*).
- **iPhone/iPad (Safari):** Compartilhar → *Adicionar à Tela de Início* (o botão 📲 do menu mostra o passo a passo).
O service worker só é registrado fora do localhost (use `?sw=1` para testar). Teste automático: `node pwa.test.cjs` com o `dist/` servido em localhost:8001.
