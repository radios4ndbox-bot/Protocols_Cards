/* ═══════════════════════════════════════════════════════════════════════
   PROTOCOL CARDS · libreria protocolli

   Modulo condiviso: lo usa il tool PC per modificare la libreria e lo
   userà il telefono dopo la sincronizzazione. Lo schema è lo stesso del
   prototipo (prototype/index.html), con una differenza: i protocolli
   stanno in un elenco ordinato invece che in un oggetto, perché l'ordine
   decide i pareggi del riconoscimento e va reso esplicito.

   Nessuna dipendenza, nessun accesso al DOM: gira in Node per i test.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ═══ FASI E ZONE ══════════════════════════════════════════════════ */
  const FASI = {
    basale:    { l: 'Basale',      c: '#6d7f9f', mdc: false, delay: ''    },
    arteriosa: { l: 'Arteriosa',   c: '#2f6fed', mdc: true,  delay: 'B-T' },
    venosa:    { l: 'Venosa',      c: '#1d54c4', mdc: true,  delay: '70'  },
    tardiva:   { l: 'Eq. tardiva', c: '#c2601a', mdc: true,  delay: '300' },
  };

  const ZONE = {
    basale:   [['ENC','Encefalo'],['Collo','Collo'],['TO','Torace'],
               ['ADs','Addome sup.'],['ADc','Addome compl.'],
               ['TAs','Torace-addome sup.'],['TAc','Torace-addome compl.']],
    arteriosa:[['ENC','Encefalo'],['Collo','Collo'],['TO','Torace'],
               ['ADs','Addome sup.'],['ADc','Addome compl.'],
               ['TAs','Torace-addome sup.'],['TAc','Torace-addome compl.'],
               ['Collo TAs','Collo + tor-add sup.'],['Collo TAc','Collo + tor-add compl.'],
               ['Angio TC','Angio-TC']],
    venosa:   [['Collo','Collo'],['TO','Torace'],
               ['ADs','Addome sup.'],['ADc','Addome compl.'],
               ['TAs','Torace-addome sup.'],['TAc','Torace-addome compl.'],
               ['Collo TAs','Collo + tor-add sup.'],['Collo TAc','Collo + tor-add compl.']],
    tardiva:  [['ENC','Encefalo'],['TO','Torace'],
               ['ADs','Addome sup.'],['ADc','Addome compl.'],
               ['TAs','Torace-addome sup.'],['TAc','Torace-addome compl.']],
  };

  const ZONE_L = {};
  Object.values(ZONE).forEach(l => l.forEach(([c, lab]) => { ZONE_L[c] = lab; }));

  /* regioni che regionOf() può restituire: sono i distretti con cui un
     protocollo dichiara di essere compatibile                          */
  const REGIONI = [['ENC','Encefalo'],['Collo','Collo'],['TO','Torace'],
                   ['ADs','Addome sup.'],['ADc','Addome compl.'],
                   ['TAs','Torace-addome sup.'],['TAc','Torace-addome compl.']];

  const BASALE = {
    req:  'Richiesta',
    opt:  'Opzionale',
    skip: 'Omettibile',
  };

  const LIMITI = { giKg: [0.10, 1.20], idr: [0.4, 2.5] };

  /* ═══ LIBRERIA DI PARTENZA (estratto SIRM 2022) ════════════════════
     basale: req = richiesta · opt = opzionale · skip = omettibile
     kw = termini del quesito · ex = termini dell'esame (disambiguano)
     reg = regioni coperte (assente = qualunque) · fix = zona intrinseca  */
  const SIRM_2022 = [
    { id:'angio-polm', l:'AngioTC Polmonare', idr:1.5, giKg:0.45, basale:'opt',
      reg:['TO','TAs','TAc'],
      kw:['embolia','tromboembolia','tep'], ex:['torace'],
      nota:'SIRM indica l’acquisizione senza mdc come opzionale in questo protocollo.',
      fasi:[{fase:'arteriosa',zone:['TAs'],delay:'B-T'}] },
    { id:'cranio-trauma', l:'TC Cranio – Trauma cranico acuto', idr:0, giKg:0, basale:'req',
      reg:['ENC'],
      kw:['trauma cranico','trauma','caduta'], ex:['encefalo','cranio'],
      nota:'Protocollo interamente basale: la fase senza mdc è l’esame stesso.',
      fasi:[{fase:'basale',zone:['ENC'],delay:'',fix:1}] },
    { id:'encefalo-stroke', l:'TC Encefalo + angio-TC – Stroke', idr:1.6, giKg:0.35, basale:'req',
      reg:['ENC'],
      kw:['stroke','ictus','deficit neurologico','ischemia cerebrale'], ex:['encefalo'],
      nota:'Obbligatoria per escludere l’emorragia prima di qualunque fase contrastografica.',
      fasi:[{fase:'basale',zone:['ENC'],delay:'',fix:1},{fase:'arteriosa',zone:['Angio TC'],delay:'B-T',fix:1}] },
    { id:'fegato-cirr', l:'Fegato cirrotico – Stadiazione', idr:1.4, giKg:0.63, basale:'req',
      reg:['ADs','ADc','TAs','TAc'],
      kw:['hcc','epatocarcinoma','cirrosi','epatopatia','sorveglianza'], ex:['addome'],
      nota:'Studio quadrifasico: la basale serve a riconoscere le lesioni spontaneamente iperdense.',
      fasi:[{fase:'basale',zone:['ADs'],delay:'',fix:1},{fase:'arteriosa',zone:['ADs'],delay:'B-T',fix:1},
            {fase:'venosa',zone:['ADc'],delay:'75',fix:1},{fase:'tardiva',zone:['ADs'],delay:'300',fix:1}] },
    { id:'onco-ristad', l:'Oncologia – Ristadiazione', idr:1.4, giKg:0.55, basale:'skip',
      kw:['restaging','ristadiazione','stadiazione'], ex:[],
      nota:'Nel follow-up oncologico la basale è ridondante se esiste un precedente di confronto.',
      fasi:[{fase:'venosa',zone:['TAc'],delay:'75'}] },
    { id:'onco-fup', l:'Oncologia – Follow-up basso rischio', idr:1.3, giKg:0.50, basale:'skip',
      kw:['followup','recidiva'], ex:[],
      nota:'Nel follow-up la basale è ridondante se esiste un precedente di confronto.',
      fasi:[{fase:'venosa',zone:['ADc'],delay:'75'}] },
    { id:'vie-biliari', l:'Vie biliari – Patologia infiammatoria', idr:1.4, giKg:0.60, basale:'req',
      reg:['ADs','ADc','TAs','TAc'],
      kw:['colecistite','colangite','litiasi biliare'], ex:['addome'],
      nota:'La basale è necessaria per identificare i calcoli calcifici, mascherati dopo mdc.',
      fasi:[{fase:'basale',zone:['ADs'],delay:'',fix:1},{fase:'venosa',zone:['ADs'],delay:'70',fix:1}] },
    { id:'aorta-endop', l:'AngioTC Aorta – controllo endoprotesi', idr:1.6, giKg:0.55, basale:'req',
      reg:['ADc','TAc'],
      kw:['endoleak','endoprotesi','evar'], ex:['aorta'],
      nota:'Serve a distinguere le calcificazioni parietali dall’endoleak in fase contrastografica.',
      fasi:[{fase:'basale',zone:['ADc'],delay:'',fix:1},{fase:'arteriosa',zone:['Angio TC'],delay:'B-T',fix:1},
            {fase:'tardiva',zone:['ADc'],delay:'300',fix:1}] },
    { id:'aorta-diss', l:'TC Aorta – Dissezione', idr:1.8, giKg:0.55, basale:'req',
      reg:['TAc','ADc'],
      kw:['dissezione','sindrome aortica'], ex:['aorta'],
      nota:'La basale individua l’ematoma intramurale, isodenso dopo contrasto.',
      fasi:[{fase:'basale',zone:['TAc'],delay:'',fix:1},{fase:'arteriosa',zone:['Angio TC'],delay:'B-T',fix:1}] },
    { id:'urotc-split', l:'UROTC Split Bolus', idr:1.2, giKg:0.55, basale:'req',
      reg:['ADc'],
      kw:['ematuria','colica renale','idronefrosi','urolitiasi','calcolosi'], ex:['uro'],
      nota:'La basale è indispensabile per la ricerca di calcoli, indistinguibili dopo mdc.',
      fasi:[{fase:'basale',zone:['ADc'],delay:'',fix:1},{fase:'venosa',zone:['ADc'],delay:'100',fix:1}] },
    { id:'addome-acuto', l:'TC Addome acuto', idr:1.4, giKg:0.60, basale:'opt',
      reg:['ADs','ADc','TAs','TAc'],
      kw:['appendicite','diverticolite','occlusione','perforazione','addome acuto','peritonite'],
      ex:['addome'],
      nota:'SIRM indica l’acquisizione senza mdc come opzionale.',
      fasi:[{fase:'venosa',zone:['ADc'],delay:'70'}] },
    { id:'politrauma', l:'TC Total body – Politrauma', idr:1.6, giKg:0.60, basale:'opt',
      reg:['TAc'],
      kw:['politrauma','trauma maggiore','incidente stradale'], ex:['total body'],
      nota:'In urgenza la basale è spesso omessa per ridurre i tempi; resta utile sull’encefalo.',
      fasi:[{fase:'arteriosa',zone:['TAc'],delay:'B-T',fix:1},{fase:'venosa',zone:['ADc'],delay:'70',fix:1}] },
    { id:'hrct-nodulo', l:'HRCT – Nodulo polmonare', idr:0, giKg:0, basale:'req',
      reg:['TO','TAs','TAc'],
      kw:['nodulo','lungrads','interstiziopatia','fibrosi'], ex:['torace'],
      nota:'Protocollo senza mdc: l’acquisizione basale è l’intero esame.',
      fasi:[{fase:'basale',zone:['TAs'],delay:''}] },
    { id:'torace-mdc', l:'TC Torace con mdc', idr:1.4, giKg:0.50, basale:'opt',
      reg:['TO','TAs','TAc'],
      kw:['versamento','ascesso polmonare','mediastino'], ex:['torace'],
      nota:'SIRM indica l’acquisizione senza mdc come opzionale.',
      fasi:[{fase:'venosa',zone:['TAs'],delay:'70'}] },
  ];

  /* ═══ TESTO ════════════════════════════════════════════════════════ */
  /* normalizzazione condivisa da matcher e termini: la stessa del prototipo,
     così un termine scritto nel tool PC si comporta uguale sul telefono  */
  function normText(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/follow[\s-]?up/g, 'followup').replace(/lung[\s-]?rads/g, 'lungrads')
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* ═══ REGIONE ANATOMICA DALL'ESAME ═════════════════════════════════
     Regole ordinate dalla più specifica alla più generica: il primo
     riscontro vince, quindi stesso esame → stessa regione, sempre.     */
  function regionOf(esame) {
    const t = normText(esame);
    if (/total body|whole body/.test(t))              return 'TAc';
    if (/aorta/.test(t))                              return /toracic|ascendente|arco/.test(t) ? 'TAc' : 'ADc';
    if (/\buro\b|urotc|uro tc|renal|vescic/.test(t))  return 'ADc';
    if (/encefal|cranio|cerebral|capo/.test(t))       return 'ENC';
    if (/\bcollo\b|cervical|tiroide|laring|faring|parotid/.test(t)) return 'Collo';
    if (/rachide|colonna|vertebr|bacino|femore|ginocchio|spalla|omero|arto|polso|caviglia|piede|mano|massiccio|facciale|temporale|orbit|seni paranasal|mandibol/.test(t))
      return 'ALTRO';                       // distretto riconosciuto ma fuori tassonomia
    const tor = /torac/.test(t), add = /addom/.test(t), sup = /superior|\bsup\b/.test(t);
    if (tor && add) return sup ? 'TAs' : 'TAc';
    if (tor)        return 'TO';
    if (add)        return sup ? 'ADs' : 'ADc';
    return null;
  }

  /* ═══ RICONOSCIMENTO — deterministico ══════════════════════════════
     punteggio = Σ (parole del termine × 2) sui termini del quesito
               + 1 per ogni termine dell'esame riconosciuto
     La regione dell'esame esclude i protocolli che non la coprono; senza
     un riscontro nel quesito un protocollo non è candidato. A parità vince
     il primo in elenco. Restituisce anche i candidati scartati, così il
     tool PC può spiegare perché ha scelto quello che ha scelto.         */
  function riconosci(protocolli, esame, quesito) {
    const tq = normText(quesito), te = normText(esame);
    const regione = regionOf(esame);
    const candidati = [];
    let best = null;
    protocolli.forEach((v, ordine) => {
      const kw = (v.kw || []).filter(w => w && tq.includes(normText(w)));
      const ex = (v.ex || []).filter(w => w && te.includes(normText(w)));
      const sKw = kw.reduce((s, w) => s + normText(w).split(' ').length * 2, 0);
      const fuori = !!(regione && v.reg && v.reg.length && !v.reg.includes(regione));
      if (!sKw && !ex.length) return;
      const c = { id: v.id, punteggio: sKw + ex.length, kw, ex, fuori, ordine };
      candidati.push(c);
      if (fuori || !sKw) return;
      if (!best || c.punteggio > best.punteggio) best = c;
    });
    candidati.sort((a, b) => b.punteggio - a.punteggio || a.ordine - b.ordine);
    return { id: best ? best.id : null, regione, candidati };
  }

  /* Applica la regione dell'esame alle fasi del protocollo. Le fasi `fix`
     conservano la propria zona: è intrinseca al protocollo.            */
  function fitZones(fasi, esame) {
    const r = regionOf(esame);
    return fasi.map(f => {
      const { fix, ...pulita } = f;
      if (fix || !r || !ZONE[f.fase].some(([c]) => c === r)) return pulita;
      return { ...pulita, zone: [r] };
    });
  }

  /* ═══ VALIDAZIONE ═══════════════════════════════════════════════════
     grave = il protocollo non può essere sincronizzato così com'è
     altrimenti è un'incoerenza da segnalare ma che non blocca          */
  function valida(p, protocolli) {
    const e = [];
    const add = (campo, msg, grave) => e.push({ campo, msg, grave: !!grave });
    if (!p.l || !p.l.trim()) add('l', 'Manca il nome del protocollo', true);
    if (protocolli && protocolli.some(q => q.id !== p.id && q.l.trim().toLowerCase() === (p.l || '').trim().toLowerCase()))
      add('l', 'Esiste già un protocollo con questo nome', true);
    if (!p.fasi || !p.fasi.length) add('fasi', 'Nessuna fase di acquisizione', true);
    (p.fasi || []).forEach((f, i) => {
      const n = `Fase ${i + 1} (${FASI[f.fase] ? FASI[f.fase].l : f.fase})`;
      if (!FASI[f.fase]) add('fasi', `${n}: tipo di fase sconosciuto`, true);
      if (!f.zone || !f.zone.length) add('fasi', `${n}: nessuna zona selezionata`, true);
      if (f.fase !== 'basale' && f.delay && !/^(B-T|\d{1,3})$/.test(f.delay))
        add('fasi', `${n}: ritardo non valido — secondi oppure B-T`, true);
      if (f.fase !== 'basale' && !f.delay) add('fasi', `${n}: ritardo non indicato`);
    });
    const conMdc = (p.fasi || []).some(f => FASI[f.fase] && FASI[f.fase].mdc);
    if (conMdc) {
      if (!(p.giKg >= LIMITI.giKg[0] && p.giKg <= LIMITI.giKg[1]))
        add('mdc', `Dose di iodio fuori intervallo (${LIMITI.giKg[0]}–${LIMITI.giKg[1]} gI/kg)`, true);
      if (!(p.idr >= LIMITI.idr[0] && p.idr <= LIMITI.idr[1]))
        add('mdc', `IDR fuori intervallo (${LIMITI.idr[0]}–${LIMITI.idr[1]} gI/s)`, true);
    }
    const hasBas = (p.fasi || []).some(f => f.fase === 'basale');
    if (p.basale === 'req' && !hasBas) add('basale', 'Basale indicata come richiesta ma assente dalle fasi');
    if (p.basale !== 'req' && hasBas) add('basale', 'Basale presente nelle fasi ma indicata come non richiesta');
    if (!(p.kw || []).length) add('kw', 'Nessun termine del quesito: il protocollo non verrà mai suggerito');
    return e;
  }

  /* ═══ LIBRERIA ══════════════════════════════════════════════════════ */
  const clona = x => JSON.parse(JSON.stringify(x));

  function nuovaLibreria() {
    return { v: 1, base: 'SIRM 2022', modificata: 0, protocolli: clona(SIRM_2022) };
  }

  function slug(s) {
    return normText(s).replace(/ /g, '-').slice(0, 40) || 'protocollo';
  }
  function idLibero(protocolli, nome) {
    const base = slug(nome);
    let id = base, n = 2;
    while (protocolli.some(p => p.id === id)) id = `${base}-${n++}`;
    return id;
  }

  /* Forma canonica di un protocollo: sempre gli stessi campi, nello stesso
     ordine. Serve alla firma (due librerie uguali hanno la stessa firma
     anche se sono state salvate in momenti diversi) e alla sincronizzazione. */
  function canonico(p) {
    const o = { id: p.id, l: (p.l || '').trim(), idr: +p.idr || 0, giKg: +p.giKg || 0,
      basale: p.basale, kw: (p.kw || []).slice(), ex: (p.ex || []).slice(),
      nota: (p.nota || '').trim(),
      fasi: (p.fasi || []).map(f => {
        const x = { fase: f.fase, zone: (f.zone || []).slice(), delay: f.delay || '' };
        if (f.fix) x.fix = 1;
        return x;
      }) };
    if (p.reg && p.reg.length) o.reg = p.reg.slice();
    return o;
  }

  /* firma della libreria: identifica una versione senza doverla confrontare
     campo per campo. djb2 su JSON canonico: non crittografica, basta a
     riconoscere se telefono e PC hanno la stessa libreria.              */
  function firma(protocolli) {
    const s = JSON.stringify(protocolli.map(canonico));
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
  }

  /* lettura di una libreria da file: accetta solo ciò che riconosce, e
     segnala il resto invece di importarlo a metà                        */
  function leggiLibreria(testo) {
    let j;
    try { j = JSON.parse(testo); } catch (_) { throw new Error('il file non è JSON valido'); }
    const arr = Array.isArray(j) ? j : j && Array.isArray(j.protocolli) ? j.protocolli : null;
    if (!arr) throw new Error('nessun elenco di protocolli nel file');
    const visti = new Set();
    const out = arr.map((p, i) => {
      if (!p || typeof p !== 'object') throw new Error(`voce ${i + 1}: non è un protocollo`);
      if (!p.id || visti.has(p.id)) throw new Error(`voce ${i + 1}: identificativo mancante o doppio`);
      visti.add(p.id);
      if (!BASALE[p.basale]) throw new Error(`«${p.l || p.id}»: regola basale sconosciuta`);
      if (!Array.isArray(p.fasi)) throw new Error(`«${p.l || p.id}»: fasi mancanti`);
      p.fasi.forEach(f => { if (!FASI[f.fase]) throw new Error(`«${p.l || p.id}»: fase «${f.fase}» sconosciuta`); });
      return canonico(p);
    });
    return { v: 1, base: (j && j.base) || 'importata', modificata: Date.now(), protocolli: out };
  }

  const api = { FASI, ZONE, ZONE_L, REGIONI, BASALE, LIMITI, SIRM_2022,
    normText, regionOf, riconosci, fitZones, valida,
    nuovaLibreria, idLibero, canonico, firma, leggiLibreria, clona };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Protocolli = api;
})(this);
