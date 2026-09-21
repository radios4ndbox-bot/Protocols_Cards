const { chromium } = require('playwright');
let fail=0; const ok=(l,c,x='')=>{console.log((c?'  ok  ':'  FAIL')+' │ '+l+(x?'  → '+x:''));if(!c)fail++;};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:412,height:915},hasTouch:true,isMobile:true});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let iniettato=false;
  await p.exposeFunction('segnalaIniezione',()=>{iniettato=true;});
  await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'');
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(350);

  console.log('── RILIEVO 5 · testo ostile nei campi ──');
  const veleno = '<img src=x onerror=segnalaIniezione()>SOTTO<b>grassetto</b>';
  await p.locator('.day.today').click(); await p.waitForTimeout(300);
  await p.locator('#tcEm').click(); await p.waitForTimeout(1300);
  await p.locator('#btnNew').click(); await p.waitForTimeout(350);
  await p.locator('#nNome').fill(veleno);
  await p.locator('#nEsame').fill('TC ENCEFALO '+veleno);
  await p.locator('#nQ').fill('Trauma cranico '+veleno);
  await p.locator('#ncCreate').click(); await p.waitForTimeout(600);
  ok('scheda creata', await p.locator('.card-mini').count()===4);
  await p.waitForTimeout(400);
  ok('nessuno script eseguito', !iniettato);
  ok('nessun tag iniettato in miniatura', await p.locator('#board img, #board b').count()===0);
  const nome = await p.locator('.mini-name').allTextContents();
  ok('il testo compare letterale', nome.some(n=>n.includes('<IMG')||n.includes('<img')),
     nome.find(n=>n.includes('SOTTO'))||'—');

  // e nel cestino, che usa innerHTML
  const i = nome.findIndex(n=>n.includes('SOTTO'));
  await p.locator('.card-mini').nth(i).click(); await p.waitForTimeout(1400);
  ok('nessun tag nella scheda', await p.locator('#detail img, #detail .d-name b').count()===0);
  await p.locator('#back').click(); await p.waitForTimeout(1100);
  await p.locator('#btnEod').click(); await p.waitForTimeout(300);
  await p.locator('#mYes').click(); await p.waitForTimeout(500);
  await p.locator('#btnTrash').click(); await p.waitForTimeout(400);
  ok('nessun tag nel cestino', await p.locator('#trashList img, #trashList b').count()===0);
  await p.waitForTimeout(300);
  ok('ancora nessuno script eseguito', !iniettato);

  console.log('\n────────────────────────────────────────');
  console.log(errs.length?'ERRORI JS: '+errs.slice(0,3).join(' | '):'errori JS: nessuno');
  console.log(fail?`✗ ${fail} FALLITI`:'✓ TUTTI PASSATI');
  await b.close(); process.exit(fail?1:0);
})();
