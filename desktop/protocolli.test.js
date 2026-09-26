#!/usr/bin/env node
/* Test della libreria protocolli: gira in Node, nessuna dipendenza.
   Uso:  node protocolli.test.js                                        */
const P = require('./protocolli.js');

let fail = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok   │ ' : '  FAIL │ ') + l + (x ? '  → ' + x : '')); if (!c) fail++; };
const sez = t => console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(3, 38 - t.length)));

const lib = P.nuovaLibreria().protocolli;

sez('LIBRERIA DI PARTENZA');
ok('14 protocolli SIRM', lib.length === 14, lib.length);
ok('identificativi unici', new Set(lib.map(p => p.id)).size === lib.length);
const gravi = lib.flatMap(p => P.valida(p, lib).filter(e => e.grave).map(e => p.id + ': ' + e.msg));
ok('nessun errore grave', gravi.length === 0, gravi.join(' | '));
ok('copia indipendente dalla sorgente', (lib[0].l = 'X', P.SIRM_2022[0].l !== 'X'));

/* le stesse coppie esame/quesito del prototipo: il riconoscimento deve
   dare lo stesso risultato, altrimenti PC e telefono divergono          */
sez('RICONOSCIMENTO COME NEL PROTOTIPO');
const L = P.nuovaLibreria().protocolli;
const casi = [
  ['TC TORACE CON E SENZA MDC', 'Sospetta embolia polmonare', 'angio-polm'],
  ['TC ENCEFALO SENZA MDC', 'Trauma cranico, caduta accidentale', 'cranio-trauma'],
  ['TC ADDOME COMPLETO CON E SENZA MDC', 'Epatopatia cronica, sorveglianza HCC', 'fegato-cirr'],
  ['TC TORACE ADDOME CON MDC', 'Restaging neoplasia mammaria', 'onco-ristad'],
  ['TC ADDOME SUPERIORE CON MDC', 'Dolore addominale, sospetta colecistite', 'vie-biliari'],
  ['ANGIO TC AORTA ADDOMINALE', 'Controllo endoprotesi aortica, sospetto endoleak', 'aorta-endop'],
  ['TC ADDOME COMPLETO CON MDC', 'Follow-up neoplasia colica operata', 'onco-fup'],
  ['TC TORACE SENZA MDC', 'Controllo nodulo polmonare, follow-up Lung-RADS', 'hrct-nodulo'],
  ['TC ENCEFALO SENZA MDC URGENTE', 'Deficit neurologico acuto, sospetto stroke', 'encefalo-stroke'],
  ['URO TC URGENTE', 'Colica renale, ematuria macroscopica', 'urotc-split'],
  ['TC TOTAL BODY URGENTE', 'Politrauma da incidente stradale', 'politrauma'],
  ['TC ADDOME COMPLETO CON MDC', 'Sospetta diverticolite', 'addome-acuto'],
  ['TC TORACE CON MDC', 'Versamento pleurico in studio', 'torace-mdc'],
  ['ANGIO TC AORTA TORACICA', 'Sospetta dissezione aortica', 'aorta-diss'],
  ['TC TORACE ADDOME CON MDC', 'Ristadiazione linfoma', 'onco-ristad'],
];
casi.forEach(([esame, q, atteso]) => {
  const r = P.riconosci(L, esame, q);
  ok(`${atteso.padEnd(16)} ← ${q.slice(0, 34)}`, r.id === atteso, r.id);
});

sez('REGIONE E CASI LIMITE');
const tt = P.riconosci(L, 'TC TORACE', 'trauma toracico');
ok('«trauma» sul torace non finisce sull’encefalo', tt.id !== 'cranio-trauma', tt.id);
ok('…ma il candidato è mostrato come fuori regione',
   tt.candidati.some(c => c.id === 'cranio-trauma' && c.fuori));
