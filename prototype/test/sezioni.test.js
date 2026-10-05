/* Sezioni della scheda: i distretti della richiesta diventano sezioni,
   le fasi si scelgono per sezione e le acquisizioni si compongono da sole. */
const { chromium } = require('playwright');
const path = require('path');
let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok  ' : '  FAIL') + ' │ ' + l + (x ? '  → ' + x : '')); if (!c) fail++; };
const FILE = 'file://' + path.resolve(__dirname, '../index.html');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
  await p.addInitScript(() => { try { localStorage.setItem('pc.v4.profiloRimandato', 'true'); } catch (_) {} });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);

  /* una scheda con la richiesta data, aperta */
  const apri = async (esame, quesito = 'controllo') => {
    if (await p.evaluate(() => !!cur)) { await p.locator('#back').click(); await p.waitForTimeout(900); }
    await p.evaluate(([e, q]) => {
      Object.assign(state[0], { esame: e, quesito: q, fasi: [], stato: 'todo', proto: matchProtocol(e, q) }); delete state[0].sezioni; delete state[0].separa;
      persist(); show('board'); }, [esame, quesito]);
    await p.locator('.card-mini').first().click(); await p.waitForTimeout(1100);
  };
  const acq = () => p.evaluate(() => cur.fasi.map(f => f.fase + ':' + f.zone.join('+')).join(' '));
  const sezioni = () => p.evaluate(() => [...document.querySelectorAll('#sezioni .sez')].map(x => x.dataset.k).join(','));
  const tocca = async (k, f) => {
    if (!(await p.locator(`.sez[data-k="${k}"].aperta`).count())) await p.locator(`.sez[data-k="${k}"] .sez-h`).click();
    await p.locator(`.sez[data-k="${k}"] [data-f="${f}"]`).click();
  };

  console.log('── SEZIONI DALLA RICHIESTA ─────────────');
  await apri('TC TORACE CON MDC | TC ADDOME COMPLETO CON MDC');
  ok('torace e addome', await sezioni() === 'TO,AD', await sezioni());
  ok('all\'inizio nessuna fase', await acq() === '');
  await apri('TC TORACE CON MDC E ADDOME CON MDC');
  ok('anche in una sola riga', await sezioni() === 'TO,AD', await sezioni());
  await apri('TC ADDOME SUPERIORE CON MDC');
  ok('addome superiore riconosciuto', await p.locator('.sez[data-k="AD"] .sez-n').textContent().then(t => /superiore/.test(t)));
  await apri('TC COLLO TORACE ADDOME CON MDC');
  ok('collo, torace, addome', await sezioni() === 'Collo,TO,AD', await sezioni());
  await apri('TC ENCEFALO + ANGIO TC VASI INTRACRANICI E DEL COLLO');
  ok('encefalo e collo', await sezioni() === 'ENC,Collo', await sezioni());

  console.log('\n── UNIONE AUTOMATICA ───────────────────');
  await apri('TC TORACE CON MDC | TC ADDOME COMPLETO CON MDC');
  await tocca('TO', 'venosa');
  ok('torace in venosa', await acq() === 'venosa:TO', await acq());
  await tocca('AD', 'venosa');
  ok('con l\'addome nella stessa fase: torace-addome completo', await acq() === 'venosa:TAc', await acq());
  await tocca('TO', 'arteriosa');
  ok('fasi diverse restano separate', await acq() === 'arteriosa:TO venosa:TAc', await acq());
  ok('la sezione mostra le sue fasi', (await p.locator('.sez[data-k="TO"] .sez-p').textContent()) === 'ARTVEN');
  await p.locator('.row-s').first().click();
  ok('«separa» tiene distinti torace e addome', await acq() === 'arteriosa:TO venosa:TO+ADc', await acq());
  await p.locator('.row-s').first().click();
  ok('«unisci» li riunisce', await acq() === 'arteriosa:TO venosa:TAc', await acq());
  await tocca('TO', 'venosa');
  ok('togliendo la venosa al torace resta l\'addome', await acq() === 'arteriosa:TO venosa:ADc', await acq());
  await apri('TC COLLO TORACE ADDOME CON MDC');
  for (const k of ['Collo', 'TO', 'AD']) await tocca(k, 'venosa');
  ok('collo + torace-addome in una scansione', await acq() === 'venosa:Collo TAc', await acq());
  await apri('TC ADDOME SUPERIORE CON MDC | TC TORACE CON MDC');
  await tocca('TO', 'venosa'); await tocca('AD', 'venosa');
  ok('con l\'addome superiore: torace-addome superiore', await acq() === 'venosa:TAs', await acq());

  console.log('\n── SOLO FASI POSSIBILI ─────────────────');
  await apri('TC ENCEFALO CON E SENZA MDC');
  await p.locator('.sez[data-k="ENC"] .sez-h').click();
  const fasiEnc = await p.locator('.sez[data-k="ENC"] [data-f]').evaluateAll(n => n.map(x => x.dataset.f).join(','));
  ok('encefalo: c\'è il ritardo 5\'', fasiEnc.includes('ritardo'), fasiEnc);
  ok('encefalo: niente urografica', !fasiEnc.includes('urografica'));
  await tocca('ENC', 'basale'); await tocca('ENC', 'ritardo');
  ok('ritardo 5\' sull\'encefalo, 300 s', await acq() === 'basale:ENC ritardo:ENC'
     && await p.evaluate(() => cur.fasi.find(f => f.fase === 'ritardo').delay) === '300', await acq());
  ok('il ritardo conta come fase con contrasto', await p.evaluate(() => !document.querySelector('.calc').classList.contains('vuoto')));
  await apri('TC TORACE CON MDC');
  await p.locator('.sez[data-k="TO"] .sez-h').click();
  ok('il ritardo 5\' è solo per l\'encefalo', await p.locator('.sez[data-k="TO"] [data-f="ritardo"]').count() === 0);

  console.log('\n── SEZIONI A MANO ──────────────────────');
  await p.locator('#sezAgg button[data-k="AD"]').click();
  ok('si aggiunge una sezione', await sezioni() === 'TO,AD');
  await tocca('TO', 'venosa'); await tocca('AD', 'venosa');
  await p.locator('.sez[data-k="AD"] [data-ad]').click();
  ok('addome superiore ↔ completo', await acq() === 'venosa:TAs', await acq());
  await p.locator('.sez[data-k="AD"] [data-via]').click();
  ok('togliendo la sezione si tolgono le sue fasi', await acq() === 'venosa:TO' && await sezioni() === 'TO', await acq());

  console.log('\n── PROTOCOLLO SUGGERITO ────────────────');
  await apri('TC TORACE ADDOME CON MDC', 'Ristadiazione neoplasia');
  await p.locator('#applyBtn').click(); await p.waitForTimeout(300);
  const m = await p.evaluate(() => { const x = fasiDelleSezioni(); return ['TO', 'AD'].map(k => [...x[k]].join('+')).join(' | '); });
  ok('le fasi del protocollo si stendono sulle sezioni', /venosa/.test(m.split(' | ')[0]) && /venosa/.test(m.split(' | ')[1]), m);
  await p.locator('#setBtn').click(); await p.waitForTimeout(1200);
  if (await p.evaluate(() => !!cur)) { await p.locator('#back').click(); await p.waitForTimeout(900); }
  await p.locator(`.card-mini[data-id="${await p.evaluate(() => state[0].id)}"]`).click(); await p.waitForTimeout(1100);
  ok('riaprendo la scheda le sezioni restano', await sezioni() === 'TO,AD');

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail ? 1 : 0);
})();
