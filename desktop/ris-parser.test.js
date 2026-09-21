/* ═══════════════════════════════════════════════════════════════════════
   Test del parser RIS.

   La fixture è sintetica: riproduce il layout osservato su una lista reale
   (posizioni delle colonne, ordine delle righe, blocchi che scavalcano il
   salto di pagina) con dati inventati. Nel repository non entrano dati di
   pazienti.
   ═══════════════════════════════════════════════════════════════════════ */

const { parseRis } = require('./ris-parser.js');

let falliti = 0;
const ok = (etichetta, cond, extra = '') => {
  console.log((cond ? '  ok  ' : '  FAIL') + ' │ ' + etichetta + (extra ? '  → ' + extra : ''));
  if (!cond) falliti++;
};

/* ── generatore di fixture ──────────────────────────────────────────── */
const X = { codice:64, descrizione:194, orario:280, paziente:340, nascita:400,
            diagnostica:461, provenienza:521, stato:643, urgenza:720, statoEsame:779,
            tariffario:830, dose:961 };

/* Un paziente occupa righe a y crescente a partire da `y`.
   Restituisce la y successiva libera.                                   */
function emettiPaziente(items, y, p) {
  const r = (dy, celle) => {
    for (const [col, testo] of Object.entries(celle))
      if (testo) items.push({ x: X[col], y: y + dy, t: testo });
  };
  r(0,  { codice:p.acc, orario:p.data, paziente:p.cognome, nascita:p.nascita,
          diagnostica:p.diagnostica, provenienza:p.prov1, stato:p.stato });
  r(12, { orario:p.ora, paziente:p.nome, diagnostica:p.diagnostica2, provenienza:p.prov2 });
  r(18, { urgenza:p.urgenza || 'Nessuna' });
  if (p.prov3) r(24, { provenienza:p.prov3 });
  r(50, { codice:p.quesito });
  r(75, { codice:'Codice', descrizione:'Descrizione', urgenza:'Stato esame',
          tariffario:'Tariffario', dose:'Dose' });
  let dy = 92;
  const suPagina = p.esami.length - (p.esamiOltrePagina || 0);
  p.esami.slice(0, suPagina).forEach(e => {
    r(dy, { codice:e.codice, descrizione:e.descrizione, statoEsame:e.stato });
    dy += 22;
  });
  return y + dy + 20;
}

const intestazionePagina = (items, n, tot) => {
  items.push({ x:461, y:41,  t:'Lista esami da eseguire' });
  items.push({ x:64,  y:900, t:`21/09/2026 08:22  ${n} Of ${tot}  pviggiano` });
};

const P = [
  { acc:'0D10000001', data:'21/09/2026', ora:'08:00', cognome:'VERDI', nome:'ANNA',
    nascita:'12/03/1954', diagnostica:'TAC', diagnostica2:'BASE', prov1:'DES-RAD',
    prov2:'TAC', stato:'Da eseguire', quesito:'colica renale sinistra',
    esami:[{codice:'6988015', descrizione:'TC ADDOME SENZA MDC', stato:'Da eseguire'}] },

  { acc:'0D10000002', data:'21/09/2026', ora:'09:30', cognome:'NERI BIANCHI', nome:'MARIA TERESA',
    nascita:'24/05/1952', diagnostica:'TAC', diagnostica2:'C/S', prov1:'DES-RAD',
    prov2:'TAC', prov3:'AMB', stato:'Prenotato',
    quesito:'rivalutazione dopo trattamento, sospetta recidiva locale',
    esami:[{codice:'6988016', descrizione:'TC TORACE, ADDOME E PELVI CON MDC', stato:'Da eseguire'},
           {codice:'6987411C', descrizione:'TC ENCEFALO SENZA MDC (NO PRIMA ISTANZA)', stato:'Da eseguire'}] },

  /* blocco che scavalca il salto di pagina: l'ultimo esame finisce dopo */
  { acc:'0D10000003', data:'21/09/2026', ora:'15:15', cognome:'GIALLI', nome:'PAOLO',
    nascita:'17/05/1973', diagnostica:'TAC', diagnostica2:'DH', prov1:'DES-RAD',
    prov2:'TAC', stato:'Da eseguire', quesito:'stadiazione neoplasia polmonare',
    esami:[{codice:'6987000', descrizione:'TC TORACE CON MDC', stato:'Da eseguire'},
           {codice:'6987001', descrizione:'TC ADDOME COMPLETO CON MDC', stato:'Prenotato'}],
    esamiOltrePagina:1 },
];

function costruisciPagine() {
  const pag1 = [], pag2 = [];
  intestazionePagina(pag1, 1, 2);
  intestazionePagina(pag2, 2, 2);
  /* intestazione della tabella esterna, solo sulla prima pagina */
  [['codice',135,'Acc. Number'],['orario',287,'Orario'],['paziente',351,'Paziente'],
   ['nascita',404,'Data nascita'],['diagnostica',465,'Diagnostica'],
   ['provenienza',525,'Provenienza'],['stato',660,'Stato'],['urgenza',713,'Urgenza']]
    .forEach(([, x, t]) => pag1.push({ x, y:71, t }));

  let y = 100;
  y = emettiPaziente(pag1, y, P[0]);
  y = emettiPaziente(pag1, y, P[1]);
  emettiPaziente(pag1, y, P[2]);
  /* la coda del terzo paziente: un solo esame, in cima alla pagina 2 */
  const ult = P[2].esami[P[2].esami.length - 1];
  pag2.push({ x:X.codice, y:58, t:ult.codice });
  pag2.push({ x:X.descrizione, y:58, t:ult.descrizione });
  pag2.push({ x:X.statoEsame, y:58, t:ult.stato });
  return [pag1, pag2];
}

