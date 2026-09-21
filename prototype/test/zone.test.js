const { chromium } = require('playwright');
let fail=0;
const ok=(l,c,x='')=>{console.log((c?'  ok  ':'  FAIL')+' │ '+l+(x?'  → '+x:''));if(!c)fail++;};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await b.newPage({viewport:{width:412,height:915},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../index.html')+'');
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(350);

  console.log('── REGIONE DEDOTTA DALL\'ESAME ──────────');
  const casi = [
    ['TC TORACE CON E SENZA MDC','TO'],
    ['TC TORACE SENZA MDC','TO'],
    ['TC TORACE CON MDC','TO'],
    ['TC ADDOME SUPERIORE CON MDC','ADs'],
    ['TC ADDOME COMPLETO CON MDC','ADc'],
    ['TC TORACE ADDOME CON MDC','TAc'],
    ['TC TORACE E ADDOME SUPERIORE','TAs'],
    ['TC ENCEFALO SENZA MDC','ENC'],
    ['TC CRANIO URGENTE','ENC'],
    ['TC COLLO CON MDC','Collo'],
    ['URO TC URGENTE','ADc'],
    ['ANGIO TC AORTA ADDOMINALE','ADc'],
    ['ANGIO TC AORTA TORACICA','TAc'],
    ['TC TOTAL BODY URGENTE','TAc'],
    ['TC RACHIDE LOMBARE','ALTRO'],      // riconosciuto ma fuori tassonomia
    ['TC SPALLA DESTRA','ALTRO'],
    ['TC MASSICCIO FACCIALE','ALTRO'],
  ];
  for(const [e,exp] of casi){
    const got = await p.evaluate(x=>regionOf(x), e);
    ok(e.padEnd(30), got===exp, String(got));
  }
  const fuoriTass = await p.evaluate(()=>
    ['basale','arteriosa','venosa','tardiva'].every(f=>!ZONES[f].some(([c])=>c==='ALTRO')));
  ok('ALTRO non e\' una zona applicabile', fuoriTass);
  const fit = await p.evaluate(()=>
    fitZones([{fase:'venosa',zone:['ADc'],delay:'70'}],'TC RACHIDE LOMBARE')[0].zone[0]);
  ok('zona invariata su distretto fuori tassonomia', fit==='ADc', fit);
  const det = await p.evaluate(()=>{const s=new Set();
    for(let i=0;i<50;i++) s.add(regionOf('TC TORACE CON E SENZA MDC')); return s.size;});
  ok('deterministico su 50 giri', det===1);

  console.log('\n── ZONE APPLICATE AL PROTOCOLLO ────────');
  // ROSSI: TC TORACE + AngioTC Polmonare → deve diventare Torace, non TAs
  await p.locator('.day.today').click(); await p.waitForTimeout(300);
  await p.locator('#tcEl').click(); await p.waitForTimeout(1300);
  await p.locator('.card-mini').first().click(); await p.waitForTimeout(1400);
  ok('esame TC TORACE', (await p.locator('#dExam').textContent()).includes('TORACE'));
  await p.locator('#applyBtn').click(); await p.waitForTimeout(400);
  const z1 = await p.locator('.row-z').first().locator('.zc b, .zc.plain').first().textContent();
  ok('AngioTC polmonare → TO', z1.trim()==='TO', z1.trim());
  ok('toast nomina la zona', (await p.locator('#toast').textContent()).includes('Torace'),
     await p.locator('#toast').textContent());
  await p.locator('#back').click(); await p.waitForTimeout(1100);

  // RIVA: TC TORACE SENZA MDC + HRCT → TO
  const nomi = await p.locator('.mini-name').allTextContents();
  await p.locator('.card-mini').nth(nomi.indexOf('RIVA GIOVANNI')).click(); await p.waitForTimeout(1400);
  await p.locator('#applyBtn').click(); await p.waitForTimeout(400);
  ok('HRCT nodulo → TO', (await p.locator('.row-z .zc').first().getAttribute('data-z'))==='TO',
     (await p.locator('.row-z .zc').first().getAttribute('data-z')));
  await p.locator('#back').click(); await p.waitForTimeout(1100);

  // GALIMBERTI: fegato cirrotico → alternanza ADs/ADc intrinseca, NON rimappata
  await p.locator('.card-mini').nth(nomi.indexOf('GALIMBERTI NATALE')).click(); await p.waitForTimeout(1400);
  await p.locator('#applyBtn').click(); await p.waitForTimeout(400);
  const zz = await p.locator('.row-z .zc').evaluateAll(n=>n.map(x=>x.dataset.z||x.textContent.trim()));
  ok('fegato cirrotico conserva ADs/ADs/ADc/ADs',
     zz.join('·')==='ADs·ADs·ADc·ADs', zz.join('·'));
  await p.locator('#back').click(); await p.waitForTimeout(1100);

  // FERRARI: TC TORACE ADDOME + ristadiazione → TAc
  await p.locator('.card-mini').nth(nomi.indexOf('FERRARI ANNA')).click(); await p.waitForTimeout(1400);
  await p.locator('#applyBtn').click(); await p.waitForTimeout(400);
  ok('ristadiazione torace-addome → TAc',
     (await p.locator('.row-z .zc').first().getAttribute('data-z'))==='TAc',
     (await p.locator('.row-z .zc').first().getAttribute('data-z')));

  console.log('\n── ZONA TORACE NEI MENU ────────────────');
  await p.selectOption('#ddPhase','basale');
  await p.locator('#ddZone').click(); await p.waitForTimeout(200);
  const opts = await p.locator('#pop .pop-i span').allTextContents();
  ok('TO presente in basale', opts.includes('TO'), opts.join(' '));
  ok('ordine anatomico', opts.join(' ')==='ENC Collo TO ADs ADc TAs TAc', opts.join(' '));

  console.log('\n── PROTOCOLLO APPRESO NON RIMAPPATO ────');
  await p.locator('#pop').evaluate(e=>e.classList.remove('open'));  // chiudo solo il menu
  await p.locator('#setBtn').click(); await p.waitForTimeout(1800);
  await p.locator('.card-mini').nth(nomi.indexOf('FERRARI ANNA')).click(); await p.waitForTimeout(1400);
  ok('appreso proposto per primo',
     (await p.locator('.tag').first().textContent()).includes('APPRESO'));
  await p.locator('#applyBtn').click(); await p.waitForTimeout(400);
  ok('zone dell\'appreso conservate',
     (await p.locator('.row-z .zc').first().getAttribute('data-z'))==='TAc');
  ok('toast senza zona per l\'appreso',
     !(await p.locator('#toast').textContent()).includes('·'),
     await p.locator('#toast').textContent());

  console.log('\n────────────────────────────────────────');
  console.log(errs.length?'ERRORI JS: '+errs.join(' | '):'errori JS: nessuno');
  console.log(fail?`\n✗ ${fail} CONTROLLI FALLITI`:'\n✓ TUTTI I CONTROLLI PASSATI');
  await b.close(); process.exit(fail?1:0);
})();
