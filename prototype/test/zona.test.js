/* Zona ospedale: si entra, si esce e si rientra, e si controlla che fuori
   le schede spariscano davvero. La posizione è finta e la muove il test:
   quella simulata da Chromium a volte smette di arrivare, e il test
   diventerebbe casuale.                                                 */
const { chromium } = require('playwright');
const path = require('path');
let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok  ' : '  FAIL') + ' │ ' + l + (x ? '  → ' + x : '')); if (!c) fail++; };
const attendi = async (f, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await new Promise(r => setTimeout(r, 80)); } return false; };
const FILE = 'file://' + path.resolve(__dirname, '../index.html');
const OSPEDALE = { latitude: 45.6170, longitude: 9.2040, accuracy: 20 };
/* GPS finto: segue chi lo ascolta, risponde alle letture, sopravvive ai
   ricaricamenti (la posizione resta nella sessione); «nega» rifiuta il
   permesso, «muto» non risponde mai                                   */
const GPS = () => {
  const ascolti = new Map(); let n = 0;
  const pos = () => JSON.parse(sessionStorage.getItem('__pos') || 'null');
  const modo = () => sessionStorage.getItem('__gps') || 'ok';
  const dai = (ok, ko) => setTimeout(() => {
    if (modo() === 'nega') return ko({ code: 1 });
    const q = pos(); if (modo() === 'muto' || !q) return;
    ok({ coords: { latitude: q.latitude, longitude: q.longitude, accuracy: q.accuracy }, timestamp: Date.now() });
  }, 30);
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    watchPosition(ok, ko) { const i = ++n; ascolti.set(i, [ok, ko]); dai(ok, ko); return i; },
    clearWatch(i) { ascolti.delete(i); },
    getCurrentPosition(ok, ko) { dai(ok, ko); },
  } });
  window.__sposta = q => { sessionStorage.setItem('__pos', JSON.stringify(q)); ascolti.forEach(([ok, ko]) => dai(ok, ko)); };
};
const sposta = (p, q) => p.evaluate(q => window.__sposta(q), q);
const lontano = (metri, accuracy = 20) => ({ latitude: OSPEDALE.latitude + metri / 111320, longitude: OSPEDALE.longitude, accuracy });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const c = await b.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  await c.addInitScript(o => { localStorage.setItem('pc.v4.profiloRimandato', 'true');
    if (!sessionStorage.getItem('__pos')) sessionStorage.setItem('__pos', JSON.stringify(o)); }, OSPEDALE);
  await c.addInitScript(GPS);
  await c.route('https://ntfy.sh/**', r => r.abort());
  const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.waitForTimeout(400);
  const schede = () => p.evaluate(() => state.length);
  const velo = () => p.evaluate(() => !document.getElementById('zonaVelo').hidden && document.getElementById('zvTit').textContent);

  console.log('── SENZA ZONA ──────────────────────────');
  ok('nessuna copertura', (await velo()) === false);
  ok('schede d\'esempio visibili', await schede() > 0);
  ok('le liste entrano', await p.evaluate(() => !Zona.blocca()));

  console.log('\n── ATTIVAZIONE IN OSPEDALE ─────────────');
  await p.locator('#btnSet').click(); await p.waitForTimeout(300);
  ok('impostazioni: non attiva', /Non attiva/.test(await p.locator('#zonaBox').textContent()));
  ok('raggio di base 2 km', await p.locator('#zonaRaggio').inputValue() === '2000');
  await p.locator('#zonaRaggio').selectOption('500');
  await p.locator('#zonaImposta').click();
  ok('attiva, sei in ospedale', await attendi(async () => /Attiva · sei in ospedale/.test(await p.locator('#zonaBox').textContent())),
     (await p.locator('#zonaBox').textContent()).trim().slice(0, 80));
  const cfg = await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.zona')));
  ok('centro e raggio salvati sul telefono', Math.abs(cfg.lat - OSPEDALE.latitude) < 1e-6 && cfg.raggio === 500);
  await p.locator('#btnSet').click(); await p.waitForTimeout(200);

  console.log('\n── RIAPERTURA IN OSPEDALE ──────────────');
  const n0 = await schede();
  await p.reload(); await p.waitForTimeout(100);
  ok('all\'avvio le schede sono coperte finché la posizione non risponde', /Verifico/.test(await velo() || '') || (await velo()) === false);
  ok('poi si scoprono', await attendi(async () => (await velo()) === false));
  ok('schede intatte', await schede() === n0);

  console.log('\n── POSIZIONE IMPRECISA AL BORDO ────────');
  await sposta(p, lontano(600, 300));             // 600 m ± 300: forse dentro
  await p.waitForTimeout(800);
  ok('non cancella per un dubbio', await schede() === n0 && (await velo()) === false);

  console.log('\n── USCITA DALL\'OSPEDALE ───────────────');
  await sposta(p, lontano(2500));
  ok('fuori: avviso', await attendi(async () => /fuori dall'ospedale/.test(await velo() || ''), 6000), String(await velo()));
  ok('schede cancellate dal telefono', await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.state')).length === 0 && state.length === 0));
  ok('cestino vuoto', await p.evaluate(() => trash.length === 0));
  ok('le liste del PC non entrano', await p.evaluate(() => Zona.blocca()));
  await p.locator('#zvAzione').click();
  ok('«Ho capito» toglie l\'avviso', (await velo()) === false);
  await sposta(p, lontano(2600)); await p.waitForTimeout(800);
  ok('e non ricompare a ogni aggiornamento', (await velo()) === false);

  console.log('\n── RITORNO IN OSPEDALE ─────────────────');
  await sposta(p, OSPEDALE);
  ok('le liste tornano a entrare', await attendi(() => p.evaluate(() => !Zona.blocca())));

  console.log('\n── POSIZIONE CHE NON ARRIVA ────────────');
  const cm = await b.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  await cm.addInitScript(z => { localStorage.setItem('pc.v4.profiloRimandato', 'true'); sessionStorage.setItem('__gps', 'muto');
    localStorage.setItem('pc.v4.zona', JSON.stringify(z)); }, { lat: OSPEDALE.latitude, lon: OSPEDALE.longitude, raggio: 500, impostata: 1 });
  await cm.addInitScript(GPS);
  await cm.route('https://ntfy.sh/**', r => r.abort());
  const m = await cm.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto(FILE);
  ok('dopo 15 s: «posizione non disponibile», schede ancora coperte', await attendi(() => m.evaluate(() =>
     /non disponibile/.test(document.getElementById('zvTit').textContent) && !document.getElementById('zonaVelo').hidden), 18000)
     && await m.evaluate(() => state.length > 0));
  await cm.close();

  console.log('\n── PERMESSO NEGATO ─────────────────────');
  const c2 = await b.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  await c2.addInitScript(z => { localStorage.setItem('pc.v4.profiloRimandato', 'true'); sessionStorage.setItem('__gps', 'nega');
    if (!localStorage.getItem('pc.v4.zona')) localStorage.setItem('pc.v4.zona', JSON.stringify(z)); },
    { lat: OSPEDALE.latitude, lon: OSPEDALE.longitude, raggio: 500, impostata: 1 });
  await c2.addInitScript(GPS);
  await c2.route('https://ntfy.sh/**', r => r.abort());
  const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(FILE);
  const veloQ = () => q.evaluate(() => !document.getElementById('zonaVelo').hidden && document.getElementById('zvTit').textContent);
  /* senza risposta del permesso, dopo 15 s si dice che la posizione non arriva */
  ok('schede nascoste, non cancellate', await attendi(async () => /Serve la posizione/.test(await veloQ() || ''))
     && await q.evaluate(() => state.length > 0), String(await veloQ()));
  ok('si può uscire solo cancellando', await q.locator('#zvEsci').isVisible());
  await q.locator('#zvEsci').click(); await q.locator('#mYes').click();
  await q.waitForLoadState(); await q.waitForTimeout(400);
  ok('zona disattivata e schede cancellate', await q.evaluate(() => localStorage.getItem('pc.v4.zona') === 'null'
     && JSON.parse(localStorage.getItem('pc.v4.state')).length === 0));

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail ? 1 : 0);
})();
