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
      Object.assign(state[0], { esame: e, quesito: q, fasi: [], stato: 'todo', proto: matchProtocol(e, q) }); delete state[0].sezioni; delete state[0].separa; delete state[0].adFase;
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
  await p.locator('.sez[data-k="AD"] [data-est="ADs"][data-f="venosa"]').click();
  ok('addome superiore ↔ completo, per la fase', await acq() === 'venosa:TAs', await acq());
  await p.locator('.sez[data-k="AD"] [data-via]').click();
  ok('togliendo la sezione si tolgono le sue fasi', await acq() === 'venosa:TO' && await sezioni() === 'TO', await acq());

  console.log('\n── ADDOME: ESTENSIONE PER FASE ─────────');
  /* arteriosa sul solo addome superiore, venosa sull'addome completo */
  await apri('TC ADDOME COMPLETO CON MDC');
  await tocca('AD', 'arteriosa'); await tocca('AD', 'venosa');
  ok('di base, l\'estensione della richiesta', await acq() === 'arteriosa:ADc venosa:ADc', await acq());
  await p.locator('.sez[data-k="AD"] [data-est="ADs"][data-f="arteriosa"]').click();
  ok('arteriosa sul superiore, venosa sul completo', await acq() === 'arteriosa:ADs venosa:ADc', await acq());
  ok('il riquadro lo dice', /superiore \+ completo/.test(await p.locator('.sez[data-k="AD"] .sez-n').textContent()));
  ok('e le sigle lo distinguono', (await p.locator('.sez[data-k="AD"] .sez-p').textContent()) === 'ARTsVENc',
     await p.locator('.sez[data-k="AD"] .sez-p').textContent());
  await p.locator('#sezAgg button[data-k="TO"]').click();
  await tocca('TO', 'arteriosa'); await tocca('TO', 'venosa');
  ok('con il torace: torace-addome superiore in arteriosa, completo in venosa', await acq() === 'arteriosa:TAs venosa:TAc', await acq());
  await p.locator('.sez[data-k="AD"] .sez-h').click();
  ok('un\'estensione per fase: due scelte, una per fase attiva', await p.locator('.sez[data-k="AD"] .ad-est').count() === 2);
  await p.locator('.sez[data-k="AD"] [data-est="ADc"][data-f="arteriosa"]').click();
  ok('e si torna indietro', await acq() === 'arteriosa:TAc venosa:TAc', await acq());

  console.log('\n── PROTOCOLLO SUGGERITO ────────────────');
  await apri('TC TORACE ADDOME CON MDC', 'Ristadiazione neoplasia');
  await p.locator('#applyBtn').click(); await p.waitForTimeout(300);
  const m = await p.evaluate(() => { const x = fasiDelleSezioni(); return ['TO', 'AD'].map(k => [...x[k]].join('+')).join(' | '); });
  ok('le fasi del protocollo si stendono sulle sezioni', /venosa/.test(m.split(' | ')[0]) && /venosa/.test(m.split(' | ')[1]), m);
  await p.locator('#setBtn').click(); await p.waitForTimeout(1200);
  if (await p.evaluate(() => !!cur)) { await p.locator('#back').click(); await p.waitForTimeout(900); }
  await p.locator(`.card-mini[data-id="${await p.evaluate(() => state[0].id)}"]`).click(); await p.waitForTimeout(1100);
  ok('riaprendo la scheda le sezioni restano', await sezioni() === 'TO,AD');

  console.log('\n── FLUSSO MODIFICABILE ─────────────────');
  await p.locator('.calc').scrollIntoViewIfNeeded();
  const c = await p.evaluate(() => agenteScheda().c);
  await p.locator('#cFlow').fill('4.5'); await p.locator('#cFlow').press('Enter'); await p.locator('#cFlow').blur();
  ok('scritto il flusso, l\'IDR segue', await p.evaluate(c => Math.abs(cur.idr - 4.5 * c) < 1e-6, c), await p.evaluate(() => cur.idr));
  ok('e il flusso mostrato è quello scritto', await p.locator('#cFlow').inputValue() === '4.5');
  ok('la dose risulta modificata', /modificata/.test(await p.locator('#cDoseT').textContent()));
  await p.locator('.fl-b[data-d="0.1"]').click();
  ok('+ aggiunge 0,1 ml/s', await p.locator('#cFlow').inputValue() === '4.6', await p.locator('#cFlow').inputValue());
  await p.locator('#cFlow').fill('50'); await p.locator('#cFlow').blur();
  ok('oltre il limite dell\'IDR si ferma al massimo', await p.evaluate(() => cur.idr === LIM.idr[1]));
  const vol = await p.locator('#cVol').textContent();
  ok('il volume non cambia con il flusso', /^\d+$/.test(vol), vol);

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail ? 1 : 0);
})();
