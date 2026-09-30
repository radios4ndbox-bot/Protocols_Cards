/* Sincronizzazione PC → telefono attraverso il relay, di capo a capo.

   Al posto di ntfy.sh gira qui un relay finto con la stessa interfaccia
   (POST /argomento, GET /argomento/sse?since=all, GET /v1/health), così
   il test non dipende dalla rete e può leggere cosa vede il relay.
   PC e telefono stanno in due contesti separati del browser: non
   condividono nulla, come nella realtà.

   node build.js && node sincronizzazione.test.js                       */
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

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

/* le date sono quelle del giorno in cui gira il test: il telefono non
   tiene le giornate passate                                            */
const gg = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off);
  return { dmy: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
           iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }; };
const OGGI = gg(0), IERI = gg(-1);

function paziente(i, data = OGGI.dmy) {
  return { accession: '0D2609' + String(i).padStart(4, '0'), cognome: 'PROVA', nome: 'N' + i,
    nomeCompleto: `PROVA PAZIENTE NUMERO ${i}`, nascita: '17/10/1960', data, ora: `${String(8 + (i % 9)).padStart(2, '0')}:${i % 2 ? '15' : '45'}`,
    quesito: i % 2 ? 'Sospetta embolia polmonare' : 'Restaging neoplasia mammaria',
    esami: [{ descrizione: i % 2 ? 'TC TORACE CON MDC' : 'TC TORACE ADDOME CON MDC' }], incerto: [], escluso: false };
}

