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
Se criar arquivos novos (imagens etc.), atualize antes a lista com `node build-trace.cjs` (com o jogo aberto em localhost:8000).

## Controles
- Teclado: WASD/setas, Shift, Espaço, J/C/F no Solar, Esc pausa.
- Celular (na horizontal): joystick e botões aparecem no lobby, Nature e Solar do Bosque.
