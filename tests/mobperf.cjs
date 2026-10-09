const { chromium } = require('C:/Users/bs902/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 740, height: 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-A325M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8 * 3, uploadThroughput: 750 * 1024 / 8, });   // ~ 4.8 Mbps ("4G fraco")
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const errs = [], bytes = { n: 0 }; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('response', async r => { try { const b = (await r.body()).length; bytes.n += b; } catch (e) {} if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  const t0 = Date.now();
  await page.goto('http://localhost:8010'); await page.waitForFunction(() => ready, null, { timeout: 120000 });
  console.log('abrir o jogo (ate o menu):', ((Date.now() - t0) / 1000).toFixed(1) + 's', (bytes.n / 1e6).toFixed(1) + 'MB');
  const mem = async () => { const m = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(performance.memory ? {used: Math.round(performance.memory.usedJSHeapSize/1e6)} : {})', returnByValue: true }); return m.result.value; };
  const measure = async (name, fn, waitState) => {
    const b0 = bytes.n, t = Date.now();
    await page.evaluate(fn);
    await page.waitForFunction(s => state === s, waitState, { timeout: 180000 }).catch(() => console.log('  !! nao chegou ao estado', waitState, 'estado atual:', 'ver'));
    const st = await page.evaluate(() => state);
    console.log(name.padEnd(14), ((Date.now() - t) / 1000).toFixed(1) + 's', ((bytes.n - b0) / 1e6).toFixed(1) + 'MB', 'estado=' + st, await mem());
    await page.evaluate(() => { try { Runner.stop(); Nature.stop(); Climb.stop(); Hop.stop(); Solar.stop(); Flow.stop(); } catch (e) {} show('playing'); });
  };
  await page.evaluate(() => { document.getElementById('btnStart').click(); });
  await measure('Solar', () => { beginSolar(); }, 'splay');
  await measure('Flow', () => { beginFlow(); }, 'fplay');
  await measure('Nature EPI', () => { beginChallenge('epi'); }, 'nplay');
  await measure('Torre', () => { beginChallenge('climb'); }, 'kplay');
  await measure('Subida', () => { beginChallenge('hop'); }, 'hplay');
  await measure('Oasis', () => { beginRun('normal'); }, 'runner');
  console.log('erros:', errs);
  await browser.close();
})();