(async () => {
  await new Promise(r => relay.listen(0, '127.0.0.1', r));
  const RELAY = `http://127.0.0.1:${relay.address().port}`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];

  /* «riduci movimento»: l'intro non parte e non copre la pagina (ha il suo test) */
  const cPc = await b.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
  const cTel = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const verso = { pc: [], tel: [] };
  for (const [n, c] of [['pc', cPc], ['tel', cTel]]) {
    await c.addInitScript(r => { window.__relay = r; }, RELAY);
    /* il primo accesso sul telefono ha il suo test (profilo.test.js) */
    if (n === 'tel') await c.addInitScript(() => { try { localStorage.setItem('pc.v4.profiloRimandato', 'true'); } catch (_) {} });
    /* all'avvio il telefono abbinato ascolta subito ntfy.sh, prima che il
       test lo sposti sul relay finto: quelle richieste si bloccano qui   */
    await c.route('https://ntfy.sh/**', r => r.abort());
    c.on('request', q => { if (/^https?:/.test(q.url()) && !q.url().startsWith('https://ntfy.sh/')) verso[n].push(q.url()); });
  }
  const usaRelay = p => p.evaluate(() => Canale.usaRelay(window.__relay));
  const apri = async (c, url) => {
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !(m.location().url || '').startsWith('https://ntfy.sh/')) errs.push('console: ' + m.text().slice(0, 120)); });
    await p.goto(url);
    return p;
  };

  console.log('── PC: APERTURA SENZA RETE ─────────────');
  const pc = await apri(cPc, PC);
  await usaRelay(pc);
  await pc.evaluate(lista => { pazienti = lista; vai(3); }, [1, 2, 3].map(i => paziente(i)));
  await pc.waitForTimeout(500);
  ok('invio accanto alla verifica', await pc.locator('#rete').isVisible());
  ok('nessun abbinamento all\'inizio', (await pc.locator('#reteStato').textContent()).includes('accedi con il tuo profilo'));
  ok('in alto a destra: «Accedi»', (await pc.locator('#profiloBtn').textContent()).trim() === 'Accedi');
  ok('«Invia» nascosto senza abbinamento', await pc.locator('#reteInvia').isHidden());
  ok('nessuna richiesta di rete finché non si chiede', verso.pc.length === 0, verso.pc.join(', ') || 'nessuna');

  console.log('\n── ABBINAMENTO ─────────────────────────');
  await pc.locator('#reteAccedi').click();
  ok('«Accedi dal profilo» apre il pannello del profilo', await pc.locator('#pannelloProfilo').isVisible());
  await pc.locator('#reteAbbina').click();
  ok('QR di abbinamento mostrato a canale aperto', await attendi(() => pc.locator('#qrAbb').isVisible()));
  ok('«Annulla» durante l\'abbinamento', (await pc.locator('#reteScollega').textContent()) === 'Annulla');
  const abb = await pc.evaluate(() => inAbbinamento);
  ok('argomento e chiave generati', /^pcsync-[a-z0-9]{22}$/.test(abb.t) && abb.k.length === 43);
  ok('prima della conferma nulla è salvato', await pc.evaluate(() => localStorage.getItem('protocol-cards.pc.abbinamento')) === null);

  let tel = await apri(cTel, TEL + `#t=${abb.t}&k=${abb.k}`);
  await usaRelay(tel);
  await tel.evaluate(() => avviaPc());       // riparte sul relay finto
  ok('la chiave sparisce dall\'indirizzo', !(await tel.evaluate(() => location.href)).includes('#'));
  ok('telefono abbinato', await tel.evaluate(() => pcLink && pcLink.t) === abb.t);
  ok('schede di esempio tolte all\'abbinamento', await tel.evaluate(() => state.length === 0 && !state.some(p => ESEMPIO.has(p.id))),
     await tel.evaluate(() => state.length) + ' schede');
  ok('PC riceve la conferma', await attendi(async () => (await pc.locator('#accessoStato').textContent()).includes('Telefono collegato')
       || (await pc.locator('#profiloNome').textContent()).trim() !== 'Accedi'),
     (await pc.locator('#accessoStato').textContent()).trim());
  const salvato = await pc.evaluate(() => JSON.parse(localStorage.getItem('protocol-cards.pc.abbinamento')));
  ok('abbinamento salvato sul PC dopo la conferma', salvato && salvato.t === abb.t && /Chrome/.test(salvato.dispositivo), salvato && salvato.dispositivo);
  ok('QR di abbinamento nascosto', await pc.locator('#qrAbb').isHidden());
  ok('«Invia» disponibile', await pc.locator('#reteInvia').isVisible());

  console.log('\n── INVIO CON L\'APP APERTA ─────────────');
  await pc.locator('#reteInvia').click();
  ok('PC riceve la ricevuta', await attendi(async () => (await pc.locator('#reteStato').textContent()).includes('Ricevuta dal telefono')),
     (await pc.locator('#reteStato').textContent()).trim());
  ok('ricevuta con i numeri giusti', /3 nuove schede, 0 aggiornate/.test(await pc.locator('#reteStato').textContent()));
  const st = await tel.evaluate(() => state.filter(p => p.id.startsWith('0D2609')));
  ok('3 schede importate sul telefono', st.length === 3, st.length + '');
  ok('data della giornata convertita', st.every(p => p.data === OGGI.iso));
  ok('nascita convertita', st.every(p => p.nascita === '1960-10-17'));
  ok('protocollo riconosciuto dal quesito', st.find(p => p.id.endsWith('0001')).proto === 'angio-polm');
  ok('schede elettive da fare', st.every(p => p.modo === 'elettiva' && p.stato === 'todo'));
  ok('toast sul telefono', await attendi(async () => /Elettiva del \d{2}\/\d{2}\/\d{4}: 3 nuove/.test(await tel.locator('#toast').textContent())),
     await tel.locator('#toast').textContent());

  const dentro = [...argomenti.get(abb.t).msg];
  ok('il relay vede solo buste cifrate', dentro.every(e => { const j = JSON.parse(e.message); return j.v === 1 && j.ct && !/PROVA|EMBOLIA|0D2609/i.test(e.message); }));

  console.log('\n── INVIO CON L\'APP CHIUSA ─────────────');
  await tel.evaluate(() => { state.find(p => p.id === '0D26090001').stato = 'done'; persist(); });
  /* app chiusa: si esce dalla pagina. Chiudere la pagina e riaprirne subito
     un'altra, con file://, a volte perde il localStorage appena scritto  */
  await tel.goto('about:blank');
  await pc.evaluate(lista => { pazienti = lista; vai(3); }, [1, 2, 3, 4].map(i => paziente(i)).map((p, i) => (i === 1 ? { ...p, ora: '13:05' } : p)));
  await pc.waitForTimeout(300);
  await pc.locator('#reteInvia').click();
  ok('PC in attesa di conferma', await attendi(async () => (await pc.locator('#reteStato').textContent()).includes('In attesa di conferma')));
  await tel.goto(TEL); await tel.evaluate(() => Canale.usaRelay(window.__relay));
  await tel.evaluate(() => avviaPc());
  ok('all\'apertura il telefono riceve la lista arretrata', await attendi(async () => (await pc.locator('#reteStato').textContent()).includes('Ricevuta dal telefono')),
     (await pc.locator('#reteStato').textContent()).trim());
  ok('1 nuova, 1 aggiornata, 1 già lavorata lasciata', /1 nuove schede, 1 aggiornate, 1 già lavorate/.test(await pc.locator('#reteStato').textContent()));
  const st2 = await tel.evaluate(() => state.filter(p => p.id.startsWith('0D2609')));
  ok('4 schede, nessun doppione', st2.length === 4, st2.length + '');
  ok('orario aggiornato sulla scheda da fare', st2.find(p => p.id.endsWith('0002')).ora === '13:05');
  ok('la scheda già lavorata resta fatta', st2.find(p => p.id.endsWith('0001')).stato === 'done');
  ok('la prima lista non viene reimportata', (await tel.evaluate(() => pcRicevute.length)) === 2);

  console.log('\n── LISTA LUNGA, A PEZZI ────────────────');
  const prima = argomenti.get(abb.t).msg.length;
  await pc.evaluate(lista => { pazienti = lista; vai(3); }, Array.from({ length: 160 }, (_, i) => paziente(100 + i)));
  await pc.waitForTimeout(300);
  await pc.locator('#reteInvia').click();
  ok('ricevuta per la lista lunga', await attendi(async () => (await pc.locator('#reteStato').textContent()).includes('160 nuove')),
     (await pc.locator('#reteStato').textContent()).trim());
  const nuovi = argomenti.get(abb.t).msg.slice(prima);
  const max = Math.max(...nuovi.map(e => Buffer.byteLength(e.message)));
  ok('divisa in più messaggi', nuovi.length >= 2, nuovi.length + ' messaggi');
  ok('ogni messaggio sotto i 4 KB di ntfy', max < 4096, max + ' byte');

  console.log('\n── LA SEDUTA LA DECIDE IL PC ───────────');
  ok('seduta elettiva per le liste precedenti', await tel.evaluate(() => sessione && sessione.modo === 'elettiva'));
  ok('due ingressi all\'importazione', await pc.locator('.drop[data-seduta="elettiva"] #file').count() === 1
     && await pc.locator('.drop[data-seduta="emergenza"] #filePS').count() === 1);
  /* come se la lista fosse stata importata dall'ingresso del pronto soccorso */
  await pc.evaluate(lista => { seduta = 'emergenza'; pazienti = lista; vai(2); }, [paziente(900), paziente(901)]);
  await pc.waitForTimeout(200);
  ok('verifica: seduta di pronto soccorso', (await pc.locator('#chipSeduta').textContent()) === 'Pronto soccorso');
  ok('la seduta viaggia con la lista', await pc.evaluate(() => payload().m) === 'emergenza');
  await pc.locator('#reteInvia').click();
  ok('ricevuta', await attendi(async () => /Ricevuta dal telefono: 2 nuove/.test(await pc.locator('#reteStato').textContent())),
     (await pc.locator('#reteStato').textContent()).trim());
  const ps = await tel.evaluate(() => ({ sess: sessione, m: document.body.dataset.m, t: document.getElementById('abTitle').textContent,
    modi: state.filter(p => ['0D26090900', '0D26090901'].includes(p.id)).map(p => p.modo),
    viste: document.querySelectorAll('#board .card-mini').length }));
  ok('il telefono apre la seduta di pronto soccorso', ps.sess.modo === 'emergenza' && ps.m === 'emergenza' && ps.t === 'TC di pronto soccorso',
     JSON.stringify(ps.sess) + ' · ' + ps.t);
  ok('le schede arrivano come pronto soccorso', ps.modi.length === 2 && ps.modi.every(m => m === 'emergenza'));
  ok('in bacheca solo quella seduta', ps.viste === 2, ps.viste + ' schede');

  console.log('\n── GIORNATA D\'ESAME ────────────────────');
  await pc.evaluate(lista => { seduta = 'elettiva'; pazienti = lista; vai(2); },
    [paziente(950, IERI.dmy), paziente(951, IERI.dmy), paziente(952, OGGI.dmy)]);
  await pc.waitForTimeout(200);
  ok('vale la data più frequente', await pc.evaluate(() => giornata().d) === IERI.dmy);
  ok('la verifica segnala la giornata passata', /giornata passata/.test(await pc.locator('#chipGiorno').textContent()),
     await pc.locator('#chipGiorno').textContent());
  await pc.evaluate(() => vai(3)); await pc.waitForTimeout(300);
  const primaPassata = await tel.evaluate(() => state.length);
  await pc.locator('#reteInvia').click();
  ok('il telefono scarta la giornata passata', await attendi(async () => /scartato la lista/.test(await pc.locator('#reteStato').textContent())),
     (await pc.locator('#reteStato').textContent()).trim());
  ok('nessuna scheda di ieri sul telefono', (await tel.evaluate(() => state.length)) === primaPassata
     && !(await tel.evaluate(d => state.some(p => p.data === d), IERI.iso)));
  ok('la seduta aperta non cambia', await tel.evaluate(() => sessione.modo) === 'emergenza');

  console.log('\n── SCHEDE PASSATE ──────────────────────');
  await tel.evaluate(d => { const x = { ...state[0], id: 'VECCHIA', data: d }; state.push(x); persist(); }, IERI.iso);
  await tel.reload(); await tel.waitForTimeout(400);
  ok('all\'avvio le schede di ieri spariscono', !(await tel.evaluate(() => state.some(p => p.id === 'VECCHIA'))));
  ok('le altre restano', (await tel.evaluate(() => state.length)) === primaPassata);
  await tel.evaluate(() => { Canale.usaRelay(window.__relay); avviaPc(); });

  console.log('\n── MESSAGGI ESTRANEI ───────────────────');
  const n0 = await tel.evaluate(() => state.length);
  await fetch(`${RELAY}/${abb.t}`, { method: 'POST', body: JSON.stringify({ v: 1, da: 'pc', iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }) });
  await fetch(`${RELAY}/${abb.t}`, { method: 'POST', body: 'testo qualsiasi' });
  await tel.waitForTimeout(500);
  ok('ignorati senza errori', (await tel.evaluate(() => state.length)) === n0);

  console.log('\n── SINCRONIZZA ─────────────────────────');
  ok('tasto «Sincronizza» con il telefono collegato', await attendi(() => pc.locator('#syncBtn').isVisible()));
  const primo = await pc.evaluate(() => libs.ufficiale.protocolli[0].id);
  await pc.evaluate(() => { libs.ufficiale.protocolli[0].idr = 1.9; salvaLibreria('ufficiale'); });
  ok('una modifica accende il pallino', await pc.locator('#syncBtn.da-inviare').count() === 1);
  ok('prima: il telefono non la conosce', await tel.evaluate(id => PROTOCOLS[id].idr, primo) !== 1.9);
  await pc.locator('#syncBtn').click();
  ok('il telefono riceve la libreria del PC', await attendi(async () => (await tel.evaluate(id => PROTOCOLS[id] && PROTOCOLS[id].idr, primo)) === 1.9),
     String(await tel.evaluate(id => PROTOCOLS[id] && PROTOCOLS[id].idr, primo)));
  ok('e la conserva', await tel.evaluate(() => JSON.parse(localStorage.getItem('pc.v4.libreriaPC')).protocolli.length) === await pc.evaluate(() => libs.ufficiale.protocolli.length));
  ok('conferma: pallino spento', await attendi(async () => await pc.locator('#syncBtn.da-inviare').count() === 0));
  /* un protocollo con fasi che prima il telefono non aveva */
  await pc.evaluate(() => { libs.ufficiale.protocolli.push({ id: 'uro-surr', l: 'Uro e surrene', idr: 1.2, giKg: .5, basale: 'req',
    kw: ['incidentaloma'], ex: [], nota: '', fasi: [{ fase: 'basale', zone: ['ADs'] }, { fase: 'venosa', zone: ['ADc'], delay: '70' },
      { fase: 'urografica', zone: ['ADc'], delay: '600' }, { fase: 'surrene', zone: ['ADs'], delay: '900' }] }); salvaLibreria('ufficiale'); });
  await tel.locator('#btnSet').click(); await tel.waitForTimeout(300);
  ok('telefono: stato della libreria nelle impostazioni', /protocolli dal PC/.test(await tel.locator('#pcBox').textContent()));
  await tel.locator('#pcSync').click();                    // dal telefono: il PC rimanda tutto
  ok('«Sincronizza con il PC» dal telefono', await attendi(() => tel.evaluate(() => !!PROTOCOLS['uro-surr'])));
  ok('urografica e surrene riconosciute sul telefono', await tel.evaluate(() => matchProtocol('TC ADDOME', 'incidentaloma surrenalico')) === 'uro-surr');
  await tel.locator('#btnSet').click(); await tel.waitForTimeout(200);     // torna alle schede
  /* il protocollo scelto in verifica viaggia con la lista */
  await pc.evaluate(lista => { pazienti = lista; pazienti[0].scelta = null; pazienti[1].usa = 'ufficiale'; vai(2); },
    [paziente(700), paziente(701), paziente(702)]);
  const scelte = await pc.evaluate(() => payload().p.map(r => r[6]));
  ok('nella lista: «-» per nessuno, altrimenti l\'id', scelte[0] === '-' && scelte.slice(1).every(x => x && x !== '-'), scelte.join());
  await pc.locator('#reteInvia').click();
  ok('ricevuta', await attendi(async () => /Ricevuta dal telefono: 3 nuove/.test(await pc.locator('#reteStato').textContent())));
  const arrivate = await tel.evaluate(() => ['0D26090700', '0D26090701', '0D26090702'].map(id => (state.find(p => p.id === id) || {}).proto));
  ok('sul telefono la stessa scelta del PC', arrivate[0] == null && arrivate[1] === scelte[1] && arrivate[2] === scelte[2], arrivate.join());

  console.log('\n── SCOLLEGAMENTO ───────────────────────');
  await tel.locator('#btnSet').click(); await tel.waitForTimeout(300);
  ok('impostazioni: PC in ascolto', (await tel.locator('#pcBox').textContent()).includes('in ascolto'));
  ok('abbinato: «Svuota tutte le schede» al posto dell\'esempio',
     (await tel.locator('#btnReset').textContent()) === 'Svuota tutte le schede', await tel.locator('#btnReset').textContent());
  const tornaEsempio = async () => (await tel.locator('#btnReset').textContent()) === 'Ripristina i dati di esempio';
  await tel.locator('#pcOff').click(); await tel.locator('#mYes').click(); await tel.waitForTimeout(200);
  ok('telefono scollegato', await tel.evaluate(() => pcLink === null && localStorage.getItem('pc.v4.pc') === 'null'));
  ok('scollegato: torna «Ripristina i dati di esempio»', await tornaEsempio());
  ok('impostazioni: nessun PC', (await tel.locator('#pcBox').textContent()).includes('Nessun PC abbinato'));
  pc.once('dialog', d => d.accept());
  if (await pc.locator('#pannelloProfilo').isHidden()) await pc.locator('#profiloBtn').click();
  await pc.locator('#reteScollega').click(); await pc.waitForTimeout(200);
  ok('PC scollegato', await pc.evaluate(() => localStorage.getItem('protocol-cards.pc.abbinamento')) === null);
  ok('«Invia» di nuovo nascosto', await pc.locator('#reteInvia').isHidden());
  ok('le richieste vanno solo al relay', [...verso.pc, ...verso.tel].every(u => u.startsWith(RELAY)),
     [...verso.pc, ...verso.tel].filter(u => !u.startsWith(RELAY)).slice(0, 2).join(', ') || 'sì');

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.slice(0, 4).join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); relay.close(); process.exit(fail ? 1 : 0);
})();
