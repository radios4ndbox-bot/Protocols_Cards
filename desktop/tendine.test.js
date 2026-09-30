/* Menu a tendina del tool PC: ogni <select> ha il suo pulsante e il suo
   elenco nello stile del tool, e la scelta arriva al select nascosto con
   il suo evento change, come prima.
   node build.js && node tendine.test.js                                */
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, 'protocol-cards-pc.html');

let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok  ' : '  FAIL') + ' │ ' + l + (x ? '  → ' + x : '')); if (!c) fail++; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
  await p.goto(FILE);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(300);

  const aperta = () => p.locator('.tendina-lista');

  console.log('── EDITOR: TIPO DI FASE ────────────────');
  await p.locator('.nav button[data-area="proto"]').click(); await p.waitForTimeout(400);
  const nSel = await p.locator('#aProto select').count();
  ok('ogni select ha il suo pulsante', nSel > 0 && await p.locator('#aProto select.tendina-nativa').count() === nSel
     && await p.locator('#aProto button.tendina').count() === nSel, nSel + ' select');
  ok('il select nativo è nascosto', await p.evaluate(() => {
    const s = document.querySelector('#aProto select'); return getComputedStyle(s).opacity === '0' && s.tabIndex === -1; }));
  const fase = p.locator('#aProto button.tendina.field').first();
  const prima = await fase.textContent();
  ok('il pulsante mostra la scelta attuale', prima.length > 2, prima);
  await fase.click(); await p.waitForTimeout(250);
  ok('si apre l\'elenco del tool', await aperta().count() === 1);
  ok('la voce scelta è segnata', (await p.locator('.tendina-voce.scelta').textContent()) === prima);
  await p.screenshot({ path: 'shot-tendina-fase.png' });
  const altra = p.locator('.tendina-voce:not(.scelta)').first();
  const nuova = await altra.textContent();
  await altra.click(); await p.waitForTimeout(300);
  ok('scelta con un clic: l\'elenco si chiude', await aperta().count() === 0);
  ok('il tool riceve la scelta (editor ridisegnato)', (await p.locator('#aProto button.tendina.field').first().textContent()) === nuova,
     prima + ' → ' + nuova);

  console.log('\n── TASTIERA ────────────────────────────');
  const f2 = p.locator('#aProto button.tendina.field').first();
  await f2.focus(); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(200);
  ok('freccia giù apre', await aperta().count() === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok('Esc chiude senza cambiare', await aperta().count() === 0 && (await f2.textContent()) === nuova);
  ok('il fuoco torna al pulsante', await p.evaluate(() => document.activeElement.classList.contains('tendina')));
  await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  await p.keyboard.press('Home'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const primaVoce = await p.evaluate(() => document.querySelector('#aProto select').options[0].text);
  ok('Home e Invio scelgono la prima voce', (await p.locator('#aProto button.tendina.field').first().textContent()) === primaVoce, primaVoce);

  console.log('\n── FUORI DALL\'ELENCO ───────────────────');
  await p.locator('#aProto button.tendina.field').first().click(); await p.waitForTimeout(150);
  await p.mouse.click(1300, 880); await p.waitForTimeout(150);
  ok('un clic fuori chiude', await aperta().count() === 0);

  console.log('\n── BUILDER: GRUPPI E LISTA ─────────────');
  await p.evaluate(() => { pazienti = [{ accession: '0D1', nomeCompleto: 'PROVA', nascita: '01/01/1950', data: '28/09/2026', ora: '08:15',
    quesito: 'sospetta embolia polmonare', esami: [{ descrizione: 'TC TORACE' }], incerto: [], escluso: false }]; });
  await p.locator('.nav button[data-area="proto"]').click(); await p.locator('#vaiBuilder').click(); await p.waitForTimeout(400);
  const parti = p.locator('button.tendina[aria-label="Protocollo di partenza"]');
  await parti.click(); await p.waitForTimeout(250);
  ok('i gruppi del select diventano intestazioni', (await p.locator('.tendina-gruppo').allTextContents()).includes('Ufficiali'));
  await p.screenshot({ path: 'shot-tendina-gruppi.png' });
  await p.locator('.tendina-voce', { hasText: 'AngioTC Polmonare' }).click(); await p.waitForTimeout(400);
  ok('il builder parte dal protocollo scelto', await p.evaluate(() => bozza.base) === 'angio-polm', await p.evaluate(() => bozza.base));
  const lista = p.locator('button.tendina[aria-label="Prendi dalla lista"]');
  ok('anche «Prendi dalla lista»', await lista.count() === 1);
  await lista.click(); await p.waitForTimeout(200);
  await p.locator('.tendina-voce:not(.vuota)').first().click(); await p.waitForTimeout(400);
  ok('il caso della lista entra fra gli esempi', await p.evaluate(() => esempi.some(e => /embolia/.test(e.quesito))));

  console.log('\n── NESSUN SELECT SENZA PULSANTE ────────');
  ok('in tutta la pagina', await p.evaluate(() => [...document.querySelectorAll('select')].every(s => s.classList.contains('tendina-nativa')
    && s.nextElementSibling && s.nextElementSibling.classList.contains('tendina'))));

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail ? 1 : 0);
})();
