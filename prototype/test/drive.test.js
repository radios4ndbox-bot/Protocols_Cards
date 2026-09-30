/* Backup del profilo su Google Drive, con Google e Drive simulati: la
   pagina di accesso di Google (andata e ritorno con #access_token) e
   l'API di Drive rispondono dal test, così si verifica il flusso senza
   rete e senza un account vero. L'app si serve via HTTP: da file://
   Chromium non permette di tornare dalla pagina di Google.            */
const { chromium } = require('playwright');
const path = require('path');
const http = require('http');
const fs = require('fs');
let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok  ' : '  FAIL') + ' │ ' + l + (x ? '  → ' + x : '')); if (!c) fail++; };
const attendi = async (f, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await new Promise(r => setTimeout(r, 80)); } return false; };
const RADICE = path.resolve(__dirname, '../..');
const sito = http.createServer((q, r) => {
  const f = path.join(RADICE, decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!f.startsWith(RADICE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.statusCode = 404; return r.end(); }
  r.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
  fs.createReadStream(f).pipe(r);
});
let FILE;

/* ─── Google finto: accesso con ritorno all'app ─── */
const google = { richieste: [], nega: false, revocati: [] };
async function accesso(route) {
  const u = new URL(route.request().url());
  google.richieste.push(Object.fromEntries(u.searchParams));
  const ritorno = u.searchParams.get('redirect_uri') + '#' + (google.nega
    ? 'error=access_denied'
    : `access_token=tok-${Date.now()}&token_type=Bearer&expires_in=3600`) + '&state=' + u.searchParams.get('state');
  return route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(ritorno)})</script>` });
}

/* ─── Drive finto: la cartella dell'app, per account ─── */
const drive = { file: null, scritture: 0, token: [] };
async function api(route) {
  const q = route.request(), u = new URL(q.url()), h = q.headers();
  drive.token.push(h.authorization || '');
  if (!/^Bearer tok-/.test(h.authorization || '')) return route.fulfill({ status: 401, body: '' });
  const json = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  if (u.pathname === '/drive/v3/about') return json({ user: { emailAddress: 'pasquale@example.com' } });
  if (u.pathname === '/drive/v3/files' && q.method() === 'GET') {
    ok('ricerca solo nella cartella dell\'app', u.searchParams.get('spaces') === 'appDataFolder');
    return json({ files: drive.file ? [{ id: drive.file.id, modifiedTime: new Date().toISOString() }] : [] });
  }
  const m = u.pathname.match(/^\/(upload\/)?drive\/v3\/files\/?([^/]*)$/);
  if (m && q.method() === 'GET' && u.searchParams.get('alt') === 'media') {
    if (!drive.file || drive.file.id !== m[2]) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: drive.file.corpo });
  }
  if (m && m[1] && q.method() === 'POST') {
    const t = q.postData();
    const meta = JSON.parse(t.split('\r\n\r\n')[1].split('\r\n')[0]);
    const corpo = t.split('\r\n\r\n')[2].split('\r\n--')[0];
    drive.file = { id: 'f1', meta, corpo }; drive.scritture++;
    return json({ id: 'f1' });
  }
  if (m && m[1] && q.method() === 'PATCH') {
    if (!drive.file || drive.file.id !== m[2]) return route.fulfill({ status: 404, body: '' });
    drive.file.corpo = q.postData(); drive.scritture++;
    return json({ id: m[2] });
  }
  return route.fulfill({ status: 404, body: '' });
}

(async () => {
  await new Promise(r => sito.listen(0, '127.0.0.1', r));
  FILE = `http://127.0.0.1:${sito.address().port}/prototype/index.html`;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  const telefono = async (idClient = 'test.apps.googleusercontent.com') => {
    const c = await b.newContext({ viewport: { width: 412, height: 915 }, reducedMotion: 'reduce', hasTouch: true, isMobile: true });
    await c.addInitScript(id => { window.__driveClientId = id; }, idClient);
    await c.route('https://accounts.google.com/o/oauth2/v2/auth**', accesso);
    await c.route('https://oauth2.googleapis.com/revoke**', r => { google.revocati.push(new URL(r.request().url()).searchParams.get('token')); r.fulfill({ status: 200, body: '' }); });
    await c.route('https://www.googleapis.com/**', api);
    await c.route('https://ntfy.sh/**', r => r.abort());
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(400);
    return p;
  };

  console.log('── FUORI DALL\'APP PUBBLICATA ──────────');
  let t = await telefono('');
  ok('primo accesso: nessun «Recupera da Drive»', await t.locator('#paDrive').isHidden());
  await t.locator('#paDopo').click();
  await t.locator('#btnSet').click(); await t.waitForTimeout(300);
  ok('impostazioni: backup non disponibile', /Disponibile solo nell'app pubblicata/.test(await t.locator('#driveBox').textContent()));
  ok('Google non viene contattato', google.richieste.length === 0);
  await t.context().close();

  console.log('\n── COLLEGAMENTO ────────────────────────');
  t = await telefono();
  ok('primo accesso: «Recuperalo da Google Drive»', await t.locator('#paDrive').isVisible());
  await t.locator('#paNome').fill('Pasquale'); await t.locator('#paCognome').fill('Viggiano');
  await t.locator('#paTitolo button[data-t="Dr."]').click(); await t.locator('#paCrea').click();
  await t.evaluate(() => { learned['TC TORACE|embolia'] = { fasi: [{ fase: 'arteriosa', zone: ['TO'], delay: 'B-T' }], esame: 'TC TORACE',
    quesito: 'Sospetta embolia, paziente ROSSI', idr: 1.5, giKg: .45, count: 2, lastUsed: 1, created: 1 }; persist(); });
  await t.locator('#btnSet').click(); await t.waitForTimeout(300);
  ok('«Collega Google Drive»', await t.locator('#drvCollega').isVisible());
  await t.locator('#drvCollega').click();
  ok('va alla pagina di Google e torna', await attendi(() => google.richieste.length === 1));
  const g = google.richieste[0];
  ok('richiesta: solo la cartella dell\'app, ritorno a questa pagina', g.scope === 'https://www.googleapis.com/auth/drive.appdata'
     && g.response_type === 'token' && g.redirect_uri === FILE && g.client_id === 'test.apps.googleusercontent.com', JSON.stringify(g).slice(0, 160));
  ok('copia creata su Drive', await attendi(() => drive.file !== null));
  ok('il token non resta nell\'indirizzo', !(await t.evaluate(() => location.href)).includes('access_token'));
  const f = JSON.parse(drive.file.corpo);
  ok('nella cartella nascosta dell\'app', JSON.stringify(drive.file.meta.parents) === '["appDataFolder"]' && drive.file.meta.name === 'protocol-cards-profilo.json');
  ok('con il profilo', f.tipo === 'profilo' && f.cognome === 'Viggiano' && f.titolo === 'Dr.');
  ok('gli appresi senza il testo del quesito', f.appresiTelefono['TC TORACE|embolia'] && f.appresiTelefono['TC TORACE|embolia'].quesito === ''
     && !/ROSSI/.test(drive.file.corpo));
  ok('nessuna chiave di abbinamento', !/pcsync-|"k":/.test(drive.file.corpo));
  ok('stato: aggiornato, con l\'account', await attendi(async () => /aggiornato/.test(await t.locator('#driveBox').textContent()))
     && /pasquale@example\.com/.test(await t.locator('#driveBox').textContent()), (await t.locator('#driveBox').textContent()).trim().slice(0, 90));
  ok('il token non resta in memoria persistente', !/tok-/.test(await t.evaluate(() => JSON.stringify(localStorage))));

  console.log('\n── COPIA AUTOMATICA ────────────────────');
  const prima = drive.scritture;
  await t.locator('#profTitolo button[data-t="Dr.ssa"]').click();
  ok('una modifica va su Drive da sola', await attendi(() => drive.scritture > prima && JSON.parse(drive.file.corpo).titolo === 'Dr.ssa'));
  ok('senza chiedere di nuovo l\'accesso', google.richieste.length === 1);

  console.log('\n── ACCESSO SCADUTO ─────────────────────');
  await t.reload(); await t.waitForTimeout(400);          // dopo un riavvio l'accesso non c'è più
  await t.locator('#btnSet').click(); await t.waitForTimeout(300);
  const p2 = drive.scritture;
  await t.locator('#profCognome').fill('Viggiano Rossi'); await t.locator('#profCognome').blur();
  await t.waitForTimeout(3000);
  ok('senza accesso non scrive', drive.scritture === p2);
  ok('pallino sulle impostazioni', await t.locator('#setN').isVisible());
  ok('stato: da aggiornare', /da aggiornare/.test(await t.locator('#driveBox').textContent()));
  await t.locator('#drvAggiorna').click();
  ok('ripassa da Google con lo stesso account', await attendi(() => google.richieste.length === 2) && google.richieste[1].login_hint === 'pasquale@example.com');
  ok('«Aggiorna backup» con un tocco', await attendi(() => drive.scritture > p2 && JSON.parse(drive.file.corpo).cognome === 'Viggiano Rossi'));
  ok('pallino spento', await attendi(() => t.locator('#setN').isHidden()));

  console.log('\n── TELEFONO NUOVO ──────────────────────');
  const n = await telefono();
  ok('primo accesso sul telefono nuovo', await n.locator('#primoAccesso.open').isVisible());
  await n.locator('#paDrive').click();
  ok('propone il profilo trovato su Drive', await attendi(() => n.locator('#mask.open').isVisible())
     && /Viggiano Rossi/.test(await n.locator('#mBody').textContent()), (await n.locator('#mBody').textContent()).trim());
  await n.locator('#mYes').click(); await n.waitForTimeout(300);
  ok('profilo recuperato', await n.evaluate(() => mioProfilo().cognome === 'Viggiano Rossi' && mioProfilo().titolo === 'Dr.ssa'));
  ok('con gli appresi', await n.evaluate(() => !!learned['TC TORACE|embolia']));
  ok('finestra del primo accesso chiusa', await n.locator('#primoAccesso.open').count() === 0);

  console.log('\n── SCOLLEGA ────────────────────────────');
  await t.locator('#drvOff').click(); await t.locator('#mYes').click(); await t.waitForTimeout(200);
  ok('scollegato: accesso revocato', await attendi(() => google.revocati.some(x => /^tok-/.test(x || ''))));
  ok('torna «Collega Google Drive»', await t.locator('#drvCollega').isVisible());
  ok('la copia su Drive resta', drive.file !== null);

  console.log('\n── ACCESSO NEGATO ──────────────────────');
  google.nega = true;
  await t.locator('#drvCollega').click();
  ok('lo dice, con il motivo probabile', await attendi(async () => /utenti di test/.test(await t.locator('#toast').textContent())),
     (await t.locator('#toast').textContent()).trim());
  ok('resta scollegato', await t.locator('#drvCollega').isVisible());

  console.log('\n────────────────────────────────────────');
  console.log(errs.length ? 'ERRORI JS: ' + errs.join(' | ') : 'errori JS: nessuno');
  if (errs.length) fail++;
  console.log(fail ? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); sito.close(); process.exit(fail ? 1 : 0);
})();
