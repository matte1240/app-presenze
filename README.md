# Presenze

Gestionale di presenze e cartellini, multi-azienda. Il dipendente registra le
ore giorno per giorno, l'amministratore approva ferie e permessi ed esporta il
riepilogo mensile per le paghe.

Una sola istanza serve tutte le organizzazioni clienti: ognuna ha i propri
utenti, il proprio calendario di festività, il proprio fuso e il proprio
abbonamento. Un solo processo Node serve sia l'API sia l'interfaccia, su un
database PostgreSQL. Non serve altro.

## Avvio rapido

```bash
docker compose up --build
```

Apri <http://localhost:3000> e crea la tua organizzazione: parte una prova
gratuita di quattordici giorni. Da lì si creano i dipendenti e si assegna a
ciascuno l'orario settimanale.

Con `SIGNUP_ENABLED=false` la pagina di registrazione sparisce e le
organizzazioni le crei solo tu dal back-office.

### Sviluppo

```bash
npm install
docker compose up -d db   # basta il database
npm run db:seed           # facoltativo: due aziende di prova, con utenti e ore
npm run dev               # API su :3000, interfaccia su :5173
```

Il seed stampa le credenziali che crea. Crea **due** organizzazioni di
proposito: chi sviluppa con un solo cliente nel database finisce prima o poi per
scrivere una query che dà per scontato che ce ne sia uno solo.

## Isolamento fra organizzazioni

Ogni riga di ogni tabella porta la propria `organization_id`, e la separazione è
tenuta su due livelli indipendenti.

**Nel codice.** Ogni query filtra esplicitamente. Il tenant non viaggia però di
parametro in parametro: `loadSession` lo stabilisce una volta per richiesta e
tutto ciò che sta sotto lo legge dal contesto (`src/server/db/context.ts`).
Chiedere il tenant fuori da una richiesta è un errore rumoroso, non un risultato
vuoto.

**Nel database.** PostgreSQL applica una *row-level security policy* su `users`,
`work_schedules`, `time_entries` e `leave_requests`, confrontando ogni riga con
`app.current_org_id`, impostata sulla transazione della richiesta. È la rete che
regge se un `WHERE` viene dimenticato in un refactoring: il database non
restituisce la riga comunque sia scritta la query.

Perché quella rete esista davvero servono **due ruoli**: l'applicazione entra con
un ruolo che non possiede le tabelle ed è quindi soggetto alle policy, mentre il
proprietario — che PostgreSQL esenta — serve solo alle migrazioni e ai tre casi
che devono per forza attraversare le aziende: risolvere un'email al login, il
back-office e il job notturno. In produzione `DATABASE_ADMIN_URL` è
obbligatoria: senza, l'applicazione girerebbe come proprietaria e si rifiuta di
partire.

Il test che difende tutto questo è `src/server/tenant-isolation.test.ts`. Gira
contro un PostgreSQL vero e va eseguito prima di ogni rilascio:

```bash
TEST_DATABASE_URL=postgres://presenze_app:...@localhost:5432/presenze_test \
TEST_DATABASE_ADMIN_URL=postgres://presenze:...@localhost:5432/presenze_test \
npm run test:db
```

Senza quelle variabili i test si saltano invece di fallire, così `npm test`
funziona anche su una macchina senza database.

Il backup e il ripristino hanno una suite a parte, `npm run test:backup`, e
**vogliono un database tutto loro** — mai lo stesso di `test:db` o di
qualunque altra cosa in esecuzione insieme. Fa un `pg_restore --clean` vero, che
sostituisce ogni tabella: condividere il database con un test in corso altrove
significherebbe che l'ultimo a finire decide cosa resta. Serve anche
`pg_dump`/`pg_restore` sul PATH; senza, la suite si salta con un avviso invece
di fallire.

```bash
TEST_DATABASE_URL=postgres://presenze_app:...@localhost:5432/presenze_backup \
TEST_DATABASE_ADMIN_URL=postgres://presenze:...@localhost:5432/presenze_backup \
npm run test:backup
```

## Utenti che se ne vanno

Il pulsante non è «Elimina» ma «Disattiva»: l'account smette di funzionare, il
posto del piano si libera e la persona sparisce dai promemoria, ma il suo
cartellino resta e continua a comparire nei report. Per un gestionale che
alimenta le paghe è l'unico comportamento accettabile, e in Italia i registri
del personale vanno conservati per anni.

L'eliminazione definitiva esiste ancora, ma solo su un utente già disattivato, e
la conferma dice quante giornate e quante richieste sta per distruggere.