ok('solo l’esame non basta', P.riconosci(L, 'TC TORACE CON MDC', 'controllo').id === null);
ok('quesito vuoto', P.riconosci(L, '', '').id === null);
ok('regione di «ADDOME SUPERIORE»', P.regionOf('TC ADDOME SUPERIORE') === 'ADs');
ok('regione fuori tassonomia', P.regionOf('TC RACHIDE LOMBARE') === 'ALTRO');
ok('accenti e maiuscole nei termini', (() => {
  const x = P.clona(L); x[0].kw = ['Embolìa'];
  return P.riconosci(x, 'TC TORACE', 'sospetta EMBOLIA').id === 'angio-polm';
})());
ok('a parità vince il primo in elenco', (() => {
  const x = P.clona(L); const a = x.find(p => p.id === 'onco-ristad'), b = x.find(p => p.id === 'onco-fup');
  a.kw = ['zzz']; b.kw = ['zzz']; a.ex = []; b.ex = [];
  const primo = x.indexOf(a) < x.indexOf(b) ? a.id : b.id;
  return P.riconosci(x, 'TC', 'zzz').id === primo;
})());

sez('ZONE');
const fz = P.fitZones(L.find(p => p.id === 'angio-polm').fasi, 'TC TORACE');
ok('la regione dell’esame sostituisce la zona', fz[0].zone[0] === 'TO', fz[0].zone.join());
const fx = P.fitZones(L.find(p => p.id === 'fegato-cirr').fasi, 'TC TORACE ADDOME');
ok('le fasi fix conservano la zona', fx.map(f => f.zone[0]).join() === 'ADs,ADs,ADc,ADs', fx.map(f => f.zone[0]).join());
ok('fix non viene propagato', fx.every(f => !('fix' in f)));

sez('VALIDAZIONE');
const base = () => P.clona(L.find(p => p.id === 'torace-mdc'));
const msg = p => P.valida(p, L).map(e => e.msg).join(' | ');
let p = base(); p.l = ' ';
ok('nome vuoto è grave', P.valida(p, L).some(e => e.campo === 'l' && e.grave));
p = base(); p.id = 'altro'; p.l = 'tc torace CON MDC';
ok('nome doppio è grave', P.valida(p, L).some(e => e.campo === 'l' && e.grave), msg(p));
p = base(); p.fasi = [];
ok('senza fasi è grave', P.valida(p, L).some(e => e.campo === 'fasi' && e.grave));
p = base(); p.fasi[0].zone = [];
ok('fase senza zona è grave', P.valida(p, L).some(e => e.grave), msg(p));
p = base(); p.fasi[0].delay = '70s';
ok('ritardo non valido', P.valida(p, L).some(e => e.grave && /ritardo/.test(e.msg)));
p = base(); p.giKg = 0;
ok('mdc senza dose è grave', P.valida(p, L).some(e => e.campo === 'mdc' && e.grave));
p = base(); p.basale = 'req';
ok('basale richiesta ma assente: avviso', P.valida(p, L).some(e => e.campo === 'basale' && !e.grave));
p = base(); p.kw = [];
ok('senza termini: avviso', P.valida(p, L).some(e => e.campo === 'kw' && !e.grave));
p = P.clona(L.find(p => p.id === 'hrct-nodulo'));
ok('senza mdc la dose non conta', !P.valida(p, L).some(e => e.campo === 'mdc'));

sez('FIRMA E IMPORTAZIONE');
const f0 = P.firma(L);
ok('firma di 7 caratteri', /^[0-9A-Z]{7}$/.test(f0), f0);
ok('stabile', P.firma(P.clona(L)) === f0);
ok('cambia con il contenuto', (() => { const x = P.clona(L); x[3].giKg = 0.64; return P.firma(x) !== f0; })());
ok('cambia con l’ordine', (() => { const x = P.clona(L); x.reverse(); return P.firma(x) !== f0; })());
ok('ignora gli spazi ai bordi del nome', (() => { const x = P.clona(L); x[0].l += '  '; return P.firma(x) === f0; })());
const giro = P.leggiLibreria(JSON.stringify({ protocolli: L }));
ok('esporta → importa conserva la firma', P.firma(giro.protocolli) === f0);
ok('accetta anche un elenco nudo', P.leggiLibreria(JSON.stringify(L)).protocolli.length === 14);
const rifiuta = (t, s) => { try { P.leggiLibreria(t); return false; } catch (e) { return s.test(e.message); } };
ok('rifiuta testo non JSON', rifiuta('ciao', /JSON/));
ok('rifiuta id doppi', rifiuta(JSON.stringify([L[0], L[0]]), /doppio/));
ok('rifiuta fasi sconosciute', rifiuta(JSON.stringify([{ ...L[0], fasi: [{ fase: 'portale', zone: ['TO'] }] }]), /portale/));
ok('id libero da un nome', P.idLibero(L, 'Torace mdc') === 'torace-mdc-2');

