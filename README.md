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
npm run test:isolation
```

Senza quelle variabili il test si salta invece di fallire, così `npm test`
funziona anche su una macchina senza database.

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
| `npm run test:isolation` | test di isolamento fra organizzazioni (serve un PostgreSQL) |
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

Il backup del database è un lavoro da operatore, non un pulsante
nell'applicazione: `pg_dump` da un cron dell'host, con la ritenzione che
preferisci.

```bash
docker compose exec -T db pg_dump -U presenze presenze | gzip > presenze-$(date +%F).sql.gz
```

Dalla schermata **Manutenzione** un amministratore può invece scaricare i propri
dati in JSON — utenti, orari, cartellini e richieste, senza gli hash delle
password. È l'esportazione che gli serve per portarli altrove, non una copia del
database di tutti.

La versione precedente esponeva un endpoint di ripristino che sostituiva l'intero
database: non esiste più, ed è bene che sia così ora che in quel database vivono
i dati di più aziende.

## Note operative

L'applicazione è senza stato: tutto ciò che dura sta in Postgres. I job
pianificati prendono un *advisory lock* prima di partire, quindi più repliche
non significano più esecuzioni.
