# Test di collegamento PC ↔ telefono

Verifica, prima di costruire la sincronizzazione, che un PC nella rete
ospedaliera (cablata) e un telefono in rete mobile riescano a parlarsi.

Non si vedono direttamente: entrambi si collegano **in uscita** a un relay
pubblico ([ntfy.sh](https://ntfy.sh)) e si scambiano messaggi su un canale
segreto. I messaggi sono cifrati con AES-GCM a 256 bit; la chiave nasce sul PC
e passa al telefono **solo nel QR**, nel frammento `#…` dell'indirizzo, che non
viene mai inviato ad alcun server. Il relay vede solo testo cifrato.

## Come si usa

1. Sul PC del reparto apri
   <https://radios4ndbox-bot.github.io/Protocols_Cards/sync-test/pc.html>
2. Inquadra il QR con la fotocamera del telefono, in rete mobile.
3. Sul PC tutti i controlli devono diventare verdi; poi «Invia una card di
   prova» deve farla comparire sul telefono.

Se si ferma a **Relay raggiungibile dal PC**, il proxy o il firewall
dell'ospedale blocca `ntfy.sh`: serve il via libera dell'IT per le connessioni
HTTPS in uscita verso il relay, oppure un relay su un dominio già consentito.

## File

| | |
|---|---|
| `cifra.js` | canale cifrato: chiave, busta, invio e ascolto sul relay |
| `pc.html` | lato PC: controlli, QR di abbinamento, card di prova |
| `telefono.html` | lato telefono: legge la chiave dal QR e risponde |

Passano solo messaggi di prova, nessun dato paziente. Sul relay pubblico i
messaggi scadono dopo 12 ore; per l'uso reale conviene un relay dedicato.
