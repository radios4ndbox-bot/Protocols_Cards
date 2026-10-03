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
  /* il primo accesso (nome e cognome) ha il suo test: qui si rimanda */
  await p.addInitScript(() => { try { localStorage.setItem('pc.v4.profiloRimandato', 'true'); } catch (_) {} });
  const errori = [];
  p.on('pageerror', e => errori.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errori.push('console: ' + m.text().slice(0, 120)); });

  await p.goto(FILE);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(400);

  console.log('── APERTURA: LA CARTA SI GIRA ──────────');
  ok('una carta al centro, con gli angoli arrotondati', await p.evaluate(() => {
    const d = document.querySelector('#apertura .ap-dorso'), r = d.getBoundingClientRect();
    return r.width > 200 && r.width < 412 && Math.abs(r.left + r.width / 2 - 206) < 30
      && parseFloat(getComputedStyle(d).borderTopLeftRadius) >= 16; }));
  ok('con uno spessore', await p.evaluate(() => document.querySelectorAll('#apertura .ap-lato').length === 4
    && getComputedStyle(document.querySelector('#apertura .ap-carta')).transformStyle === 'preserve-3d'));
  ok('sul fronte la pagina in miniatura, con l\'intestazione dell\'app', await p.locator('#apertura .ap-fronte .ap-pagina .appbar h1').count() === 1);
  ok('la copia non duplica gli id della pagina', await p.locator('#apertura [id]').count() === 0 || await p.evaluate(() =>
     [...document.querySelectorAll('#apertura [id]')].every(e => document.querySelectorAll('#' + CSS.escape(e.id)).length === 1)));
  ok('il marchio è già stampato sul dorso', await p.evaluate(() => getComputedStyle(document.querySelector('#apertura .ap-dorso svg')).opacity === '1'));
  ok('con il marchio StructuRad', await p.locator('#apertura .ap-dorso svg path').count() > 10);
  ok('niente calendario né scelta della seduta',
     await p.locator('#calendar, #session, #tcEl, #tcEm').count() === 0);
  const giro = [];
  for (let i = 0; i < 60; i++) {                      // ~3,6 s: entrata, giro, allargamento, rimozione
    await p.waitForTimeout(60);
    giro.push(await p.evaluate(() => {
      const d = document.querySelector('#apertura .ap-carta');
      return d ? getComputedStyle(d).transform : 'tolto';
    }));
  }
  ok('la carta ruota in 3D', giro.some(t => t.startsWith('matrix3d')), giro.find(t => t.startsWith('matrix3d')) ? 'sì' : giro.join(' | ').slice(0, 80));
  ok('poi viene tolto', giro[giro.length - 1] === 'tolto');
  await p.waitForTimeout(800);
  ok('sotto c\'è la bacheca', await p.locator('#board:not(.hidden)').count() === 1);
  ok('nessuna rotazione residua', await p.evaluate(() => getComputedStyle(document.body).transform) === 'none');

  console.log('\n── SOLO OGGI E I GIORNI A VENIRE ───────');
  ok('le schede d\'esempio di ieri non ci sono più', await p.evaluate(() => !state.some(x => x.data < TODAY)));
  ok('quelle di domani restano', await p.evaluate(() => state.some(x => x.data > TODAY)));

  console.log('\n── LA SEDUTA LA DECIDE IL PC ───────────');
  ok('seduta d\'esempio: oggi, elettiva', await p.evaluate(() => sessione && sessione.data === TODAY && sessione.modo === 'elettiva'));
  ok('titolo della seduta', (await p.locator('#abTitle').textContent()) === 'TC elettiva');
  ok('modalità elettiva', await p.evaluate(() => document.body.dataset.m) === 'elettiva');
  ok('sfondo verde pastello',
     await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(241, 250, 246)');
  ok('8 schede elettive', await p.locator('.card-mini').count() === 8);
  ok('nessuna scheda manuale in elettiva', await p.locator('#btnNew.hidden').count() === 1);
  ok('indietro nascosto sulla bacheca', await p.locator('#navBack.hide').count() === 1);

  console.log('\n── SCAGLIONAMENTO ──────────────────────');
  await p.reload();
  /* la carta si toglie nello stesso istante in cui i pazienti iniziano a entrare */
  await p.waitForFunction(() => !document.getElementById('apertura'));
  const rit = await p.evaluate(() => [...document.querySelectorAll('#board .rise')]
    .map(x => Math.round(parseFloat(getComputedStyle(x).animationDelay) * 1000)));
  ok('tolta la carta, le schede entrano dall\'alto', rit.length > 4 && rit.every((v, i) => i === 0 || v > rit[i-1]),
     rit.length + ' nodi');
  const passi = [...new Set(rit.slice(1).map((v, i) => v - rit[i]))];
  ok('passo costante', passi.length === 1, passi.join(',') + ' ms');
  await p.waitForTimeout(900);

  console.log('\n── LA MINIATURA COINCIDE CON LA PAGINA ─');
  /* la carta nello stato finale dell'allargamento: l'intestazione in
     miniatura deve stare esattamente sopra quella vera                 */
  await p.reload();
  await p.waitForFunction(() => document.querySelector('#apertura .ap-pagina'));
  const scarto = await p.evaluate(() => {
    const ap = document.getElementById('apertura'); ap.classList.add('gira', 'espandi');
    const sc = ap.querySelector('.ap-scena'), ca = ap.querySelector('.ap-carta');
    sc.style.animation = 'none'; sc.style.opacity = '1';
    sc.style.transform = `scale(${getComputedStyle(ap).getPropertyValue('--s-pieno')})`; ca.style.animation = 'none';
    const mini = ap.querySelector('.ap-pagina .appbar');
    const coppie = [[mini.querySelector('h1'), document.getElementById('abTitle')],
                    [mini.querySelectorAll('.ico')[2], document.getElementById('btnSet')]];
    return Math.max(...coppie.flatMap(([a, b]) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
      return [x.left - y.left, x.top - y.top, x.width - y.width, x.height - y.height].map(Math.abs); }));
  });
  ok('a fine allargamento l\'intestazione coincide al pixel', scarto < 0.5, scarto.toFixed(2) + ' px');
  await p.reload(); await p.waitForFunction(() => !document.getElementById('apertura'), null, { timeout: 8000 });

  console.log('\n── UN TOCCO SALTA L\'ATTESA ─────────────');
  await p.reload(); await p.waitForTimeout(200);
  await p.locator('#apertura').click();
  await p.waitForTimeout(1800);                       // giro (820 ms), fronte a tutto schermo (460 ms), via (180 ms)
  ok('la carta si è già girata', await p.locator('#apertura').count() === 0);
  await p.waitForTimeout(500);

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

  console.log('\n── SEDUTA DI PRONTO SOCCORSO ───────────');
  /* dal PC arriva la lista con la seduta di pronto soccorso: qui la si
     imposta come farebbe l'importazione, e l'app riparte su quella     */
  await p.evaluate(() => localStorage.setItem('pc.v4.sessione', JSON.stringify({ data: TODAY, modo: 'emergenza' })));
  await p.reload(); await p.waitForTimeout(2200);
  ok('modalità emergenza', await p.evaluate(() => document.body.dataset.m) === 'emergenza');
  ok('titolo pronto soccorso', (await p.locator('#abTitle').textContent()) === 'TC di pronto soccorso');
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
  ok('esame da tendina: richieste frequenti del pronto soccorso', await p.locator('#nEsameSel option').count() >= 12);
  await p.locator('#nEsameSel').selectOption('TC ADDOME COMPLETO CON MDC');
  ok('senza «Altro» il campo libero resta nascosto', await p.locator('#nEsame').isHidden());
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
  ok('elettiva intatta', await p.evaluate(() => state.filter(x => x.data === TODAY && x.modo === 'elettiva').length) === 8);
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
  ok('riparte dalla bacheca della seduta', await p.locator('#board:not(.hidden)').count() === 1
     && await p.evaluate(() => document.body.dataset.m) === 'emergenza');
  ok('protocolli appresi conservati',
     Object.keys(await p.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.learned')))).length === 1);

  console.log('\n────────────────────────────────────────');
  console.log(errori.length ? 'ERRORI JS: ' + errori.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  console.log(falliti ? `✗ ${falliti} CONTROLLI FALLITI` : '✓ TUTTI I CONTROLLI PASSATI');
  await b.close();
  process.exit(falliti ? 1 : 0);
})();
