const { chromium } = require('playwright');
const SP = process.env.RIS_PDF_DIR || '.';   // cartella con la lista RIS di prova
let fail = 0;
const ok = (l,c,x='') => { console.log((c?'  ok  ':'  FAIL')+' │ '+l+(x?'  → '+x:'')); if(!c) fail++; };
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport:{width:1360,height:900} });
  const errs=[]; const net=[];
  p.on('pageerror', e=>errs.push(e.message));
  p.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,120)); });
  p.on('request', r => { if(!r.url().startsWith('file:') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) net.push(r.url()); });

  console.log('── APERTURA DA file:// ─────────────────');
  await p.goto('file://'+require('path').resolve(__dirname,'protocol-cards-pc.html')+'');
  await p.waitForTimeout(1200);
  ok('pdf.js caricato',    await p.evaluate(()=>typeof pdfjsLib!=='undefined'));
  ok('encoder QR caricato',await p.evaluate(()=>typeof qrcode==='function'));
  ok('parser caricato',    await p.evaluate(()=>typeof RisParser!=='undefined'));
  ok('worker da blob',     await p.evaluate(()=>/^blob:/.test(pdfjsLib.GlobalWorkerOptions.workerSrc)));

  console.log('\n── IMPORTAZIONE DEL PDF REALE ──────────');
  await p.setInputFiles('#file', SP+'/lista.pdf');
  await p.waitForSelector('#v2.on', { timeout: 25000 });
  ok('passa alla verifica', await p.locator('#v2.on').count()===1);
  const righe = await p.locator('#righe tr').count();
  ok('14 pazienti', righe===14, righe+' righe');
  ok('conteggio esatto', /14 pazienti · 29 esami/.test(await p.locator('#conta').textContent()),
     (await p.locator('#conta').textContent()).trim());
  ok('tutti verificati', (await p.locator('#chipOk').textContent()).startsWith('14'),
     await p.locator('#chipOk').textContent());
  ok('nessuna riga segnalata', await p.locator('#righe tr.warn').count()===0);
  const ore = await p.locator('#righe input[data-k="ora"]').evaluateAll(n=>n.map(x=>x.value));
  ok('ordine cronologico', ore.join(' ')==='08:00 08:15 08:45 09:15 10:15 10:45 11:15 11:45 13:00 13:30 14:00 14:30 14:45 15:15', ore.slice(0,4).join(' ')+' … '+ore.slice(-2).join(' '));
  await p.screenshot({ path:'shot-verifica.png' });

  console.log('\n── CORREZIONE IN TABELLA ───────────────');
  const primo = p.locator('#righe tr').first();
  await primo.locator('input[data-k="nascita"]').fill('');
  await p.waitForTimeout(250);
  ok('cancellare la nascita segnala', await primo.evaluate(e=>e.classList.contains('warn')));
  ok('avviso mostrato', (await primo.locator('.avvisi').textContent()).includes('nascita'));
  ok('contatore aggiornato', (await p.locator('#chipWarn').textContent()).startsWith('1'),
     await p.locator('#chipWarn').textContent());
  await primo.locator('input[data-k="nascita"]').fill('17/10/1960');
  await p.waitForTimeout(250);
  ok('correggendo la segnalazione sparisce', !(await primo.evaluate(e=>e.classList.contains('warn'))));
  ok('torna a 14 verificati', (await p.locator('#chipOk').textContent()).startsWith('14'));

  console.log('\n── ESCLUSIONE DI UNA RIGA ──────────────');
  await primo.locator('.togli').click(); await p.waitForTimeout(250);
  ok('riga esclusa', await primo.evaluate(e=>e.classList.contains('esclusa')));
  ok('conteggio a 13', (await p.locator('#conta').textContent()).startsWith('13 pazienti'),
     (await p.locator('#conta').textContent()).trim());
  await primo.locator('.togli').click(); await p.waitForTimeout(250);
  ok('reinclusa', (await p.locator('#conta').textContent()).startsWith('14 pazienti'));

  console.log('\n── QR ──────────────────────────────────');
  await p.locator('#avanti').click();
  await p.waitForTimeout(900);
  ok('vista trasferimento', await p.locator('#v3.on').count()===1);
  ok('giornata', (await p.locator('#rGiorno').textContent())==='21/09/2026',
     await p.locator('#rGiorno').textContent());
  ok('pazienti', (await p.locator('#rPaz').textContent())==='14');
  ok('esami', (await p.locator('#rEsami').textContent())==='29');
  const grezzi = await p.locator('#rGrezzi').textContent();
  const comp   = await p.locator('#rComp').textContent();
  const frame  = await p.locator('#rFrame').textContent();
  console.log('       grezzi '+grezzi+' · compressi '+comp+' · '+frame);
  ok('compressione applicata', /−\d+%/.test(comp), comp);
  const dipinto = await p.evaluate(()=>{
    const c=document.getElementById('qr'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let scuri=0; for(let i=0;i<d.length;i+=4) if(d[i]<100) scuri++;
    return scuri;
  });
  ok('QR disegnato sul canvas', dipinto>2000, dipinto+' pixel scuri');

  console.log('\n── PAYLOAD ─────────────────────────────');
  const pl = await p.evaluate(()=>payload());
  ok('versione formato', pl.v===1);
  ok('data giornata', pl.d==='21/09/2026');
  ok('14 pazienti nel payload', pl.p.length===14);
  ok('6 campi per paziente', pl.p.every(r=>r.length===6));
  ok('accession presente', pl.p.every(r=>/^0D\d{8}$/.test(r[0])));
  ok('nascita presente', pl.p.every(r=>/^\d{2}\/\d{2}\/\d{4}$/.test(r[2])));
  ok('orario presente', pl.p.every(r=>/^\d{2}:\d{2}$/.test(r[3])));
  const frames = await p.evaluate(()=>frames.map(f=>f.length));
  const intest = await p.evaluate(()=>frames[0].slice(0,24));
  ok('frame con intestazione e checksum', /^PC1\|[A-Z0-9]{7}\|1\/\d+\|/.test(intest), intest);
  ok('frame entro il limite', frames.every(l=>l<=1260), 'max '+Math.max(...frames));

  console.log('\n── NESSUNA RETE ────────────────────────');
  ok('zero richieste di rete', net.length===0, net.slice(0,3).join(', ')||'nessuna');
  await p.screenshot({ path:'shot-qr.png' });

  console.log('\n────────────────────────────────────────');
  console.log(errs.length? 'ERRORI JS: '+errs.slice(0,4).join(' | ') : 'errori JS: nessuno');
  console.log(fail? `\n✗ ${fail} CONTROLLI FALLITI` : '\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail?1:0);
})();
