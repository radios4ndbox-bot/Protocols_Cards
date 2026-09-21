/* ═══════════════════════════════════════════════════════════════════════
   Parser della lista esami RIS — profilo "Desio / Lista esami da eseguire"

   Riceve gli elementi di testo con le loro coordinate, così come li
   restituisce pdf.js (`item.transform[4]` = x, `item.transform[5]` = y,
   `item.str` = testo), e ricostruisce la tabella.

   Il documento è una tabella annidata: ogni paziente è una riga della
   tabella esterna, e sotto di lui una sotto-tabella con gli esami
   richiesti. Le celle vanno a capo, quindi una riga logica occupa più
   righe fisiche.

   Due caratteristiche del generatore, verificate sul campo:
   · le righe di una cella si susseguono nella direzione +y, non −y;
   · la riga con il numero di accettazione apre il blocco del paziente,
     che prosegue fino al numero di accettazione successivo.
   La direzione viene comunque ricavata dal documento stesso invece di
   essere data per scontata, così un generatore con assi invertiti non
   manda tutto all'aria.
   ═══════════════════════════════════════════════════════════════════════ */

(function (root) {
  'use strict';

  /* Confini delle colonne espressi come frazione della larghezza di pagina.
     In unità assolute sarebbero legati al motore di estrazione: pdf.js e
     pypdf, sullo stesso documento, restituiscono coordinate in scale
     diverse (rapporto 4/3). La frazione invece è la stessa ovunque.      */
  const COLS = [
    ['codice',      -1,     0.1158],   // accettazione (paziente) · codice (esame)
    ['descrizione',  0.1158, 0.2111],
    ['orario',       0.2111, 0.2761],
    ['paziente',     0.2761, 0.3296],
    ['nascita',      0.3296, 0.3830],
    ['diagnostica',  0.3830, 0.4373],
    ['provenienza',  0.4373, 0.5184],
    ['stato',        0.5184, 0.6065],
    ['urgenza',      0.6065, 0.6671],
    ['statoEsame',   0.6671, 0.7161],
    ['tariffario',   0.7161, 0.7972],
    ['dose',         0.7972, 99],
  ];

  /* Ancore per l'autocalibrazione: nella riga d'intestazione della
     sotto-tabella esami, «Codice» e «Dose» stanno a queste frazioni.     */
  const ANCORA = { Codice: 0.0567, Dose: 0.8562 };
  /* seconda ancora: il numero di accettazione è allineato alla stessa
     frazione di «Codice», e c'è anche su pagine senza intestazione.     */
  const ANCORA_ACC = 0.0567;

  const RE_ACC    = /^0D\d{6,10}$/;
  const RE_CODICE = /^\d{6,}[A-Z0-9.\-]*$/;
  const RE_DATA   = /^\d{2}\/\d{2}\/\d{4}$/;
  const RE_ORA    = /^\d{2}:\d{2}$/;
  const HDR_ESAMI = 'codice';                       // prima cella dell'intestazione

  /* Righe di servizio del report: titolo, intestazione di pagina,
     intestazione della tabella esterna. Vanno tolte prima di dividere in
     blocchi, altrimenti finiscono nel blocco del paziente precedente
     quando si concatenano le pagine.                                    */
  function èRumore(r) {
    const t = Object.values(r.c).join(' ').replace(/\s+/g, ' ').trim();
    if (!t) return true;
    if (/^Lista esami da eseguire$/i.test(t)) return true;
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+\d+\s+Of\s+\d+/i.test(t)) return true;
    if (/Acc\. Number/i.test(t)) return true;
    if (/^(Richieste|errori|Tipo invio|Progressivo ricetta|Prog\.Acc\.)$/i.test(t)) return true;
    return false;
  }

  const colDi = f => (COLS.find(c => f >= c[1] && f < c[2]) || COLS[0])[0];

  /* Larghezza di pagina ricavata dal documento: la distanza fra «Codice» e
     «Dose» nell'intestazione degli esami è nota in frazioni, quindi basta
     una proporzione. Serve solo quando la larghezza non viene fornita.   */
  const testoDi = i => (i.str !== undefined ? i.str : i.t || '').trim();
  const xDi = i => (i.x !== undefined ? i.x : (i.transform || [])[4]);
  const yDi = i => (i.y !== undefined ? i.y : (i.transform || [])[5]);

  /* La scala è la stessa su tutte le pagine, quindi si calibra una volta
     sull'intero documento: una pagina che contiene solo la coda di un
     blocco non ha intestazioni, e da sola non sarebbe calibrabile.
     Due ancore, dalla più precisa alla più disponibile.                 */
  function calibra(tuttiGliItems) {
    const it = tuttiGliItems.filter(i => typeof xDi(i) === 'number');

    const cod = it.filter(i => testoDi(i) === 'Codice');
    const dos = it.filter(i => testoDi(i) === 'Dose');
    for (const a of cod) for (const b of dos) {
      if (Math.abs(yDi(a) - yDi(b)) > 2) continue;
      if (xDi(b) > xDi(a)) return (xDi(b) - xDi(a)) / (ANCORA.Dose - ANCORA.Codice);
    }

    const acc = it.filter(i => RE_ACC.test(testoDi(i)));
    if (acc.length) {
      const xs = acc.map(xDi).sort((a, b) => a - b);
      return xs[Math.floor(xs.length / 2)] / ANCORA_ACC;      // mediana
    }
    return 0;
  }

  /* ── righe fisiche: elementi raggruppati per y ────────────────────── */
  function righe(items, tolleranza, larghezza) {
    const map = [];
    for (const it of items) {
      const testo = (it.str !== undefined ? it.str : it.t || '').trim();
      if (!testo) continue;
      const tr = it.transform;
      const x = it.x !== undefined ? it.x : (tr ? tr[4] : undefined);
      const y = it.y !== undefined ? it.y : (tr ? tr[5] : undefined);
      if (typeof x !== 'number' || typeof y !== 'number') continue;   // elemento senza coordinate
      let g = map.find(r => Math.abs(r.y - y) <= tolleranza);
      if (!g) { g = { y, celle: [] }; map.push(g); }
      g.celle.push({ x, testo });
    }
    return map.map(r => {
      const c = {};
      r.celle.sort((a, b) => a.x - b.x).forEach(e => {
        const k = colDi(e.x / larghezza);
        c[k] = c[k] ? c[k] + ' ' + e.testo : e.testo;
      });
      return { y: r.y, c, vuota: Object.keys(c).length === 0 };
    });
  }

  /* ── direzione di lettura di un blocco, ricavata dal documento ─────
     Dalla riga di accettazione, l'orario HH:MM sta nella riga successiva:
     da che parte si trovi lo decide il documento, non un'assunzione.   */
  function direzione(ordinate) {
    const idxAcc = ordinate
      .map((r, i) => (RE_ACC.test(r.c.codice || '') ? i : -1))
      .filter(i => i >= 0);
    let su = 0, giu = 0;
    for (const i of idxAcc) {
      const dopo  = ordinate[i + 1], prima = ordinate[i - 1];
      if (dopo  && RE_ORA.test((dopo.c.orario  || '').trim())) su++;
      if (prima && RE_ORA.test((prima.c.orario || '').trim())) giu++;
    }
    return giu > su ? -1 : 1;            // +1 = il blocco prosegue in +y
  }

  /* ── un blocco → un paziente ──────────────────────────────────────── */
  function leggiBlocco(blocco) {
    const capo = blocco[0].c;
    const p = {
      accession:   (capo.codice || '').trim(),
      data:        '',
      ora:         '',
      cognome:     (capo.paziente || '').trim(),
      nome:        '',
      nascita:     '',
      diagnostica: (capo.diagnostica || '').trim(),
      provenienza: (capo.provenienza || '').trim(),
      stato:       (capo.stato || '').trim(),
      urgenza:     (capo.urgenza || '').trim(),
      quesito:     '',
      esami:       [],
      incerto:     [],
    };
    if (RE_DATA.test((capo.orario || '').trim())) p.data = capo.orario.trim();
    if (RE_DATA.test((capo.nascita || '').trim())) p.nascita = capo.nascita.trim();

    let negliEsami = false;
    const quesiti = [];

    for (let i = 1; i < blocco.length; i++) {
      const c = blocco[i].c;
      const cod = (c.codice || '').trim();

      if (!negliEsami && cod.toLowerCase() === HDR_ESAMI) { negliEsami = true; continue; }

      if (negliEsami) {
        if (RE_CODICE.test(cod)) {
          p.esami.push({
            codice: cod,
            descrizione: (c.descrizione || '').trim(),
            stato: (c.statoEsame || c.urgenza || '').trim(),
          });
        }
        continue;
      }

      /* riga a tutta larghezza, senza codice riconoscibile → quesito */
      const soloTesto = cod && !RE_CODICE.test(cod) && !RE_ACC.test(cod)
                        && !c.paziente && !c.orario && !c.nascita;
      if (soloTesto) { quesiti.push(cod); continue; }

      /* altrimenti è il proseguimento delle celle andate a capo */
      const ora = (c.orario || '').trim();
      if (RE_ORA.test(ora)) p.ora = ora;
      else if (ora && !p.data && RE_DATA.test(ora)) p.data = ora;

      if (c.paziente)    p.nome        = (p.nome + ' ' + c.paziente).trim();
      if (c.diagnostica) p.diagnostica = (p.diagnostica + ' ' + c.diagnostica).trim();
      if (c.provenienza) p.provenienza = (p.provenienza + ' ' + c.provenienza).trim();
      if (c.urgenza && !p.urgenza) p.urgenza = c.urgenza.trim();
      if (c.stato && !p.stato)     p.stato   = c.stato.trim();
    }

    p.quesito = quesiti.join(' ').replace(/\s+/g, ' ').trim();
    p.nomeCompleto = (p.cognome + ' ' + p.nome).replace(/\s+/g, ' ').trim();

    /* ── segnalazioni: cosa il parser non è riuscito a ricavare ─────── */
    if (!p.nomeCompleto)           p.incerto.push('nome');
    if (!p.nascita)                p.incerto.push('data di nascita');
    if (!p.ora)                    p.incerto.push('orario');
    if (!p.esami.length)           p.incerto.push('nessun esame');
    if (!p.quesito)                p.incerto.push('quesito');
    if (p.nomeCompleto && p.nomeCompleto.split(/\s+/).length < 2)
      p.incerto.push('nome incompleto');

    return p;
  }

  /* ── ingresso pubblico ────────────────────────────────────────────── */
  function parseRis(pagine, opz) {
    const o = opz || {};
    const tol = o.tolleranzaY || 2;

    /* Le pagine vengono concatenate in un flusso unico: il blocco di un
       paziente può proseguire sulla pagina seguente, e l'ultimo esame
       finire da solo in fondo al documento.                             */
    let flusso = [];
    const avvisi = [];
    const globale = o.larghezzaPagina
      || calibra(pagine.flatMap(p => (Array.isArray(p) ? p : p.items) || []));

    /* Prima passata: ricostruzione delle righe, senza ancora ordinarle. */
    const perPagina = pagine.map((pagina, pi) => {
      const items = Array.isArray(pagina) ? pagina : pagina.items;
      const larghezza = (Array.isArray(pagina) ? 0 : pagina.larghezza) || globale;
      if (!larghezza) { avvisi.push(`pagina ${pi + 1}: larghezza non determinabile`); return []; }
      const rs = righe(items, tol, larghezza).filter(r => !r.vuota && !èRumore(r));
      rs.forEach(r => { r.pagina = pi + 1; });
      return rs;
    });

    /* Il verso di lettura è una proprietà del documento, non della singola
       pagina: una pagina di continuazione non contiene righe di accettazione
       e da sola non offre alcun indizio. Deciderlo pagina per pagina la
       farebbe leggere al contrario.                                       */
    const dir = o.direzione
      || direzione(perPagina.flat().slice().sort((a, b) => a.y - b.y));

    perPagina.forEach(rs => {
      rs.sort((a, b) => (a.y - b.y) * dir);
      flusso = flusso.concat(rs);
    });

    const inizi = flusso.map((r, i) => (RE_ACC.test((r.c.codice || '').trim()) ? i : -1))
                        .filter(i => i >= 0);

    const pazienti = inizi.map((s, k) => {
      const e = k + 1 < inizi.length ? inizi[k + 1] : flusso.length;
      const p = leggiBlocco(flusso.slice(s, e));
      p.pagina = flusso[s].pagina;
      return p;
    });

    /* righe rimaste fuori da ogni blocco: se ce ne sono, il profilo non
       descrive bene il documento e va segnalato.                        */
    const fuoriBlocco = inizi.length ? inizi[0] : flusso.length;

    /* ordine di seduta: l'orario, non l'ordine di stampa */
    pazienti.sort((a, b) => (a.ora || '99:99').localeCompare(b.ora || '99:99'));

    return {
      pazienti,
      avvisi,
      righeIgnorate: fuoriBlocco,
      conSegnalazioni: pazienti.filter(p => p.incerto.length).length,
    };
  }

  const api = { parseRis, righe, direzione, calibra, COLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RisParser = api;
})(typeof self !== 'undefined' ? self : this);
