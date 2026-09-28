/* ═══════════════════════════════════════════════════════════════════════
   PROTOCOL CARDS · canale cifrato PC ↔ telefono

   PC e telefono non si vedono in rete: il PC è nella rete ospedaliera,
   il telefono su quella mobile. Entrambi si collegano IN USCITA a un
   relay pubblico (ntfy.sh) e si scambiano messaggi su un argomento
   segreto. Il relay vede solo testo cifrato (verificato in reparto con
   sync-test/: relay raggiungibile, canale aperto, andata e ritorno).

   L'abbinamento è una coppia { t, k }: argomento del relay e chiave
   AES-GCM a 256 bit. Nasce sul PC, passa al telefono solo nel QR, nel
   frammento dell'indirizzo (#…), che non viene mai inviato ad alcun
   server. Da lì in poi entrambi lo conservano e lo riusano.

   Busta: { v, da, iv, ct }. Il mittente è dato autenticato, così un
   messaggio del PC non può essere rispedito al PC come se fosse del
   telefono.

   La lista viaggia a pezzi: ntfy.sh trasforma in allegato i messaggi
   oltre i 4 KB, e l'allegato non arriverebbe nel flusso. Ogni pezzo sta
   largamente sotto il limite anche dopo cifratura e base64.

   Condiviso fra tool PC (incorporato da build.js) e app del telefono.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  let RELAY = 'https://ntfy.sh';        // sostituibile solo dai test, con usaRelay
  const PEZZO = 2400;                   // caratteri di lista per messaggio

  const b64u = {
    da: bytes => {
      let s = '';
      const u = new Uint8Array(bytes);
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    a: s => {
      s = s.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return Uint8Array.from(atob(s), c => c.charCodeAt(0));
    },
  };

  function casuale(n) {
    const A = 'abcdefghijkmnpqrstuvwxyz23456789';     // niente caratteri ambigui
    return Array.from(crypto.getRandomValues(new Uint8Array(n)), b => A[b % A.length]).join('');
  }

  const RE_ARG = /^pcsync-[a-z0-9]{22}$/;
  const valido = a => !!a && RE_ARG.test(a.t || '') && /^[A-Za-z0-9_-]{43}$/.test(a.k || '');

  /* ─── abbinamento ─────────────────────────────────────────────────── */
  async function nuovoAbbinamento() {
    const chiave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    return { t: 'pcsync-' + casuale(22), k: b64u.da(await crypto.subtle.exportKey('raw', chiave)) };
  }

  /* { t, k } dal frammento dell'indirizzo; null se non c'è o è incompleto */
  function daFrammento(hash) {
    const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const a = { t: q.get('t'), k: q.get('k') };
    return valido(a) ? a : null;
  }
  const frammento = a => `#t=${a.t}&k=${a.k}`;

  async function apri(a) {
    if (!valido(a)) throw new Error('abbinamento non valido');
    const chiave = await crypto.subtle.importKey('raw', b64u.a(a.k), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { argomento: a.t, chiave };
  }

  /* ─── busta cifrata ───────────────────────────────────────────────── */
  async function cifra(sess, da, oggetto) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(da) },
      sess.chiave, new TextEncoder().encode(JSON.stringify(oggetto)));
    return JSON.stringify({ v: 1, da, iv: b64u.da(iv), ct: b64u.da(ct) });
  }

  async function decifra(sess, testo) {
    const b = JSON.parse(testo);
    if (b.v !== 1 || !b.da || !b.iv || !b.ct) throw new Error('busta sconosciuta');
    const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64u.a(b.iv), additionalData: new TextEncoder().encode(b.da) },
      sess.chiave, b64u.a(b.ct));
    return { da: b.da, msg: JSON.parse(new TextDecoder().decode(chiaro)) };
  }

  /* ─── relay ───────────────────────────────────────────────────────── */
  async function invia(sess, da, oggetto) {
    const corpo = await cifra(sess, da, oggetto);
    const r = await fetch(`${RELAY}/${sess.argomento}`, { method: 'POST', body: corpo, cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 429 ? 'troppi invii ravvicinati, riprova fra un minuto' : 'relay: HTTP ' + r.status);
    return corpo.length;
  }

  /* ascolto con EventSource: si riconnette da solo se la rete cade. Con
     since=all il relay consegna anche quanto arrivato mentre si era
     chiusi (ntfy.sh conserva i messaggi 12 ore): il telefono riceve la
     lista anche se l'app era chiusa al momento dell'invio. Alla
     riconnessione può ripetere messaggi già consegnati: si scartano per
     identificativo. I propri messaggi e quelli che non si decifrano con
     la chiave si ignorano.                                             */
  function ascolta(sess, io, { messaggio, stato = () => {} }) {
    const visti = new Set();
    const es = new EventSource(`${RELAY}/${sess.argomento}/sse?since=all`);
    es.onopen = () => stato('aperto');
    es.onerror = () => stato(es.readyState === EventSource.CLOSED ? 'chiuso' : 'riconnessione');
    es.onmessage = async ev => {
      let e; try { e = JSON.parse(ev.data); } catch (_) { return; }
      if (e.event !== 'message' || visti.has(e.id)) return;
      visti.add(e.id);
      let m;
      try { m = await decifra(sess, e.message); } catch (_) { return stato('scartato'); }
      if (m.da !== io) messaggio(m.msg);
    };
    return () => es.close();
  }

  /* ─── lista a pezzi ───────────────────────────────────────────────── */

  /* somma di controllo sull'intero corpo: ogni pezzo è già autenticato
     dalla cifratura, questa conferma che la ricomposizione è completa  */
  function somma(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
  }

  function pezzi(corpo) {
    const n = Math.max(1, Math.ceil(corpo.length / PEZZO));
    return Array.from({ length: n }, (_, i) => corpo.slice(i * PEZZO, (i + 1) * PEZZO));
  }

  /* corpo: la lista già compressa e in base64url; z: 'deflate' o 'nessuna' */
  const nuovoId = () => Date.now().toString(36) + casuale(4);

  /* l'id si può scegliere prima, così una conferma che arriva mentre
     l'ultimo pezzo è ancora in viaggio viene già riconosciuta          */
  async function inviaLista(sess, da, { corpo, z, id = nuovoId() }, avanzamento = () => {}) {
    const s = somma(corpo), p = pezzi(corpo);
    for (let i = 0; i < p.length; i++) {
      await invia(sess, da, { tipo: 'lista', id, s, z, i, n: p.length, x: p[i] });
      avanzamento(i + 1, p.length);
    }
    return { id, n: p.length };
  }

  /* ricompone le liste man mano che arrivano i pezzi, in qualsiasi ordine */
  function raccoglitore() {
    const aperte = new Map();
    return function aggiungi(m) {
      if (!m || m.tipo !== 'lista' || typeof m.x !== 'string' || !(m.n > 0) || !(m.i >= 0 && m.i < m.n)) return null;
      let l = aperte.get(m.id);
      if (!l) aperte.set(m.id, l = { n: m.n, s: m.s, z: m.z, parti: new Array(m.n) });
      if (l.n !== m.n || l.s !== m.s) return null;
      l.parti[m.i] = m.x;
      for (let i = 0; i < l.n; i++) if (l.parti[i] === undefined) return null;
      aperte.delete(m.id);
      const corpo = l.parti.join('');
      if (somma(corpo) !== l.s) throw new Error('lista ricomposta con somma di controllo errata');
      return { id: m.id, corpo, z: l.z };
    };
  }

  /* dal corpo ricevuto all'oggetto lista */
  async function leggiLista({ corpo, z }) {
    let dati = b64u.a(corpo);
    if (z === 'deflate') {
      const ds = new DecompressionStream('deflate-raw');
      const w = ds.writable.getWriter(); w.write(dati); w.close();
      dati = new Uint8Array(await new Response(ds.readable).arrayBuffer());
    } else if (z !== 'nessuna') throw new Error('compressione sconosciuta: ' + z);
    return JSON.parse(new TextDecoder().decode(dati));
  }

  root.Canale = {
    get RELAY() { return RELAY; }, usaRelay: u => { RELAY = u; }, PEZZO, nuovoAbbinamento, daFrammento, frammento, valido, apri,
    cifra, decifra, invia, ascolta, somma, pezzi, nuovoId, inviaLista, raccoglitore, leggiLista,
  };
})(typeof window !== 'undefined' ? window : globalThis);
