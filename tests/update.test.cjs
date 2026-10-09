// Publicações reais A → B → C: aviso, cache, falha de download, loading e preservação do progresso.
const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../dist'), out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
let deployed = '1111111111', fail = false;
const server = http.createServer(async (req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile() || (fail && relative === 'updater.js')) { res.writeHead(404); res.end(); return; }
  let content = fs.readFileSync(file);
  if (relative === 'sw.js') content = content.toString().replace(/const VERSION = '[a-f0-9]+';/, `const VERSION = '${deployed}';`);
  if (relative === 'index.html') content = content.toString().replace(/name="genesio-version" content="[a-f0-9]+"/, `name="genesio-version" content="${deployed}"`);
  if (relative === 'version.json') content = JSON.stringify({ version: deployed });
  // Tempo de download suficiente para verificar o loading e a pausa da fase.
  if (deployed !== '1111111111' && relative === 'updater.js') await new Promise(resolve => setTimeout(resolve, 1800));
  const type = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(content);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const URL = `http://127.0.0.1:${server.address().port}/?sw=1`;
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  let observedPage;
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'allow' });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    observedPage = page;
    await page.goto(URL); await page.waitForFunction(() => ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.equal(await page.locator('#updateOverlay').isVisible(), false, 'primeira instalação sem aviso falso');
    // A primeira visita também recebe publicações seguintes sem precisar fechar o app.
    await page.evaluate(async () => { localStorage.setItem('genesio-coins', '321'); await Hop.start(); show('hplay'); });
    deployed = '2222222222'; await page.evaluate(() => Updater.check());
    await page.waitForSelector('#updateOverlay.active');
    assert.match(await page.locator('#updateTitle').textContent(), /Nova versão disponível/);
    const frozen = await page.evaluate(() => JSON.stringify(Hop._debug()));
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => JSON.stringify(Hop._debug())), frozen, 'fase congelada durante aviso');
    await page.screenshot({ path: path.join(out, 'update-available-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    const button = await page.locator('#updateGo').boundingBox(); assert.ok(button.x >= 0 && button.x + button.width <= 390 && button.height >= 44);
    await page.screenshot({ path: path.join(out, 'update-available-mobile.png') });
    await page.locator('#updateGo').click();
    await page.waitForSelector('#updateSpinner', { state: 'visible' });
    await page.screenshot({ path: path.join(out, 'update-loading.png') });
    await page.waitForFunction(() => document.querySelector('meta[name="genesio-version"]')?.content === '2222222222' && typeof ready !== 'undefined' && ready && typeof Updater !== 'undefined' && !Updater.isBlocking(), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => localStorage.getItem('genesio-coins')), '321');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('genesio-update-loading')), null);
    assert.deepEqual(await page.evaluate(() => caches.keys()), ['genesio-2222222222']);
    // Uma publicação incompleta não ativa o worker nem apaga o cache que ainda funciona.
    deployed = '3333333333'; fail = true; await page.evaluate(() => Updater.check());
    await page.waitForSelector('#updateOverlay.active'); await page.locator('#updateGo').click();
    await page.waitForFunction(() => document.getElementById('updateTitle').textContent === 'Não foi possível atualizar');
    assert.deepEqual(await page.evaluate(() => caches.keys()), ['genesio-2222222222']);
    assert.equal(await page.evaluate(() => document.querySelector('meta[name="genesio-version"]').content), '2222222222');
    await page.screenshot({ path: path.join(out, 'update-error.png') });
    fail = false; await page.locator('#updateGo').click();
    await page.waitForFunction(() => document.querySelector('meta[name="genesio-version"]')?.content === '3333333333' && typeof ready !== 'undefined' && ready && typeof Updater !== 'undefined' && !Updater.isBlocking(), null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => localStorage.getItem('genesio-coins')), '321');
    await context.setOffline(true); await page.evaluate(() => Updater.check());
    assert.equal(await page.locator('#updateOverlay').isVisible(), false);
    await page.reload(); await page.waitForFunction(() => ready);
    assert.equal(await page.evaluate(() => document.querySelector('meta[name="genesio-version"]').content), '3333333333');
    assert.deepEqual(errors, []); await context.close();
    // Mesmo sem service worker, a consulta de versão abre o aviso e recarrega HTML atualizado.
    deployed = '1111111111';
    const fallback = await browser.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    const other = await fallback.newPage(); await other.goto(URL); await other.waitForFunction(() => ready);
    deployed = '2222222222'; await other.evaluate(() => Updater.check()); await other.locator('#updateGo').click();
    await other.waitForFunction(() => document.querySelector('meta[name="genesio-version"]')?.content === '2222222222' && typeof ready !== 'undefined' && ready && typeof Updater !== 'undefined' && !Updater.isBlocking());
    await fallback.close();
    console.log('Atualização: aviso responsivo, fase congelada, loading, cache completo, erro/retry, moedas preservadas, offline e fallback sem SW OK');
  } catch (e) {
    if (observedPage && !observedPage.isClosed()) {
      console.error('Estado da atualização:', await observedPage.evaluate(async () => ({ url: location.href, version: document.querySelector('meta[name="genesio-version"]')?.content, ready: typeof ready !== 'undefined' && ready, blocking: typeof Updater !== 'undefined' && Updater.isBlocking(), title: document.getElementById('updateTitle')?.textContent, text: document.getElementById('updateText')?.textContent, pending: sessionStorage.getItem('genesio-update-loading'), caches: await caches.keys() })));
      await observedPage.screenshot({ path: path.join(out, 'update-failure.png') });
    }
    throw e;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exit(1); });