sez('FASI');
ok('sei tipi di fase', Object.keys(P.FASI).join() === 'basale,arteriosa,venosa,tardiva,urografica,surrene');
ok('ogni fase ha zone, colori e sigla', Object.entries(P.FASI).every(([k, f]) => P.ZONE[k] && P.ZONE[k].length && f.c && f.bg && f.tx && f.s));
ok('protocollo con urografica e surrene valido', (() => {
  const x = { id:'x', l:'Surrene', idr:1.2, giKg:0.5, basale:'req', kw:['surrene'], ex:[],
    fasi:[{fase:'basale',zone:['ADs'],delay:''},{fase:'venosa',zone:['ADs'],delay:'70'},{fase:'surrene',zone:['ADs'],delay:'900'},{fase:'urografica',zone:['ADc'],delay:'600'}] };
  return !P.valida(x, []).some(e => e.grave);
})());

sez('APPRENDIMENTO E PROTOCOLLI PERSONALI');
{
  const U = P.nuovaLibreria().protocolli;
  const pers = P.nuovaLibreriaPersonale().protocolli;
  const es = 'TC TORACE CON E SENZA MDC', q = 'Sospetta embolia polmonare';
  ok('firma come nel prototipo', P.firmaCaso(es, q) === 'TC TORACE|embolia', P.firmaCaso(es, q));
  ok('firma ignora mdc e urgenza', P.firmaCaso('TC TORACE SENZA MDC URGENTE', 'EMBOLIA?') === P.firmaCaso(es, q));
  ok('senza personali vince l’ufficiale', (() => { const s = P.suggerisci(U, pers, es, q); return s.fonte === 'ufficiale' && s.id === 'angio-polm'; })());

  const scelto = U.find(p => p.id === 'torace-mdc');
  const v = P.impara(pers, scelto, es, q, 1000);
  ok('la scelta diversa crea una voce appresa', pers.length === 1 && v.appreso.volte === 1);
  ok('id personale con prefisso p-', /^p-/.test(v.id), v.id);
  ok('ricorda il protocollo di partenza', v.base === 'torace-mdc');
  ok('non conserva il testo del quesito', !JSON.stringify(v).includes('Sospetta') && v.appreso.termini.join() === 'embolia');
  ok('copia le fasi, non le condivide', v.fasi !== scelto.fasi && JSON.stringify(v.fasi) === JSON.stringify(scelto.fasi));
  ok('nessun errore grave sulla voce appresa', !P.valida(v, pers).some(e => e.grave), P.valida(v, pers).map(e => e.msg).join(' | '));
  ok('niente avviso sui termini per una voce appresa', !P.valida(v, pers).some(e => e.campo === 'kw'));
  const s1 = P.suggerisci(U, pers, 'TC TORACE CON MDC', 'embolia');
  ok('lo stesso caso ora suggerisce la voce appresa', s1.fonte === 'appreso' && s1.id === v.id, s1.fonte + ' ' + s1.id);
  ok('un caso diverso no', P.suggerisci(U, pers, 'TC ADDOME', 'embolia').fonte !== 'appreso');

  P.impara(pers, scelto, es, q, 2000);
  ok('stessa scelta: conteggio +1', pers.length === 1 && v.appreso.volte === 2 && v.appreso.ultimo === 2000);
  P.impara(pers, v, es, q, 3000);
  ok('confermare la voce appresa conta come uso', v.appreso.volte === 3);
  P.impara(pers, U.find(p => p.id === 'angio-polm'), es, q, 4000);
  ok('scelta diversa: configurazione sostituita, conteggio da 1', v.appreso.volte === 1 && v.base === 'angio-polm' && v.fasi[0].fase === 'arteriosa');

  v.kw = ['tromboembolia'];
  const s2 = P.suggerisci(U, pers, 'ANGIO TC TORACE', 'tromboembolia acuta');
  ok('con termini propri riconosce anche casi simili', s2.fonte === 'personale' && s2.id === v.id, s2.fonte);
  const giro2 = P.leggiLibreria(JSON.stringify({ protocolli: pers }));
  ok('esporta → importa conserva l’apprendimento', giro2.protocolli[0].appreso.firma === 'TC TORACE|embolia' && giro2.protocolli[0].base === 'angio-polm');
}

