/* ═══════════════════════════════════════════════════════════════════════
   PROTOCOL CARDS · canale cifrato via relay (test di collegamento)

   PC e telefono non si vedono in rete: il PC è nella rete ospedaliera,
   il telefono su quella mobile. Entrambi si collegano IN USCITA a un
   relay pubblico (ntfy.sh) e si scambiano messaggi su un argomento
   segreto. Il relay vede solo testo cifrato.

   La chiave AES-GCM a 256 bit nasce sul PC e viaggia solo nel QR, nel
   frammento dell'indirizzo (#…): il frammento non viene mai inviato a
   nessun server, né al relay né a chi ospita la pagina del telefono.

   Busta: { v, da, id, iv, ct }. Il mittente è anche dato autenticato,
   così un messaggio del PC non può essere rispedito al PC facendolo
   passare per il telefono.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const RELAY = 'https://ntfy.sh';

  const b64u = {
    da: bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
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

  async function nuovaSessione() {
    const chiave = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const grezza = await crypto.subtle.exportKey('raw', chiave);
    return { argomento: 'pcsync-' + casuale(22), chiave, k: b64u.da(grezza) };
  }

  async function daFrammento(hash) {
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    const argomento = q.get('t'), k = q.get('k');
    if (!argomento || !/^pcsync-[a-z0-9]{22}$/.test(argomento) || !k) throw new Error('codice di abbinamento incompleto');
    const chiave = await crypto.subtle.importKey('raw', b64u.a(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { argomento, chiave, k };
  }

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
    return { da: b.da, msg: JSON.parse(new TextDecoder().decode(chiaro)), byte: testo.length };
  }

  async function invia(sess, da, oggetto) {
    const corpo = await cifra(sess, da, oggetto);
    const t0 = performance.now();
    const r = await fetch(`${RELAY}/${sess.argomento}`, { method: 'POST', body: corpo, cache: 'no-store' });
    if (!r.ok) throw new Error('relay: HTTP ' + r.status);
    return { byte: corpo.length, ms: Math.round(performance.now() - t0) };
  }

  /* ascolto con EventSource: si riconnette da solo se la rete cade. Alla
     riconnessione il relay può ripetere messaggi già consegnati: li si
     scarta per identificativo. I messaggi propri (stesso mittente) e
     quelli che non si decifrano con la chiave della sessione si ignorano. */
  function ascolta(sess, io, { messaggio, stato }) {
    const visti = new Set();
    const es = new EventSource(`${RELAY}/${sess.argomento}/sse?since=all`);
    es.onopen = () => stato('aperto');
    es.onerror = () => stato(es.readyState === EventSource.CLOSED ? 'chiuso' : 'riconnessione');
    es.onmessage = async ev => {
      let e; try { e = JSON.parse(ev.data); } catch (_) { return; }
      if (e.event !== 'message' || visti.has(e.id)) return;
      visti.add(e.id);
      try {
        const m = await decifra(sess, e.message);
        if (m.da !== io) messaggio(m);
      } catch (_) { stato('scartato'); }
    };
    return () => es.close();
  }

  async function relayRaggiungibile() {
    const t0 = performance.now();
    const r = await fetch(`${RELAY}/v1/health`, { cache: 'no-store' });
    const j = await r.json();
    if (!j.healthy) throw new Error('relay non operativo');
    return Math.round(performance.now() - t0);
  }

  root.Canale = { RELAY, nuovaSessione, daFrammento, invia, ascolta, relayRaggiungibile, cifra, decifra };
})(this);
