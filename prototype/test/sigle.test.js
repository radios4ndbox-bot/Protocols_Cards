const { chromium } = require('playwright');
let fail=0;
const ok=(l,c,x='')=>{console.log((c?'  ok  ':'  FAIL')+' │ '+l+(x?'  → '+x:''));if(!c)fail++;};
const w = (loc)=>loc.evaluate(e=>Math.round(e.getBoundingClientRect().width));
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'');
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(350);

  // GALIMBERTI: fegato cirrotico, 4 fasi con 2 sigle diverse
  await p.locator('.day.today').click(); await p.waitForTimeout(300);
  await p.locator('#tcEl').click(); await p.waitForTimeout(1300);
  const nomi = await p.locator('.mini-name').allTextContents();
  await p.locator('.card-mini').nth(nomi.indexOf('GALIMBERTI NATALE')).click(); await p.waitForTimeout(1400);
  await p.locator('#applyBtn').click(); await p.waitForTimeout(450);

  console.log('── SIGLA ESPANDIBILE ───────────────────');
  const c0 = p.locator('.zc').first();
  ok('sigla resa come chip', await p.locator('.zc').count()===4,
     (await p.locator('.zc').count())+' chip');
  ok('mostra solo la sigla', (await c0.locator('b').textContent())==='ADs');
  const chiusa = await w(c0);
  ok('nome esteso nascosto', await c0.locator('i').evaluate(e=>e.getBoundingClientRect().width)<1);

  await c0.click(); await p.waitForTimeout(450);
  const aperta = await w(c0);
  ok('si espande al tocco', aperta > chiusa*1.8, `${chiusa}px → ${aperta}px`);
  ok('mostra "Addome sup."', await c0.locator('i').isVisible());
  ok('marcata come aperta', await c0.evaluate(e=>e.classList.contains('on')));
  ok('una sola aperta', await p.locator('.zc.on').count()===1);
  await p.screenshot({path:'shot-chip.png'});

  console.log('\n── UNA PER VOLTA ───────────────────────');
  const c2 = p.locator('.zc').nth(2);          // la venosa: ADc
  ok('la terza è ADc', (await c2.locator('b').textContent())==='ADc');
  await c2.click(); await p.waitForTimeout(450);
  ok('la nuova si apre', await c2.evaluate(e=>e.classList.contains('on')));
  ok('la precedente si chiude', !(await c0.evaluate(e=>e.classList.contains('on'))));
  ok('sempre una sola aperta', await p.locator('.zc.on').count()===1);

  console.log('\n── TOCCO FUORI ─────────────────────────');
  await p.locator('#detail .sec-t').first().click(); await p.waitForTimeout(400);
  ok('si minimizza', await p.locator('.zc.on').count()===0);
  ok('torna alla larghezza iniziale', Math.abs(await w(c0) - chiusa)<3,
     `${await w(c0)}px vs ${chiusa}px`);

  console.log('\n── SECONDO TOCCO SULLA STESSA ──────────');
  await c0.click(); await p.waitForTimeout(400);
  ok('apre', await c0.evaluate(e=>e.classList.contains('on')));
  await c0.click(); await p.waitForTimeout(400);
  ok('richiude', !(await c0.evaluate(e=>e.classList.contains('on'))));

  console.log('\n── SIGLE SENZA NOME DIVERSO ────────────');
  await p.locator('#back').click(); await p.waitForTimeout(1100);
  await p.locator('.card-mini').nth(nomi.indexOf('ESPOSITO CARMINE')).click(); await p.waitForTimeout(1400);
  await p.locator('#applyBtn').click(); await p.waitForTimeout(450);
  const tipi = await p.locator('.zc').evaluateAll(n=>n.map(x=>
    ({t:x.querySelector('b')?x.querySelector('b').textContent:x.textContent.trim(),
      plain:x.classList.contains('plain')})));
  console.log('  ' + tipi.map(t=>`${t.t}${t.plain?' (fissa)':' (espandibile)'}`).join(' · '));
  ok('Angio TC non espandibile', tipi.some(t=>t.t==='Angio TC'&&t.plain));
  ok('ADc espandibile', tipi.some(t=>t.t==='ADc'&&!t.plain));
  const adc = p.locator('.zc:not(.plain)').first();
  await adc.click(); await p.waitForTimeout(400);
  ok('ADc mostra "Addome compl."', (await adc.locator('i').textContent())==='Addome compl.');

  console.log('\n── NON INTERFERISCE CON IL RESTO ───────');
  await p.locator('.zc.on').first().click(); await p.waitForTimeout(300);
  ok('scheda ancora aperta', await p.locator('#detail.open').count()===1);
  ok('bottone Imposta attivo', !(await p.locator('#setBtn').isDisabled()));
  await p.locator('#setBtn').click(); await p.waitForTimeout(1800);
  ok('impostazione riuscita', await p.locator('#board:not(.hidden)').count()===1);

  console.log('\n────────────────────────────────────────');
  console.log(errs.length?'ERRORI JS: '+errs.join(' | '):'errori JS: nessuno');
  console.log(fail?`\n✗ ${fail} CONTROLLI FALLITI`:'\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail?1:0);
})();