sez('PROTOCOLLI SIMILI');
{
  const U = P.nuovaLibreria().protocolli, pers = [];
  const esistente = { id: 'p-surreni', l: 'TC Surreni', idr: 1.2, giKg: 0.5, basale: 'req', kw: ['adenoma', 'incidentaloma'], ex: [],
    reg: ['ADs'], nota: '', fasi: [{ fase: 'basale', zone: ['ADs'], delay: '' }, { fase: 'surrene', zone: ['ADs'], delay: '900' }] };
  pers.push(esistente);
  const bozza = P.clona(esistente); bozza.id = '__bozza'; bozza.l = 'Surreni washout';
  let r = P.simili(bozza, pers);
  ok('termini in comune: simile', r.length === 1 && r[0].motivi.some(m => m.k === 'termini'), JSON.stringify(r));
  bozza.reg = ['TO'];
  ok('regioni incompatibili: non compete', !P.simili(bozza, pers).some(x => x.motivi.some(m => m.k === 'termini')));
  bozza.reg = ['ADs']; bozza.kw = ['feocromocitoma'];
  ok('termini diversi e nessuna base: non simile', P.simili(bozza, pers).length === 0);
  bozza.l = 'tc surreni';
  ok('stesso nome: simile', P.simili(bozza, pers)[0].motivi[0].k === 'nome');
  bozza.l = 'Altro'; bozza.base = 'p-surreni';
  ok('partito da lui: simile', P.simili(bozza, pers)[0].motivi.some(m => m.k === 'origine'));
  const app = P.impara(pers, U.find(p => p.id === 'torace-mdc'), 'TC TORACE', 'embolia');
  const b2 = { id: '__bozza', l: 'Embolia reparto', idr: 1.5, giKg: 0.45, basale: 'opt', kw: ['embolia'], ex: [], nota: '',
    fasi: [{ fase: 'arteriosa', zone: ['TO'], delay: 'B-T' }] };
  ok('ruberebbe un caso appreso: simile', P.simili(b2, pers).some(x => x.id === app.id), JSON.stringify(P.simili(b2, pers)));

  const prima = pers.indexOf(esistente);
  const b3 = { ...P.clona(b2), l: 'TC Surreni v2', kw: ['adenoma'] };
  const q = P.sostituisci(pers, 'p-surreni', b3);
  ok('sostituisce mantenendo id e posizione', q.id === 'p-surreni' && pers.indexOf(q) === prima && q.l === 'TC Surreni v2');
  ok('contenuto aggiornato', q.fasi[0].fase === 'arteriosa' && q.kw.join() === 'adenoma');
  const va = P.sostituisci(pers, app.id, { ...b2, l: 'Nuovo nome' });
  ok('una voce appresa conserva la firma', va.appreso && va.appreso.firma === 'TC TORACE|embolia' && va.l === 'Nuovo nome');
  ok('nessun campo della bozza di troppo', !('__bozza' in q) && q.id !== '__bozza');
}

console.log('\n────────────────────────────────────────');
console.log(fail ? `✗ ${fail} CONTROLLI FALLITI` : '✓ TUTTI I CONTROLLI PASSATI');
process.exit(fail ? 1 : 0);
