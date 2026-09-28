/* Profilo dell'operatore: i protocolli personali viaggiano con il
   telefono da un PC all'altro, da un ospedale all'altro.

   Relay finto locale, come in sincronizzazione.test.js. Tre contesti
   del browser che non condividono nulla: il PC dell'ospedale A, il
   telefono, il PC dell'ospedale B.
   node build.js && node profilo.test.js                                */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');
const fs = require('fs');

let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok  ' : '  FAIL') + ' │ ' + l + (x ? '  → ' + x : '')); if (!c) fail++; };
const attendi = async (f, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await new Promise(r => setTimeout(r, 80)); } return false; };

/* ─── relay finto, compatibile con ntfy ─────────────────────────────── */
const argomenti = new Map();        // argomento → { msg: [], ascolti: Set }
let seq = 0;
const arg = t => { if (!argomenti.has(t)) argomenti.set(t, { msg: [], ascolti: new Set() }); return argomenti.get(t); };
const relay = http.createServer((q, r) => {
  r.setHeader('Access-Control-Allow-Origin', '*');
  const u = new URL(q.url, 'http://x');
  const pezzi = u.pathname.split('/').filter(Boolean);
  if (u.pathname === '/v1/health') { r.setHeader('Content-Type', 'application/json'); return r.end('{"healthy":true}'); }
  if (q.method === 'POST' && pezzi.length === 1) {
    let corpo = ''; q.on('data', d => corpo += d); q.on('end', () => {
      const e = { id: 'm' + (++seq), time: Date.now() / 1000 | 0, event: 'message', topic: pezzi[0], message: corpo };
      const a = arg(pezzi[0]); a.msg.push(e);
      a.ascolti.forEach(s => s.write(`data: ${JSON.stringify(e)}\n\n`));
      r.setHeader('Content-Type', 'application/json'); r.end(JSON.stringify(e));
    });
    return;
  }
  if (q.method === 'GET' && pezzi[1] === 'sse') {
    r.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    const a = arg(pezzi[0]);
    r.write(`data: ${JSON.stringify({ id: 'o' + (++seq), event: 'open', topic: pezzi[0] })}\n\n`);
    if (u.searchParams.get('since') === 'all') a.msg.forEach(e => r.write(`data: ${JSON.stringify(e)}\n\n`));
    a.ascolti.add(r); q.on('close', () => a.ascolti.delete(r));
    return;
  }
  r.statusCode = 404; r.end();
});


const PC  = 'file://' + path.resolve(__dirname, 'protocol-cards-pc.html');
const TEL = 'file://' + path.resolve(__dirname, '../prototype/index.html');

const protocollo = (id, l, kw) => ({ id, l, idr: 1.3, giKg: .5, basale: 'skip', kw, ex: [], nota: '',
  fasi: [{ fase: 'venosa', zone: ['TAc'], delay: '75' }] });

