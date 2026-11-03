# Protocol Cards — app tecnici

App di **sola lettura** per i tecnici di radiologia (TSRM). Mostra le schede che
il medico ha **mandato ai TSRM** con «Manda a TSRM», dal suo telefono (l'app del
medico, `../prototype/`) o dal PC in verifica; «Imposta» da solo non manda nulla:
protocollo, fasi con ritardi e zone, volume e flusso dal peso e dal mezzo scelti
dal medico (dal PC si definiscono in sala), nota del medico. Si aggiorna da
sola; una scheda ritirata sparisce. Se lo stesso paziente arriva dal telefono e
dal PC vale l'invio più recente. Le schede di oggi vengono prima, poi il
planning dei giorni a venire; le eseguite restano attenuate.

Pubblicata su GitHub Pages:
<https://radios4ndbox-bot.github.io/Protocols_Cards/tecnico/>

## Collegamento

1. Sul telefono del medico: **Impostazioni → App tecnici → Collega i tecnici**.
2. Il tecnico tocca **Scansiona il codice** nell'app dei tecnici e lo inquadra:
   l'abbinamento resta dentro l'app, anche se è stata aggiunta alla schermata
   Home (la fotocamera di sistema aprirebbe invece una scheda del browser). In
   alternativa si può inquadrare con la fotocamera. Lo stesso codice vale per
   tutti i telefoni del reparto («Mostra il codice»); «Nuovo codice», nel menu
   dell'app, scansiona quello di un nuovo abbinamento.

   Lo scanner usa il lettore del browser (BarcodeDetector, Chrome per Android) e,
   dove manca (Safari su iPhone), jsQR da `../desktop/vendor/`, caricato solo
   quando serve. Riconosce il codice che collega il PC al telefono del medico e
   spiega che non è quello giusto.
3. «Nuovo abbinamento» sul telefono del medico scollega i tecnici collegati finora.

Nelle impostazioni del medico compare quali telefoni dei tecnici hanno ricevuto
l'ultima versione.

## Dati

- Il canale è quello di `../desktop/canale.js` (relay ntfy.sh, AES-GCM, chiave
  solo nel codice), con un abbinamento proprio, distinto da quello PC ↔ telefono.
- Viaggiano orario, accettazione, esame, quesito, protocollo, fasi, peso, mezzo e
  nota delle sole schede impostate. **Il nome del paziente non viaggia.**
- Sul telefono del tecnico resta solo l'abbinamento: le schede non vengono
  salvate e alla riapertura arrivano di nuovo dal canale (il relay conserva i
  messaggi 12 ore; se l'ultima pubblicazione è più vecchia, il telefono del
  medico la rimanda appena un tecnico si collega).

Prima dell'uso con dati reali va informato il DPO.
