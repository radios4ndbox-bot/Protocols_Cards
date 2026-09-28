# Protocol Cards — tool PC

Importa la lista esami del RIS, permette di verificarla e la invia al
telefono attraverso un canale cifrato. Contiene anche l'editor della **libreria protocolli**:
fasi, zone, mezzo di contrasto, regola della basale e termini che fanno
riconoscere il protocollo dal quesito.

## Costruzione

```
node build.js          # produce protocol-cards-pc.html
node ris-parser.test.js
node protocolli.test.js
```

`protocol-cards-pc.html` è un file unico e autosufficiente: pdf.js, l'encoder
QR (per l'abbinamento), il parser, la libreria protocolli e il canale sono
incorporati. Va copiato su una chiavetta e aperto in Chrome. Importare e
verificare **non richiede rete**, e il PDF non lascia il computer; la rete
serve solo per abbinare il telefono e inviare la lista.

## Invio al telefono via rete

Al passo 3 la lista parte via rete. Il PC del
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
- **Seduta.** Elettiva o pronto soccorso si sceglie importando: al passo 1 ci
  sono due ingressi, «Importa TC elettiva» e «Importa pronto soccorso». La
  seduta viaggia con la lista. Il telefono non sceglie: all'apertura il dorso della carta
  con il marchio StructuRad si gira e mostra direttamente la seduta
  dell'ultima lista ricevuta, con i suoi colori.
- **Giornata d'esame.** È la data della colonna «Orario» dei pazienti, non
  quella di stampa del report; se i pazienti non sono tutti dello stesso giorno
  vale la più frequente, e la verifica lo segnala. Il telefono tiene solo oggi
  e i giorni a venire: scarta le liste di giornate passate (il PC lo mostra) e
  all'avvio toglie le schede dei giorni precedenti.
- **Importazione sul telefono.** Le schede nuove entrano come elettive da fare,
  con 70 kg di peso (il RIS non lo riporta) da correggere in scheda; quelle
  ancora da fare si aggiornano; quelle già lavorate o nel cestino restano
  come sono.

Il relay vede solo testo cifrato. Il tool contatta la rete solo quando si
preme «Abbina» o «Invia»: aprirlo e lavorare resta un'operazione senza rete.
Il canale è in `canale.js`, condiviso con l'app del telefono.

## Intro

All'apertura parte la stessa coreografia di ER Oncology Archivist, con le carte
al posto del marchio e lo sfondo del tool: le quattro fasi (basale, arteriosa,
venosa, tardiva) compaiono raccolte al centro in dissolvenza, poi si aprono a
ventaglio scivolando a sinistra mentre «Protocol Cards» compare lettera per
lettera con i tempi di Archivist; entra «a StructuRad product»; poi le carte si raccolgono in
una, che si gira e mostra sul dorso il marchio StructuRad, e vola nel marchio
della barra portandosi su la pagina. Nella barra resta la copia del dorso, su
cui la carta atterra al pixel (lo verifica `intro.test.js`). Dura circa
poco più di quattro secondi;
si salta con un clic, Esc, Invio o Spazio. Con «riduci movimento» attivo nel
sistema non parte.

- `intro/fase-*.jpg`: una TC dell'addome per fase, ritagliate dalla figura
  fornita e incorporate da `build.js` come data URI. Prima di distribuire il
  tool va verificato che la licenza della figura ne consenta l'uso; per
  sostituirle basta rimpiazzare i quattro file (360×311 px).
- Il nome è in Sora 300 (SIL Open Font License), convertito in tracciati:
  un `<path>` per lettera, nessun font da caricare.
- `intro.test.js` controlla sequenza, salto e «riduci movimento»; gli altri
  test aprono il tool con «riduci movimento», così l'intro non li copre.

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
validazione. È condiviso con il telefono, che lo carica da `../desktop/`:
stessa libreria, stesso riconoscimento, così il PC mostra esattamente cosa
suggerirà il telefono.

I quesiti reali sono scritti per sigle. Prima del confronto ogni sigla diventa
il termine per esteso: *npl, neopl, k, carcinoma* → neoplasia; *sec, mts, M+* →
metastasi; *rival* → rivalutazione; *RCC* → neoplasia renale; *PNX* →
pneumotorace; *AAA* → aneurisma aorta addominale; *noduli* → nodulo. La regola
vale anche per i termini scritti nella libreria. Un termine può chiedere più
parole insieme: `followup + neoplasia` vale solo se ci sono entrambe, in
qualunque punto del quesito. Con più esami, la regione è l'unione dei distretti
del tronco (torace + addome completo → torace-addome completo).

La libreria di partenza ha una **revisione**. Se la libreria ufficiale salvata
sul PC è identica a una revisione precedente, si aggiorna da sola all'apertura.
Se il reparto l'ha modificata resta com'è, e la nuova revisione si adotta con
«Ripristina».

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
