/* Interazione del prototipo: calendario, sedute, schede, apprendimento,
   fine giornata e cestino. Gira su ../index.html aperto da file://.      */
const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '../index.html');

let falliti = 0;
const ok = (etichetta, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + ' │ ' + etichetta + (extra ? '  → ' + extra : ''));
  if (!cond) falliti++;
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 412, height: 915 },
                              deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errori = [];
  p.on('pageerror', e => errori.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text().slice(0, 120)); });

  await p.goto(FILE);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(400);

  console.log('── CALENDARIO ──────────────────────────');
  ok('parte dal calendario', await p.locator('#calendar:not(.hidden)').count() === 1);
  ok('oggi evidenziato', await p.locator('.day.today').count() === 1);
  ok('oggi ha entrambe le sedute', await p.locator('.day.today .day-dots i').count() === 2);
  ok('giorni con esami marcati', await p.locator('.day.has').count() >= 3,
     await p.locator('.day.has').count() + ' giorni');
  const mese = await p.locator('#calM').textContent();
  await p.locator('#calNext').click(); await p.waitForTimeout(200);
  ok('cambio mese', (await p.locator('#calM').textContent()) !== mese);
  await p.locator('#calPrev').click(); await p.waitForTimeout(200);
  ok('ritorno al mese', (await p.locator('#calM').textContent()) === mese);

  console.log('\n── SCELTA SEDUTA ───────────────────────');
  await p.locator('.day.today').click(); await p.waitForTimeout(350);
  ok('vista seduta', await p.locator('#session:not(.hidden)').count() === 1);
  ok('titolo Oggi', (await p.locator('#sesTitle').textContent()) === 'Oggi');
  ok('conteggio elettiva', (await p.locator('#elN').textContent()) === '8',
     await p.locator('#elN').textContent());
  ok('conteggio emergenza', (await p.locator('#emN').textContent()) === '3');
  ok('nuvole rotanti', await p.locator('.tc-back svg').count() === 4);

  console.log('\n── ESPANSIONE A TUTTO SCHERMO ──────────');
  const seq = [];
  p.locator('#tcEl').click();
  for (let i = 0; i < 9; i++) {
    await p.waitForTimeout(55);
    seq.push(await p.evaluate(() => {
      const g = document.querySelector('.ghost');
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    }));
  }
  const vivi = seq.filter(Boolean);
  ok('il clone cresce senza salti all\'indietro',
     vivi.length > 2 && vivi.every((s, i) => i === 0 || s.w >= vivi[i-1].w),
     vivi.length + ' fotogrammi');
  ok('arriva a tutto schermo', vivi.some(s => s.w >= 412 && s.h >= 915));
  await p.waitForTimeout(1200);
  ok('nessun clone residuo', await p.locator('.ghost').count() === 0);

  console.log('\n── SCAGLIONAMENTO ──────────────────────');
  await p.locator('#navBack').click(); await p.waitForTimeout(950);
  await p.locator('#tcEl').click(); await p.waitForTimeout(500);
  const rit = await p.evaluate(() => [...document.querySelectorAll('#board .rise')]
    .map(x => Math.round(parseFloat(getComputedStyle(x).animationDelay) * 1000)));
  ok('ritardi crescenti dall\'alto', rit.length > 4 && rit.every((v, i) => i === 0 || v > rit[i-1]),
     rit.length + ' nodi');
  const passi = [...new Set(rit.slice(1).map((v, i) => v - rit[i]))];
  ok('passo costante', passi.length === 1, passi.join(',') + ' ms');
  await p.waitForTimeout(900);

  console.log('\n── TEMA DELLA SEDUTA ───────────────────');
  ok('modalità elettiva', await p.evaluate(() => document.body.dataset.m) === 'elettiva');
  ok('sfondo verde pastello',
     await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(241, 250, 246)');
  ok('8 schede elettive', await p.locator('.card-mini').count() === 8);
  ok('nessuna scheda manuale in elettiva', await p.locator('#btnNew.hidden').count() === 1);

  console.log('\n── SCHEDA PAZIENTE ─────────────────────');
  const nomi = await p.locator('.mini-name').allTextContents();
  await p.locator('.card-mini').first().click(); await p.waitForTimeout(1400);
  ok('scheda aperta', await p.locator('#detail.open').count() === 1);
  ok('anagrafica completa', /anni/.test(await p.locator('#dMeta').textContent())
     && /nat\./.test(await p.locator('#dMeta').textContent()));
  ok('protocollo suggerito', (await p.locator('.opt-n').first().textContent()).length > 4,
     await p.locator('.opt-n').first().textContent());
  ok('nessuna fase prima di applicare', await p.locator('.row').count() === 0);
  await p.locator('#applyBtn').click(); await p.waitForTimeout(400);
  ok('applicare riempie le fasi', await p.locator('.row').count() >= 1);
  ok('calcolo mdc', /\d+/.test(await p.locator('#cVol').textContent()),
     (await p.locator('#cVol').textContent()) + ' ml');

  console.log('\n── COMBO FASE → ZONE ───────────────────');
  ok('zone bloccate senza fase', await p.locator('#ddZone').isDisabled());
  await p.selectOption('#ddPhase', 'basale');
  await p.locator('#ddZone').click(); await p.waitForTimeout(200);
  ok('zone della basale', (await p.locator('#pop .pop-i span').allTextContents()).join(' ')
     === 'ENC Collo TO ADs ADc TAs TAc');
  await p.locator('#pop .pop-i').nth(2).click();
  await p.locator('#addBtn').click(); await p.waitForTimeout(300);
  ok('fase aggiunta', (await p.locator('.row-n').allTextContents()).includes('Basale'));

  console.log('\n── APPRENDIMENTO ───────────────────────');
  await p.locator('#setBtn').click(); await p.waitForTimeout(1800);
  const app1 = await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.learned')));
  ok('una voce appresa', Object.keys(app1).length === 1, Object.keys(app1)[0]);
  ok('conteggio a 1', Object.values(app1)[0].count === 1);
  await p.locator('.card-mini').first().click(); await p.waitForTimeout(1400);
  ok('appreso proposto per primo',
     (await p.locator('.tag').first().textContent()).includes('APPRESO'));
  await p.locator('#applyBtn').click(); await p.waitForTimeout(300);
  await p.locator('#setBtn').click(); await p.waitForTimeout(1800);
  const app2 = await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.learned')));
  ok('stessa configurazione → conteggio a 2', Object.values(app2)[0].count === 2);
  ok('nessuna firma nuova', Object.keys(app2).length === 1);

  console.log('\n── SWIPE E CHECKPOINT ──────────────────');
  const prima = (await p.locator('.cp-n').first().textContent());
  const box = await p.locator('.card-mini').nth(1).boundingBox();
  await p.mouse.move(box.x + box.width - 12, box.y + box.height / 2);
  await p.mouse.down();
  for (let i = 1; i <= 10; i++) await p.mouse.move(box.x + box.width - 12 - i * 11, box.y + box.height / 2);
  await p.mouse.up(); await p.waitForTimeout(500);
  ok('swipe ← completa l\'esame',
     await p.locator('.slot').nth(1).getAttribute('data-state') === 'done');
  ok('contatore di sessione aggiornato',
     (await p.locator('.cp-n').first().textContent()) !== prima,
     prima + ' → ' + (await p.locator('.cp-n').first().textContent()));

  console.log('\n── SEDUTA DI EMERGENZA ─────────────────');
  await p.locator('#navBack').click(); await p.waitForTimeout(950);
  await p.locator('#tcEm').click(); await p.waitForTimeout(1300);
  ok('modalità emergenza', await p.evaluate(() => document.body.dataset.m) === 'emergenza');
  ok('sfondo rosato',
     await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(253, 243, 247)');
  ok('scheda manuale disponibile', await p.locator('#btnNew').isVisible());

  console.log('\n── SCHEDA MANUALE ──────────────────────');
  await p.locator('#btnNew').click(); await p.waitForTimeout(350);
  await p.locator('#ncCreate').click(); await p.waitForTimeout(250);
  ok('i campi obbligatori bloccano', await p.locator('#eNome.show').count() === 1);
  await p.locator('#nNome').fill('neri giorgio');
  await p.locator('#nNasc').fill('1962-04-11');
  await p.locator('#nPeso').fill('84');
  await p.locator('#nEsame').fill('tc addome completo con mdc');
  await p.locator('#nQ').fill('Sospetta diverticolite complicata');
  await p.locator('#ncCreate').click(); await p.waitForTimeout(500);
  ok('scheda creata', await p.locator('.card-mini').count() === 4);
  ok('nome normalizzato',
     (await p.locator('.mini-name').allTextContents()).includes('NERI GIORGIO'));

  console.log('\n── FINE GIORNATA E CESTINO ─────────────');
  const quanti = await p.locator('.card-mini').count();
  await p.locator('#btnEod').click(); await p.waitForTimeout(300);
  ok('chiede conferma', await p.locator('#mask').isVisible());
  await p.locator('#mNo').click(); await p.waitForTimeout(250);
  ok('annullare non cancella', await p.locator('.card-mini').count() === quanti);
  await p.locator('#btnEod').click(); await p.waitForTimeout(300);
  await p.locator('#mYes').click(); await p.waitForTimeout(500);
  ok('seduta svuotata', await p.locator('.card-mini').count() === 0);
  ok('badge del cestino', (await p.locator('#trashN').textContent()) === String(quanti));
  await p.locator('#navBack').click(); await p.waitForTimeout(400);
  ok('elettiva intatta', (await p.locator('#elN').textContent()) === '8',
     await p.locator('#elN').textContent());
  await p.locator('#btnTrash').click(); await p.waitForTimeout(350);
  ok('elementi nel cestino', await p.locator('#trashList .item').count() === quanti);
  ok('conto alla rovescia', /\d+h/.test(await p.locator('.ttl').first().textContent()),
     await p.locator('.ttl').first().textContent());
  await p.locator('#trashList .mini-b').first().click(); await p.waitForTimeout(350);
  ok('ripristino', await p.locator('#trashList .item').count() === quanti - 1);

  console.log('\n── SCADENZA A 24 ORE ───────────────────');
  await p.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('pc.v4.trash'));
    t[0].deletedAt = Date.now() - 25 * 3600 * 1000;     // scaduta
    if (t[1]) t[1].deletedAt = Date.now() - 23 * 3600 * 1000;   // ancora viva
    localStorage.setItem('pc.v4.trash', JSON.stringify(t));
  });
  const prima24 = await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.trash')).length);
  await p.reload(); await p.waitForTimeout(500);
  const dopo24 = await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.trash')).length);
  ok('la scaduta viene eliminata', dopo24 === prima24 - 1, `${prima24} → ${dopo24}`);
  ok('la non scaduta resta',
     await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.trash'))
       .some(x => Date.now() - x.deletedAt > 22 * 3600 * 1000)));

  console.log('\n── PERSISTENZA ─────────────────────────');
  ok('riparte dal calendario', await p.locator('#calendar:not(.hidden)').count() === 1);
  ok('protocolli appresi conservati',
     Object.keys(await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.learned')))).length === 1);

  console.log('\n────────────────────────────────────────');
  console.log(errori.length ? 'ERRORI JS: ' + errori.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  console.log(falliti ? `✗ ${falliti} CONTROLLI FALLITI` : '✓ TUTTI I CONTROLLI PASSATI');
  await b.close();
  process.exit(falliti ? 1 : 0);
})();