## Migrare un cliente esistente

L'installazione mono-azienda su SQLite si porta dentro con uno script:

```bash
DATABASE_ADMIN_URL=postgres://... \
node scripts/import-sqlite.mjs ./data/app.db "Nome Azienda" --plan PRO --status ACTIVE
```

Utenti, orari, cartellini e richieste arrivano con gli stessi identificativi e
con gli stessi hash delle password: chi c'era ritrova il proprio account com'era,
senza doversi reimpostare nulla. Sessioni e token di reimpostazione restano
indietro di proposito — sono credenziali con una scadenza, e trascinarle
attraverso un cambio di modello di autenticazione non ha senso.

Lo script rifiuta di importare due volte la stessa origine, e va eseguito una
sola volta per cliente.

## Back-office

Su `/piattaforma` c'è una superficie separata per gestire le organizzazioni
clienti: elenco con piano, stato e persone, creazione assistita di una nuova
azienda (l'amministratore riceve un invito, nessuna password viene impostata),
cambio di piano, sospensione, esportazione dei dati, accesso di supporto dentro
l'account, e il backup dell'intero database — vedi [Backup](#backup) più
sotto.

Non è un ruolo in più dentro l'applicazione: ha una tabella propria, un cookie
proprio e un login proprio. Se «può amministrare la piattaforma» fosse un valore
nella colonna `role` dei clienti, ogni percorso che scrive quella colonna
diventerebbe una possibile via d'uscita da un account e d'ingresso in tutti.

Il primo accesso si crea al boot con `PLATFORM_ADMIN_EMAIL` e
`PLATFORM_ADMIN_PASSWORD`, e solo finché non ne esiste nessuno.

Quando qualcuno entra in un'organizzazione dal back-office, la sessione resta
marcata: il cliente vede un banner fisso in cima a ogni schermata, e
l'operazione finisce nel registro. Chi lavora dentro l'account di qualcun altro
deve farlo alla luce del sole.

## Abbonamenti

I piani stanno nel codice (`src/core/plans.ts`), non in una tabella: un prezzo e
un limite di persone sono promesse commerciali, e cambiarle deve passare da una
revisione, non da una riga modificata di notte. Stripe possiede il denaro —
carte, fatture, solleciti, portale — e noi possediamo una colonna,
`organizations.status`, che decide cosa l'applicazione permette. A scriverla
sono solo i webhook.

Un abbonamento non attivo rende l'organizzazione **in sola lettura**: si
consulta e si esporta tutto, non si registra nulla di nuovo. Non si cancella
niente e non si chiude fuori nessuno. Chi smette di pagare deve poter rientrare,
o portarsi via i propri dati.

Il limite di persone del piano si applica quando si aggiunge un utente, mai
all'accesso: nessuno deve trovarsi chiuso fuori da un account che aveva già
perché il piano è cambiato. Un utente disattivato non occupa un posto.

**Fatturazione italiana.** Nella pagina Abbonamento si compila l'anagrafica:
ragione sociale, indirizzo, partita IVA, codice fiscale e — quello che serve
davvero perché la fattura arrivi — il codice destinatario SDI oppure la PEC.
Partita IVA e codice fiscale sono verificati con il loro carattere di controllo
(`src/core/fiscal.ts`), non solo per lunghezza: una cifra trasposta diventa
altrimenti una fattura scartata settimane dopo. Per un cliente italiano
l'anagrafica non si salva senza SDI o PEC.

I dati vengono sincronizzati su Stripe — indirizzo, partita IVA come `eu_vat`
con il prefisso del paese, SDI e PEC nei metadata — ma restano nostri anche se
Stripe non è configurato o non risponde.

## Come funziona

**L'orario contrattuale** è definito per utente e per giorno della settimana:
turno mattina, turno pomeriggio e, per i part-time, un monte ore che può
divergere dalla durata dei turni. Anche la domenica è configurabile.

**Il motore delle ore** (`src/core/timesheet.ts`) prende ciò che il dipendente
ha dichiarato e decide come si classifica:

- oltre l'orario contrattuale ⇒ straordinario;
- sotto l'orario contrattuale ⇒ la differenza diventa permesso, eventualmente
  imputato al permesso 104;
- giorno festivo o non lavorativo ⇒ tutto straordinario, e un'assenza in quel
  giorno non consuma nulla;
- un permesso orario approvato viene sottratto dalle ore effettivamente svolte.

Il calcolo avviene **sul server**. Il browser lo esegue anche in locale, ma solo
per mostrare l'anteprima mentre si compila: ciò che viene salvato è sempre il
risultato del server.

**Le festività italiane** sono calcolate, non configurate. Le patronali locali
appartengono alla singola organizzazione, così due clienti in due province non
condividono il santo patrono.

**Le richieste di assenza** approvate generano automaticamente le giornate nel
cartellino, saltando festivi e giorni non lavorativi secondo l'orario di quella
persona. Approvare due volte non produce duplicati, e una giornata su cui
risultano già ore registrate viene segnalata invece che sovrascritta.

## Struttura

```
src/core/      dominio puro: date, orari, festività, motore ore, regole
src/server/    API Hono, schema Drizzle, servizi (email, esportazioni, Excel)
src/web/       SPA React
  ui/          token e primitivi grafici
  features/    schermate
```

Il confine fra `ui/` e il resto è imposto da una regola ESLint: `ui/` non può
importare né le funzionalità né il dominio né il client API. Rifare la grafica
significa quindi toccare `ui/tokens.css` e `ui/primitives/`, non la logica.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | API e interfaccia in sviluppo |
| `npm test` | test del dominio |
| `npm run test:db` | test di isolamento e fatturazione (serve un PostgreSQL) |
| `npm run test:backup` | test di backup e ripristino (un PostgreSQL **dedicato**, e `pg_dump`/`pg_restore` sul PATH) |
| `npm run test:e2e` | percorsi in un browser vero (serve un PostgreSQL dedicato) |
| `npm run typecheck` | TypeScript su tutto il progetto |
| `npm run lint` | ESLint, incluse le regole di confine fra i layer |
| `npm run build` | bundle di interfaccia e server in `dist/` |
| `npm start` | avvia il bundle di produzione |
| `npm run db:generate` | genera una migrazione dopo aver modificato lo schema |
| `npm run db:seed` | popola un database di sviluppo |

## Configurazione

Le variabili sono documentate in [`.env.example`](.env.example). L'unica
obbligatoria è la connessione al database: sotto Docker basta impostare
`POSTGRES_PASSWORD`, altrove va indicata `DATABASE_URL` per intero.

Senza SMTP l'applicazione funziona ma non invia email: i link di reimpostazione
password, le notifiche di assenza e i promemoria vengono registrati nel log
invece che spediti.

## Backup

Due livelli, per due scopi diversi.

**Dalla schermata Manutenzione** di ogni organizzazione, un amministratore
scarica i propri dati in JSON — utenti, orari, cartellini e richieste, senza gli
hash delle password. È l'esportazione che gli serve per portarli altrove, non
una copia del database di tutti.

**Dal back-office** (`/piattaforma` → *Backup*), un amministratore di
piattaforma gestisce il backup dell'**intero** database — ogni organizzazione
insieme — su uno storage S3-compatibile. Hetzner Object Storage è il target
pensato di base, ma qualunque endpoint S3 (MinIO, AWS S3 stesso) funziona
allo stesso modo: vedi le variabili `S3_*` e `BACKUP_*` in
[`.env.example`](.env.example).

Da lì si può:

- creare un backup a richiesta, oltre a quello notturno pianificato
  (`BACKUP_CRON`);
- scaricarlo — un link firmato porta dritti al bucket, il file non passa mai dal
  server applicativo;
- **ripristinarlo**, sostituendo il database in blocco con quello del backup
  scelto. È l'unica operazione davvero distruttiva di tutta l'applicazione:
  richiede di scrivere per esteso il nome del file da ripristinare, prende
  automaticamente una copia di sicurezza dello stato attuale prima di
  procedere, ed è pensata per una finestra di manutenzione — l'applicazione
  resta comunque raggiungibile durante il ripristino, ma qualche richiesta in
  quel momento può fallire, com'è inevitabile quando le tabelle vengono
  sostituite una per una sotto un processo che le sta ancora usando;
- eliminare un backup, o applicare subito la politica di conservazione invece
  di aspettare il prossimo giro notturno.

Tecnicamente sono `pg_dump`/`pg_restore` veri, non una reimplementazione: il
container li include già, alla stessa versione maggiore del servizio
PostgreSQL in `docker-compose.yml`, perché `pg_dump` non è pensato per leggere
da un server più recente di se stesso.

## Note operative

L'applicazione è senza stato: tutto ciò che dura sta in Postgres. I job
pianificati prendono un *advisory lock* prima di partire, quindi più repliche
non significano più esecuzioni.
