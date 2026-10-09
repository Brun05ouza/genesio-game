@echo off
rem Abre o jogo no computador: http://localhost:8000 (com login; contas salvas em server\dev-db.json, ou no Neon se houver server\.env)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado: abrindo sem login.
  start "" http://localhost:8000
  python -m http.server 8000
  goto :eof
)
if not exist "server\node_modules" ( pushd server & call npm install --silent & popd )
start "" http://localhost:8000
node server\server.js --port 8000 --static .. --db dev-db.json
