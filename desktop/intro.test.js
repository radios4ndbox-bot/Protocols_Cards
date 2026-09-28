/* Intro del tool PC: la coreografia parte, si può saltare, atterra nel
   marchio della barra e lascia la pagina pulita. Con «riduci movimento»
   non parte affatto.
   node build.js && node intro.test.js                                  */
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'protocol-cards-pc.html');

let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok  ' : '  FAIL') + ' │ ' + l + (x ? '  → ' + x : '')); if (!c) fail++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const apri = async (opz = {}) => {
    const p = await b.newPage({ viewport: { width: 1360, height: 860 }, ...opz });
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
    await p.goto(FILE);
    return p;
  };
  const visibile = (p, sel) => p.evaluate(s => { const e = document.querySelector(s);
    return !!e && getComputedStyle(e).opacity !== '0' && getComputedStyle(e).visibility !== 'hidden'; }, sel);

  console.log('── SEQUENZA COMPLETA ───────────────────');
  let p = await apri();
  ok('scena presente all\'apertura', await p.locator('#introScena').count() === 1);
  ok('quattro carte, una per fase', await p.locator('#introScena .pc-carta').count() === 4);
  ok('immagini TC incorporate', await p.evaluate(() => [...document.querySelectorAll('#introScena .pc-carta img')]
    .every(i => i.src.startsWith('data:image/jpeg') && i.naturalWidth > 0)));
  ok('nome lettera per lettera', await p.locator('#introScena .intro-glifo').count() === 13);
  ok('barra nascosta durante l\'intro', !(await visibile(p, '.nav button')));
  await p.waitForTimeout(1800);
  ok('la sequenza è partita', await p.locator('#introPalco.in-scena').count() === 1);
  await p.waitForTimeout(4200);
  ok('a fine sequenza la scena è tolta', await p.locator('#introScena').count() === 0);
  ok('anche la banda', await p.locator('#introVelo').count() === 0);
  ok('il ventaglio è atterrato nel marchio', await p.evaluate(() => {
    const m = document.querySelector('.top .mark'); return m.classList.contains('con-ventaglio') && m.querySelectorAll('.pc-carta').length === 4; }));
  ok('marchio visibile', await visibile(p, '.top .mark'));
  ok('barra di nuovo visibile', await visibile(p, '.nav button') && await visibile(p, '.privacy'));
  ok('la copia del ventaglio sta nel marchio', await p.evaluate(() => {
    const m = document.querySelector('.top .mark').getBoundingClientRect();
    const v = document.querySelector('.top .mark .pc-ventaglio').getBoundingClientRect();
    return Math.abs(v.width - m.width) < 1.5 && Math.abs(v.left - m.left) < 1.5; }));
  ok('pagina ferma al suo posto', await p.evaluate(() => getComputedStyle(document.querySelector('main')).transform === 'none'));
  await p.close();

  console.log('\n── SI SALTA CON UN CLIC ────────────────');
  p = await apri();
  await p.waitForTimeout(600);
  await p.mouse.click(40, 800);
  await p.waitForTimeout(1900);
  ok('scena tolta poco dopo il clic', await p.locator('#introScena').count() === 0);
  ok('barra visibile', await visibile(p, '.nav button'));
  await p.close();

  console.log('\n── E CON ESC ───────────────────────────');
  p = await apri();
  await p.waitForTimeout(400);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1900);
  ok('scena tolta', await p.locator('#introScena').count() === 0);
  await p.close();

  console.log('\n── RIDUCI MOVIMENTO ────────────────────');
  p = await apri({ reducedMotion: 'reduce' });
  await p.waitForTimeout(100);
  ok('nessuna scena', await p.locator('#introScena').count() === 0);
  ok('barra subito visibile', await visibile(p, '.nav button'));
  ok('marchio con il ventaglio', await p.locator('.top .mark .pc-carta').count() === 4);
  await p.close();

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail ? 1 : 0);
})();
