# Protocol Cards — tool PC

Importa la lista esami del RIS, permette di verificarla e la trasferisce sul
telefono con un codice QR. Contiene anche l'editor della **libreria protocolli**:
fasi, zone, mezzo di contrasto, regola della basale e termini che fanno
riconoscere il protocollo dal quesito.

## Costruzione

```
node build.js          # produce protocol-cards-pc.html
node ris-parser.test.js
node protocolli.test.js
```

`protocol-cards-pc.html` è un file unico e autosufficiente: pdf.js, l'encoder
QR, il parser e la libreria protocolli sono incorporati. Va copiato su una chiavetta e aperto in
Chrome. **Non serve rete**, e il PDF non lascia il computer.

## Invio al telefono via rete

Oltre ai codici QR, al passo 3 la lista può partire via rete. Il PC del
reparto e il telefono non si raggiungono direttamente: entrambi si collegano
in uscita al relay pubblico [ntfy.sh](https://ntfy.sh), come verificato in
reparto con `sync-test/`.

- **Abbinamento, una volta sola.** «Abbina un telefono» genera argomento del
  relay e chiave AES-GCM a 256 bit e li mostra in un QR che apre l'app del
  telefono. La chiave sta solo nel frammento dell'indirizzo (`#…`), che non
  arriva a nessun server; il telefono la toglie subito dalla barra degli
  indirizzi. Il PC salva l'abbinamento solo quando il telefono conferma.
- **Invio.** «Invia la lista al telefono» manda la lista compressa e cifrata,
  a pezzi sotto i 4 KB (oltre, ntfy.sh la trasformerebbe in allegato). Il
  telefono la ricompone, la importa nel calendario e manda la ricevuta.
  Se l'app è chiusa la riceve all'apertura: il relay conserva i messaggi 12 ore.
- **Importazione sul telefono.** Le schede nuove entrano come elettive da fare,
  con 70 kg di peso (il RIS non lo riporta) da correggere in scheda; quelle
  ancora da fare si aggiornano; quelle già lavorate o nel cestino restano
  come sono.

Il relay vede solo testo cifrato. Il tool contatta la rete solo quando si
preme «Abbina» o «Invia»: aprirlo e lavorare resta un'operazione senza rete.
Il canale è in `canale.js`, condiviso con l'app del telefono.

## Librerie incorporate

| | versione | licenza |
|---|---|---|
| pdf.js (`pdfjs-dist`) | 3.11.174, build legacy | Apache-2.0 |
| qrcode-generator | 2.0.4 | MIT |

I testi delle licenze sono in `vendor/`. Per rigenerare le copie:

```
npm pack pdfjs-dist@3.11.174
tar xzf pdfjs-dist-3.11.174.tgz package/legacy/build/pdf.min.js \
        package/legacy/build/pdf.worker.min.js package/LICENSE
npm pack qrcode-generator
```

## Libreria protocolli

`protocolli.js` contiene la libreria di partenza (estratto SIRM 2022), il
riconoscimento dal quesito, la deduzione della regione dall'esame e la
validazione. È scritto per essere condiviso con il telefono: stesso schema,
stesso riconoscimento, così il PC mostra esattamente cosa suggerirà il reparto.

La libreria modificata resta nel browser del PC (localStorage): non contiene
dati personali. La **firma** di 7 caratteri identifica la versione e cambia a
ogni modifica; si può esportare e reimportare come JSON.

## Due opzioni per paziente

All'import ogni paziente riceve, dal riconoscimento del quesito, un'opzione
**ufficiale** e una **personale** (voce appresa per quel caso o protocollo
personale riconosciuto dai termini). Si propone la personale quando c'è;
in verifica si passa dall'una all'altra con un clic, e il telefono le riceverà
entrambe per poter cambiare idea anche in reparto.

## Protocol builder

Insegna al tool un protocollo personale partendo da richieste d'esempio: ne
ricava i termini del quesito e la regione dell'esame, mostra se gli esempi
verrebbero riconosciuti e quanti pazienti della lista caricata passerebbero
al nuovo protocollo. Gli esempi non vengono salvati.

## Colori delle fasi

| fase | colore |
|---|---|
| basale | grigio |
| arteriosa | rosso |
| venosa | blu |
| tardiva | verde acqua |
| urografica | giallo |
| tardiva per surrene | bordeaux |

## Dati dei pazienti

Le liste RIS reali **non vanno nel repository**: `.gitignore` blocca i PDF.
Il test usa una fixture sintetica che riproduce il layout con dati inventati.

## Test

```
node ris-parser.test.js                          # fixture sintetica, nessun dato reale
node protocolli.test.js                          # riconoscimento identico al prototipo
RIS_PDF_DIR=/percorso node end-to-end.test.js    # richiede una lista RIS chiamata lista.pdf
node sincronizzazione.test.js                    # PC → telefono con un relay finto locale
```

Il test end-to-end apre il file costruito da `file://` e verifica anche che
non parta **nessuna richiesta di rete**.
