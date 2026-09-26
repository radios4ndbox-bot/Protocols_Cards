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

console.log('\n────────────────────────────────────────');
console.log(fail ? `✗ ${fail} CONTROLLI FALLITI` : '✓ TUTTI I CONTROLLI PASSATI');
process.exit(fail ? 1 : 0);
