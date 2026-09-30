/* Backup automatico della libreria ufficiale in una cartella. I
   personali non ci sono: viaggiano nel profilo, sul telefono.
   La finestra di scelta della cartella non si può aprire in un test: al
   suo posto si usa lo spazio file privato del browser (OPFS), che
   Chromium espone con la stessa interfaccia di una cartella vera. OPFS
   non esiste per le pagine aperte da file://, quindi il tool qui è
   servito da un server locale, come da GitHub Pages.
   node build.js && node backup.test.js                                 */
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
const server = http.createServer((q, r) => {
  const f = path.join(__dirname, 'protocol-cards-pc.html');
  r.setHeader('Content-Type', 'text/html; charset=utf-8'); fs.createReadStream(f).pipe(r);
});
let FILE;

let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok  ' : '  FAIL') + ' │ ' + l + (x ? '  → ' + x : '')); if (!c) fail++; };

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  FILE = `http://127.0.0.1:${server.address().port}/protocol-cards-pc.html`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 120)); });
  await p.goto(FILE);
  await p.evaluate(async () => { localStorage.clear(); indexedDB.deleteDatabase('protocol-cards');
    const d = await navigator.storage.getDirectory(); for await (const k of d.keys()) await d.removeEntry(k, { recursive: true }); });
  await p.reload(); await p.waitForTimeout(300);
  const leggi = nome => p.evaluate(async n => { try { const d = await navigator.storage.getDirectory();
    return await (await (await d.getFileHandle(n)).getFile()).text(); } catch (_) { return null; } }, nome);

  console.log('── ALL\'INIZIO ──────────────────────────');
  ok('nel profilo, non nella libreria', await p.locator('#backup').isHidden());
  await p.locator('#profiloBtn').click(); await p.waitForTimeout(300);
  ok('riquadro del backup nelle impostazioni del profilo', await p.locator('#pannelloProfilo #backup').isVisible());
  ok('spento finché non si sceglie una cartella', /spento/i.test(await p.locator('#backupStato').textContent()));
  ok('pulsante «Scegli cartella»', (await p.locator('#backupCartella').textContent()) === 'Scegli cartella');

  console.log('\n── CARTELLA SCELTA ─────────────────────');
  await p.evaluate(async () => Backup.collega(await navigator.storage.getDirectory()));
  await p.waitForTimeout(200);
  let j = JSON.parse(await leggi('protocol-cards-backup.json') || 'null');
  ok('il backup viene scritto subito', !!j && j.app === 'Protocol Cards' && j.tipo === 'backup');
  ok('con la libreria ufficiale', j && j.ufficiale.protocolli.length === 14);
  ok('senza i personali: stanno nel profilo', j && !('personale' in j));
  ok('nessun dato paziente né chiave', j && !/pcsync-|"k":/.test(JSON.stringify(j)));
  ok('stato attivo con la cartella', /^Backup /.test(await p.locator('#backupStato').textContent()) && await p.locator('#backup.attivo').count() === 1,
     await p.locator('#backupStato').textContent());

  console.log('\n── SI AGGIORNA DA SOLO ─────────────────');
  const primo = await leggi('protocol-cards-backup.json');
  await p.evaluate(() => { libs.ufficiale.protocolli[0].idr = 1.9; salvaLibreria('ufficiale');
    libs.personale.protocolli.unshift({ id: 'p-prova', l: 'Prova reparto', idr: 1.2, giKg: .5, basale: 'opt', kw: ['prova'], ex: [], nota: '',
      fasi: [{ fase: 'venosa', zone: ['ADc'], delay: '70' }],
      appreso: { firma: 'TC TORACE|embolia', esame: 'TC TORACE', termini: ['embolia'], volte: 3, creato: 1, ultimo: 2 } });
    salvaLibreria('personale'); });
  await p.waitForTimeout(1300);
  j = JSON.parse(await leggi('protocol-cards-backup.json'));
  ok('modifica ai protocolli ufficiali salvata', j.ufficiale.protocolli[0].idr === 1.9);
  ok('i personali non entrano nel backup', !('personale' in j) && !/p-prova/.test(JSON.stringify(j)));
  ok('la versione precedente resta accanto', (await leggi('protocol-cards-backup.precedente.json')) === primo);
  await p.evaluate(async () => { for (let i = 0; i < 10; i++) salvaLibreria('personale'); await new Promise(r => setTimeout(r, 1200)); });
  await p.evaluate(async () => { for (let i = 0; i < 10; i++) { libs.ufficiale.protocolli[1].giKg = .5 + i / 100; salvaLibreria('ufficiale'); }
    await new Promise(r => setTimeout(r, 1200)); });
  j = JSON.parse(await leggi('protocol-cards-backup.json'));
  ok('di una raffica di modifiche resta l\'ultima', j.ufficiale.protocolli[1].giKg === .59, j.ufficiale.protocolli[1].giKg);

  console.log('\n── RIAPERTURA DEL TOOL ─────────────────');
  await p.reload(); await p.waitForTimeout(500);
  ok('ricorda la cartella', await p.evaluate(() => Backup.stato()) === 'attivo', await p.evaluate(() => Backup.stato()));

  console.log('\n── PC NUOVO: RECUPERO ──────────────────');
  /* un altro ospedale: il tool parte vuoto, la cartella del backup c'è */
  await p.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('protocol-cards'); });
  await p.reload(); await p.waitForTimeout(500);
  ok('libreria di partenza', await p.evaluate(() => libs.ufficiale.protocolli[0].idr !== 1.9));
  ok('backup spento', await p.evaluate(() => Backup.stato()) === 'spento');
  await p.evaluate(async () => Backup.recupera(await navigator.storage.getDirectory()));
  await p.waitForTimeout(300);
  ok('chiede conferma con i numeri del backup', /14 protocolli ufficiali\. Sostituiranno/.test(await p.locator('#mTesto, .mask.on').first().textContent()),
     (await p.locator('.mask.on').first().textContent()).replace(/\s+/g, ' ').slice(0, 160));
  await p.locator('.mask.on .btn.solid').click(); await p.waitForTimeout(1300);
  ok('protocolli ufficiali recuperati', await p.evaluate(() => libs.ufficiale.protocolli[0].idr) === 1.9);
  ok('e salvati su questo PC', await p.evaluate(() => JSON.parse(localStorage.getItem('protocol-cards.pc.libreria')).protocolli[0].idr) === 1.9);
  ok('i personali non si toccano', await p.evaluate(() => libs.personale.protocolli.length) === 0);
  ok('la cartella del backup resta collegata', await p.evaluate(() => Backup.stato()) === 'attivo');

  console.log('\n── CARTELLA SENZA BACKUP ───────────────');
  await p.evaluate(async () => { const d = await navigator.storage.getDirectory();
    const vuota = await d.getDirectoryHandle('vuota', { create: true }); await Backup.recupera(vuota); });
  await p.waitForTimeout(300);
  ok('lo dice e non tocca nulla', /non c'è un backup/.test(await p.locator('.mask.on').first().textContent())
     && await p.evaluate(() => libs.ufficiale.protocolli[0].idr) === 1.9);

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); server.close(); process.exit(fail ? 1 : 0);
})();
