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
  /* colore di ogni fase, uguale su PC e telefono:
       basale grigio · arteriosa rosso · venosa blu · tardiva verde acqua
       urografica giallo · tardiva per surrene bordeaux
     c = colore pieno · bg/tx = fondo e testo del tag · s = sigla        */
  const FASI = {
    basale:     { l: 'Basale',          s: 'BAS', c: '#8A94A6', bg: '#ECEFF3', tx: '#4A5263', mdc: false, delay: ''    },
    arteriosa:  { l: 'Arteriosa',       s: 'ART', c: '#E0473E', bg: '#FCE6E4', tx: '#A3221B', mdc: true,  delay: 'B-T' },
    venosa:     { l: 'Venosa',          s: 'VEN', c: '#2F6FED', bg: '#E3ECFD', tx: '#1C4FB8', mdc: true,  delay: '70'  },
    tardiva:    { l: 'Tardiva',         s: 'TAR', c: '#1FB5A8', bg: '#DCF4F1', tx: '#0B7168', mdc: true,  delay: '300' },
    urografica: { l: 'Urografica',      s: 'URO', c: '#F2C230', bg: '#FDF3D3', tx: '#7E5F00', mdc: true,  delay: '600' },
    surrene:    { l: 'Tardiva surrene', s: 'SUR', c: '#8E1B3A', bg: '#F5E0E6', tx: '#8E1B3A', mdc: true,  delay: '900' },
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
    /* l'urografica copre le vie escretrici fino alla vescica; il washout
       surrenalico si limita al distretto dei surreni                   */
    urografica:[['ADc','Addome compl.'],['TAc','Torace-addome compl.']],
    surrene:  [['ADs','Addome sup.'],['ADc','Addome compl.']],
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

  /* ═══ APPRENDIMENTO ════════════════════════════════════════════════
     Come nel prototipo: un caso è identificato da una firma deterministica
     (esame normalizzato + termini clinici del quesito). Quando per un caso
     si sceglie un protocollo diverso da quello suggerito, la scelta viene
     ricordata sotto quella firma, e il caso identico successivo la ritrova. */
  const LEXICON = ['embolia','dissezione','aneurisma','endoleak','trauma','stroke','ischemia',
    'emorragia','hcc','cirrosi','epatopatia','colecistite','litiasi','calcoli','ematuria',
    'idronefrosi','appendicite','diverticolite','occlusione','pielonefrite','nodulo','sarcoidosi',
    'restaging','ristadiazione','stadiazione','followup','recidiva','neoplasia','metastasi',
    'linfoma','ascesso','flogosi','infezione','pancreatite','sanguinamento','politrauma','versamento'];

  function normEx(s) {
    return (s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\b(CON E SENZA|SENZA E CON|CON|SENZA)\s+(MDC|CONTRASTO)\b/g, '')
      .replace(/\b(URGENTE|URG|MDC|CONTRASTO)\b/g, '')
      .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const termini = q => { const t = normText(q);
    return [...new Set(LEXICON.filter(k => t.includes(k)))].sort(); };
  const firmaCaso = (esame, quesito) => normEx(esame) + '|' + termini(quesito).join(',');

  /* Suggerimento completo, nell'ordine in cui lo farà il telefono:
       1. protocollo personale appreso con la stessa firma del caso
       2. protocolli personali riconosciuti dai loro termini
       3. protocolli ufficiali riconosciuti dai loro termini
     I personali vengono prima: sono le scelte del reparto.            */
  function suggerisci(ufficiali, personali, esame, quesito) {
    const firma = firmaCaso(esame, quesito);
    const pers = personali || [];
    const app = pers.find(p => p.appreso && p.appreso.firma === firma);
    const rp = riconosci(pers, esame, quesito);
    const ru = riconosci(ufficiali || [], esame, quesito);
    let id = null, fonte = null;
    if (app)        { id = app.id;  fonte = 'appreso'; }
    else if (rp.id) { id = rp.id;   fonte = 'personale'; }
    else if (ru.id) { id = ru.id;   fonte = 'ufficiale'; }
    return { id, fonte, firma, regione: ru.regione, personali: rp, ufficiali: ru };
  }

  /* Le due opzioni proposte per ogni paziente: la migliore ufficiale e la
     migliore personale (voce appresa per quel caso, altrimenti personale
     riconosciuta dai termini). Si propone la personale quando c'è, perché
     è la scelta del reparto; il telefono le riceve entrambe e l'operatore
     può cambiare idea anche lì.                                         */
  function opzioni(ufficiali, personali, esame, quesito) {
    const s = suggerisci(ufficiali, personali, esame, quesito);
    const personale = s.fonte === 'appreso' ? s.id : s.personali.id;
    return { ufficiale: s.ufficiali.id, personale, appreso: s.fonte === 'appreso', firma: s.firma,
             predefinita: personale ? 'personale' : s.ufficiali.id ? 'ufficiale' : null };
  }

  /* ═══ BUILDER: cosa si impara da una richiesta d'esempio ════════════
     Dal quesito: i termini clinici noti (lessico) e le altre parole
     significative, che l'operatore può promuovere a termini propri.
     Dall'esame: la regione e le parole che identificano il distretto.  */
  const VUOTE = new Set(('sospetta sospetto sospetti sospette controllo paziente pazienti pregressa pregresso '
    + 'noto nota note esame esami valutazione studio richiesta richiesto dopo prima durante circa anni '
    + 'della delle dello degli del dei con per tra fra nel nella nelle negli sul sulla una uno che non '
    + 'come anche ancora già gia recente recenti acuto acuta cronico cronica dx sin destro sinistro '
    + 'destra sinistra bilaterale eventuale eventuali quadro').split(' '));
  const ESAME_VUOTE = new Set('tc angio angiotc con senza mdc contrasto e ed urgente urg completo completa di del della'.split(' '));

  function analizzaEsempio(esame, quesito) {
    const clinici = termini(quesito);
    const parole = [...new Set(normText(quesito).split(' ')
      .filter(w => w.length >= 4 && !VUOTE.has(w) && !/^d+$/.test(w) && !clinici.some(c => c.includes(w) || w.includes(c))))];
    const distretto = [...new Set(normText(esame).split(' ').filter(w => w.length >= 3 && !ESAME_VUOTE.has(w)))];
    const r = regionOf(esame);
    return { regione: r && r !== 'ALTRO' ? r : null, clinici, parole, distretto };
  }

  /* Registra una scelta nella libreria personale. Restituisce la voce
     appresa: nuova, oppure quella esistente per la stessa firma, con il
     conteggio aggiornato se la configurazione è la stessa o azzerato se
     è cambiata (come nel prototipo).                                   */
  function impara(personali, sorgente, esame, quesito, ora) {
    ora = ora || Date.now();
    const firma = firmaCaso(esame, quesito);
    const conf = p => JSON.stringify(canonico({ ...p, id: '', l: '', kw: [], ex: [], reg: null, nota: '' }).fasi)
                    + '|' + (+p.idr || 0) + '|' + (+p.giKg || 0) + '|' + p.basale;
    let voce = personali.find(p => p.appreso && p.appreso.firma === firma);
    if (voce) {
      if (voce === sorgente || conf(voce) === conf(sorgente)) voce.appreso.volte++;
      else {
        Object.assign(voce, { fasi: clona(sorgente.fasi), idr: sorgente.idr, giKg: sorgente.giKg,
          basale: sorgente.basale, nota: sorgente.nota, base: sorgente.appreso ? sorgente.base : sorgente.id });
        voce.appreso.volte = 1;
      }
      voce.appreso.ultimo = ora;
      return voce;
    }
    const t = termini(quesito);
    const nome = `${(sorgente.l || 'Protocollo').replace(/ · .*$/, '')} · ${normEx(esame) || 'esame'}${t.length ? ' · ' + t.join(', ') : ''}`;
    voce = { id: idPersonale(personali, nome), l: nome, idr: sorgente.idr, giKg: sorgente.giKg,
      basale: sorgente.basale, kw: [], ex: [], nota: sorgente.nota || '', fasi: clona(sorgente.fasi),
      base: sorgente.appreso ? sorgente.base : sorgente.id,
      /* della richiesta si conserva solo la firma: esame normalizzato e
         termini clinici. Il testo libero del quesito può contenere dati
         del paziente e non resta salvato.                               */
      appreso: { firma, esame: normEx(esame), termini: t, volte: 1, creato: ora, ultimo: ora } };
    personali.unshift(voce);
    return voce;
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
    /* una voce appresa si riconosce dalla firma del caso: i termini sono
       facoltativi e servono solo a estenderla a casi simili              */
    if (!(p.kw || []).length && !p.appreso) add('kw', 'Nessun termine del quesito: il protocollo non verrà mai suggerito');
    return e;
  }

  /* ═══ LIBRERIA ══════════════════════════════════════════════════════ */
  const clona = x => JSON.parse(JSON.stringify(x));

  function nuovaLibreria() {
    return { v: 1, base: 'SIRM 2022', modificata: 0, protocolli: clona(SIRM_2022) };
  }
  function nuovaLibreriaPersonale() {
    return { v: 1, base: 'personale', modificata: 0, protocolli: [] };
  }

  function slug(s) {
    return normText(s).replace(/ /g, '-').slice(0, 40) || 'protocollo';
  }
  /* i protocolli personali hanno sempre il prefisso p-: non possono mai
     collidere con quelli ufficiali, e dall'id si capisce la libreria    */
  function idPersonale(protocolli, nome) { return idLibero(protocolli, 'p ' + nome); }
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
    if (p.base) o.base = p.base;
    if (p.appreso) o.appreso = { firma: p.appreso.firma, esame: p.appreso.esame || '',
      termini: (p.appreso.termini || []).slice(),
      volte: +p.appreso.volte || 1, creato: +p.appreso.creato || 0, ultimo: +p.appreso.ultimo || 0 };
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

  const api = { FASI, ZONE, ZONE_L, REGIONI, BASALE, LIMITI, SIRM_2022, LEXICON,
    normText, normEx, termini, regionOf, riconosci, fitZones, valida,
    firmaCaso, suggerisci, impara, opzioni, analizzaEsempio,
    nuovaLibreria, nuovaLibreriaPersonale, idLibero, idPersonale, canonico, firma, leggiLibreria, clona };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Protocolli = api;
})(this);
