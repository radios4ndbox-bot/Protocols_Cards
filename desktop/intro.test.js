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
  ok('sottotitolo «a StructuRad product»', (await p.locator('#introScena .intro-sotto').textContent()) === 'a StructuRad product');
  const COPY = '© 2026 StructuRad. All rights reserved. Powered by RadioPako.';
  ok('copyright visibile anche durante l\'intro', (await p.locator('.copyright').textContent()) === COPY
     && await p.evaluate(() => { const r = document.querySelector('.copyright').getBoundingClientRect();
       return document.elementFromPoint(r.left + 4, r.top + r.height / 2) !== null
         && +getComputedStyle(document.querySelector('.copyright')).zIndex > +getComputedStyle(document.getElementById('introScena')).zIndex; }));
  ok('barra nascosta durante l\'intro', !(await visibile(p, '.nav button')));
  ok('dorso con il marchio StructuRad sull\'ultima carta', await p.locator('#introScena .pc-carta:last-child .pc-dorso svg path').count() > 10);
  /* registro di ogni fotogramma: dove sta la carta in volo e dove il marchio */
  await p.evaluate(() => { window.__reg = [];
    const carta = document.querySelector('#introScena .pc-ventaglio').lastElementChild;
    const logo = document.getElementById('introLogo'), mark = document.querySelector('.top .mark');
    (function giro() { if (!document.getElementById('introScena')) return;
      const c = carta.getBoundingClientRect(), m = mark.getBoundingClientRect();
      window.__reg.push({ volo: logo.classList.contains('in-volo'), atterrato: logo.classList.contains('atterrato'),
        d: [c.left - m.left, c.top - m.top, c.width - m.width, c.height - m.height] });
      requestAnimationFrame(giro); })(); });
  await p.waitForTimeout(1800);
  ok('la sequenza è partita', await p.locator('#introPalco.in-scena').count() === 1);
  await p.waitForTimeout(1300);
  ok('le carte si raccolgono in una', await p.locator('#introScena .pc-ventaglio.raccolto').count() === 1);
  await p.waitForTimeout(650);
  ok('la carta si gira sul dorso', await p.locator('#introScena .pc-ventaglio.girato').count() === 1
     && await p.evaluate(() => getComputedStyle(document.querySelector('#introScena .pc-carta:last-child')).transform !== 'none'));
  ok('le altre carte non si vedono più', await p.evaluate(() => [...document.querySelectorAll('#introScena .pc-carta:not(:last-child)')]
     .every(c => getComputedStyle(c).opacity === '0')));
  await p.waitForTimeout(2600);
  const reg = await p.evaluate(() => window.__reg);
  const inVolo = reg.filter(r => r.volo && !r.atterrato), ultimo = inVolo[inVolo.length - 1];
  const scarto = ultimo ? Math.max(...ultimo.d.map(Math.abs)) : Infinity;
  ok('la carta atterra esattamente sul marchio', scarto < 0.6, scarto.toFixed(2) + ' px');
  ok('a fine sequenza la scena è tolta', await p.locator('#introScena').count() === 0);
  ok('anche la banda', await p.locator('#introVelo').count() === 0);
  ok('nel marchio c\'è il dorso della carta', await p.evaluate(() => {
    const m = document.querySelector('.top .mark'); return m.classList.contains('con-dorso') && !!m.querySelector('.pc-dorso svg'); }));
  ok('il logo del marchio non esce nero (gradiente rinominato)', await p.evaluate(() => {
    const g = document.querySelector('.top .mark .pc-dorso [fill^="url(#"]');
    return !!g && !!document.getElementById(g.getAttribute('fill').slice(5, -1)); }));
  ok('marchio visibile', await visibile(p, '.top .mark'));
  ok('barra di nuovo visibile', await visibile(p, '.nav button') && await visibile(p, '.privacy'));
  ok('il dorso riempie il marchio', await p.evaluate(() => {
    const m = document.querySelector('.top .mark').getBoundingClientRect();
    const v = document.querySelector('.top .mark .pc-dorso').getBoundingClientRect();
    return Math.abs(v.width - m.width) < .5 && Math.abs(v.height - m.height) < .5 && Math.abs(v.left - m.left) < .5; }));
  ok('copyright in basso a destra dopo l\'intro', await p.evaluate(() => {
    const r = document.querySelector('.copyright').getBoundingClientRect();
    return r.right > innerWidth - 40 && r.bottom > innerHeight - 30; }));
  ok('pagina ferma al suo posto', await p.evaluate(() => getComputedStyle(document.querySelector('main')).transform === 'none'));
  await p.close();

  console.log('\n── SI SALTA CON UN CLIC ────────────────');
  p = await apri();
  await p.waitForTimeout(600);
  await p.mouse.click(40, 800);
  await p.waitForTimeout(50);
  ok('saltando si vola comunque con la carta girata', await p.locator('#introScena .pc-ventaglio.girato').count() === 1);
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
  ok('marchio con il dorso', await p.locator('.top .mark .pc-dorso').count() === 1);
  await p.close();

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail ? 1 : 0);
})();