/* ── esecuzione ─────────────────────────────────────────────────────── */
const pagine = costruisciPagine();
const r = parseRis(pagine);

console.log('── STRUTTURA ───────────────────────────');
ok('3 pazienti', r.pazienti.length === 3, r.pazienti.length + '');
ok('nessuna segnalazione', r.conSegnalazioni === 0,
   r.pazienti.flatMap(p => p.incerto).join(', ') || 'nessuna');

console.log('\n── ORDINE CRONOLOGICO ──────────────────');
ok('ordinati per orario', r.pazienti.map(p => p.ora).join(' ') === '08:00 09:30 15:15',
   r.pazienti.map(p => p.ora).join(' '));

console.log('\n── ANAGRAFICA ──────────────────────────');
P.forEach((atteso, i) => {
  const p = r.pazienti[i];
  const nome = (atteso.cognome + ' ' + atteso.nome);
  ok(`paz.${i+1} accession`, p.accession === atteso.acc, p.accession);
  ok(`paz.${i+1} nome ricomposto da due righe`, p.nomeCompleto === nome, p.nomeCompleto);
  ok(`paz.${i+1} data di nascita`, p.nascita === atteso.nascita, p.nascita);
  ok(`paz.${i+1} orario`, p.ora === atteso.ora, p.ora);
  ok(`paz.${i+1} data seduta`, p.data === atteso.data, p.data);
  ok(`paz.${i+1} quesito`, p.quesito === atteso.quesito, p.quesito);
  ok(`paz.${i+1} stato`, p.stato === atteso.stato, p.stato);
});

console.log('\n── ESAMI ───────────────────────────────');
P.forEach((atteso, i) => {
  const p = r.pazienti[i];
  ok(`paz.${i+1} numero di esami`, p.esami.length === atteso.esami.length,
     `${p.esami.length} invece di ${atteso.esami.length}`);
  atteso.esami.forEach((e, j) => {
    const g = p.esami[j] || {};
    ok(`paz.${i+1} esame ${j+1} codice`, g.codice === e.codice, g.codice);
    ok(`paz.${i+1} esame ${j+1} descrizione`, g.descrizione === e.descrizione, g.descrizione);
    ok(`paz.${i+1} esame ${j+1} stato`, g.stato === e.stato, g.stato);
  });
});

console.log('\n── BLOCCO A CAVALLO DELLE PAGINE ───────');
const ultimo = r.pazienti[2];
ok('recupera l\'esame rimasto sulla pagina seguente', ultimo.esami.length === 2,
   ultimo.esami.length + ' esami');
ok('l\'esame è quello giusto', (ultimo.esami[1] || {}).codice === '6987001',
   (ultimo.esami[1] || {}).codice);

console.log('\n── RIGHE DI SERVIZIO SCARTATE ──────────');
const testi = r.pazienti.flatMap(p => [p.quesito, p.nomeCompleto, ...p.esami.map(e => e.descrizione)]);
ok('nessun titolo nei campi', !testi.some(t => /Lista esami/i.test(t)));
ok('nessuna intestazione di pagina', !testi.some(t => /\bOf\b|pviggiano/i.test(t)));
ok('nessuna intestazione di tabella', !testi.some(t => /Acc\. Number|Data nascita/i.test(t)));

console.log('\n── DIREZIONE RICAVATA DAL DOCUMENTO ────');
const capovolte = pagine.map(p => p.map(i => ({ ...i, y: 1000 - i.y })));
const rc = parseRis(capovolte);
ok('stesso esito su documento con assi invertiti',
   rc.pazienti.length === 3 && rc.pazienti.map(p => p.ora).join(' ') === '08:00 09:30 15:15',
   rc.pazienti.map(p => p.ora).join(' '));
ok('nomi identici', rc.pazienti.map(p => p.nomeCompleto).join('|')
   === r.pazienti.map(p => p.nomeCompleto).join('|'));

console.log('\n── SEGNALAZIONI SU DATI INCOMPLETI ─────');
const monco = [[{ x:X.codice, y:100, t:'0D10000009' },
                { x:X.orario, y:100, t:'21/09/2026' },
                { x:X.nascita, y:100, t:'01/01/1950' }]];
const rm = parseRis(monco);
ok('rileva il paziente comunque', rm.pazienti.length === 1);
ok('segnala i campi mancanti', rm.pazienti[0].incerto.length >= 3,
   rm.pazienti[0].incerto.join(', '));
ok('segnala nome assente', rm.pazienti[0].incerto.includes('nome'));
ok('segnala esami assenti', rm.pazienti[0].incerto.includes('nessun esame'));

console.log('\n────────────────────────────────────────');
console.log(falliti ? `✗ ${falliti} CONTROLLI FALLITI` : '✓ TUTTI I CONTROLLI PASSATI');
process.exit(falliti ? 1 : 0);