(async () => {
  await new Promise(r => relay.listen(0, '127.0.0.1', r));
  const RELAY = `http://127.0.0.1:${relay.address().port}`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const contesto = async (opz) => {
    const c = await b.newContext({ reducedMotion: 'reduce', acceptDownloads: true, ...opz });
    await c.addInitScript(r => { window.__relay = r; }, RELAY);
    await c.route('https://ntfy.sh/**', r => r.abort());
    return c;
  };
  const apri = async (c, url) => {
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !(m.location().url || '').startsWith('https://ntfy.sh/')) errs.push('console: ' + m.text().slice(0, 120)); });
    await p.goto(url);
    await p.evaluate(() => Canale.usaRelay(window.__relay));
    return p;
  };
  /* abbina un PC al telefono come farebbe l'operatore: QR sul PC, link sul telefono */
  const abbina = async (pc, cTel) => {
    await pc.evaluate(() => { pazienti = [{ accession: '0D1', nomeCompleto: 'X', nascita: '01/01/1950', data: '01/01/2030', ora: '08:00',
      quesito: 'x', esami: [{ descrizione: 'TC TORACE' }], incerto: [], escluso: false }]; vai(3); });
    await pc.locator('#reteAbbina').click();
    await attendi(() => pc.locator('#qrAbb').isVisible());
    const a = await pc.evaluate(() => inAbbinamento);
    const tel = await apri(cTel, TEL + `#t=${a.t}&k=${a.k}`);
    await tel.evaluate(() => avviaPc());
    await attendi(async () => !!(await pc.evaluate(() => abbinamento)));
    return tel;
  };

  const cA = await contesto({ viewport: { width: 1360, height: 900 } });
  const cTel = await contesto({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const cB = await contesto({ viewport: { width: 1360, height: 900 } });

  console.log('── OSPEDALE A: PERSONALI DI PRIMA ──────');
  const pcA = await apri(cA, PC);
  await pcA.evaluate(p => { localStorage.setItem('protocol-cards.pc.personali',
    JSON.stringify({ v: 1, base: 'personale', modificata: 1, protocolli: [p] })); }, protocollo('p-onco-mio', 'Onco mio', ['neoplasia']));
  await pcA.reload(); await pcA.evaluate(() => Canale.usaRelay(window.__relay));
  ok('senza profilo: personali di questo PC', await pcA.evaluate(() => !profilo && libs.personale.protocolli.length === 1));
  ok('la libreria lo dice', /di questo PC/.test(await pcA.locator('#profiloRiga').textContent()));

  console.log('\n── ABBINAMENTO: ARRIVA IL PROFILO ──────');
  let tel = await abbina(pcA, cTel);
  const idTel = await tel.evaluate(() => mioProfilo().id);
  ok('il telefono ha un profilo', /^pr-[a-z0-9]{12}$/.test(idTel), idTel);
  ok('il PC riceve il profilo del telefono', await attendi(async () => (await pcA.evaluate(() => profilo && profilo.id)) === idTel));
  ok('propone di portare i personali di questo PC nel profilo', await attendi(() => pcA.locator('.mask.on', { hasText: 'Portare i protocolli' }).isVisible()));
  await pcA.locator('.mask.on .btn.solid').click();
  ok('portati nel profilo', await pcA.evaluate(() => libs.personale.protocolli.some(p => p.id === 'p-onco-mio')));
  ok('non restano più «senza profilo»', await pcA.evaluate(() => localStorage.getItem('protocol-cards.pc.personali')) === null);
  ok('arrivano sul telefono', await attendi(async () => (await tel.evaluate(() => mioProfilo().personali.map(p => p.id))).includes('p-onco-mio'), 6000));

  console.log('\n── SUL PC SI CREA, SUL TELEFONO ARRIVA ─');
  await pcA.evaluate(p => { libs.personale.protocolli.unshift(p); salvaLibreria('personale'); }, protocollo('p-tep-mio', 'TEP mio', ['tep']));
  ok('nuovo protocollo personale sul telefono', await attendi(async () => (await tel.evaluate(() => mioProfilo().personali.map(p => p.id))).includes('p-tep-mio'), 6000));

  console.log('\n── NOME DEL PROFILO DAL TELEFONO ───────');
  await tel.locator('#btnSet').click(); await tel.waitForTimeout(300);
  ok('impostazioni: il tuo profilo', /2 protocolli personali/.test(await tel.locator('#profBox').textContent()), (await tel.locator('#profBox .item-s').first().textContent()).trim());
  await tel.locator('#profNome').fill('Mario Rossi'); await tel.locator('#profNome').press('Enter'); await tel.locator('#profNome').blur();
  ok('il PC mostra il nome', await attendi(async () => /Mario Rossi/.test(await pcA.locator('#profiloRiga').textContent()), 6000));

  console.log('\n── OSPEDALE B: UN PC NUOVO ─────────────');
  const pcB = await apri(cB, PC);
  ok('PC nuovo: nessun personale', await pcB.evaluate(() => libs.personale.protocolli.length) === 0);
  await tel.close();
  tel = await abbina(pcB, cTel);
  ok('i miei protocolli arrivano sul PC nuovo', await attendi(async () => (await pcB.evaluate(() => libs.personale.protocolli.map(p => p.id).sort().join())) === 'p-onco-mio,p-tep-mio', 6000),
     await pcB.evaluate(() => libs.personale.protocolli.map(p => p.id).join()));
  ok('con il mio nome', /Mario Rossi/.test(await pcB.locator('#profiloRiga').textContent()));
  ok('nessuna domanda: su questo PC non c\'era nulla', await pcB.locator('.mask.on').count() === 0);
  await pcB.evaluate(() => { libs.personale.protocolli = libs.personale.protocolli.filter(p => p.id !== 'p-tep-mio'); salvaLibreria('personale'); });
  ok('una modifica sul PC nuovo torna al telefono', await attendi(async () => !(await tel.evaluate(() => mioProfilo().personali.map(p => p.id))).includes('p-tep-mio'), 6000));

  console.log('\n── PC NUOVO RIAPERTO ───────────────────');
  await pcB.reload(); await pcB.evaluate(() => { Canale.usaRelay(window.__relay); return ascoltaRete(abbinamento); });
  ok('il profilo resta mentre il telefono è abbinato', await pcB.evaluate(() => profilo && profilo.nome === 'Mario Rossi' && libs.personale.protocolli.length === 1));

  console.log('\n── SCOLLEGAMENTO ───────────────────────');
  await pcB.evaluate(() => vai(3));
  pcB.once('dialog', d => d.accept());
  await pcB.locator('#reteScollega').click();
  ok('il profilo lascia il PC', await attendi(async () => await pcB.evaluate(() => !profilo && libs.personale.protocolli.length === 0)));
  ok('nessuna copia rimasta sul PC', await pcB.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('protocol-cards.pc.personali')).length) === 0,
     await pcB.evaluate(() => Object.keys(localStorage).join()));
  ok('il telefono li conserva', await tel.evaluate(() => mioProfilo().personali.length) === 1);

  console.log('\n── ESPORTA E IMPORTA SUL TELEFONO ──────');
  await tel.reload(); await tel.waitForTimeout(300);
  await tel.locator('#btnSet').click(); await tel.waitForTimeout(300);
  const [dl] = await Promise.all([tel.waitForEvent('download'), tel.locator('#profEsporta').click()]);
  const esportato = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok('file del profilo', esportato.tipo === 'profilo' && esportato.id === idTel && esportato.nome === 'Mario Rossi', dl.suggestedFilename());
  ok('con i protocolli e gli appresi del telefono', esportato.personali.length === 1 && typeof esportato.appresiTelefono === 'object');
  ok('nessuna chiave di abbinamento nel file', !/pcsync-|"k":/.test(JSON.stringify(esportato)));
  /* telefono nuovo: profilo diverso, poi l'import */
  await tel.evaluate(() => { localStorage.clear(); }); await tel.reload(); await tel.waitForTimeout(300);
  ok('telefono nuovo: profilo vuoto', await tel.evaluate(() => mioProfilo().personali.length === 0 && mioProfilo().id !== undefined));
  await tel.locator('#btnSet').click(); await tel.waitForTimeout(300);
  const fileProf = path.join(__dirname, 'shot-profilo.json');
  fs.writeFileSync(fileProf, JSON.stringify(esportato));
  await tel.setInputFiles('#profFile', fileProf); await tel.waitForTimeout(300);
  await tel.locator('#mYes').click(); await tel.waitForTimeout(300);
  fs.unlinkSync(fileProf);
  ok('profilo importato sul telefono nuovo', await tel.evaluate(id => mioProfilo().id === id && mioProfilo().nome === 'Mario Rossi' && mioProfilo().personali.length === 1, idTel));

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); relay.close(); process.exit(fail ? 1 : 0);
})();
