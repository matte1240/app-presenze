# Presenze

Gestionale di presenze e cartellini per una singola azienda. Il dipendente
registra le ore giorno per giorno, l'amministratore approva ferie e permessi ed
esporta il riepilogo mensile per le paghe.

Un solo processo Node serve sia l'API sia l'interfaccia, su un database SQLite
incorporato. Non serve altro.

## Avvio rapido

```bash
docker compose up --build
```

Apri <http://localhost:3000>: al primo accesso l'applicazione chiede di creare
l'account amministratore. Da lì si creano i dipendenti e si assegna a ciascuno
l'orario settimanale.

### Sviluppo

```bash
npm install
npm run db:seed   # facoltativo: due utenti di prova e due settimane di ore
npm run dev       # API su :3000, interfaccia su :5173
```

Il seed stampa le credenziali che crea.

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

**Le festività italiane** sono calcolate, non configurate. Le patronali locali si
aggiungono con `HOLIDAY_PATRON_DAYS`.

**Le richieste di assenza** approvate generano automaticamente le giornate nel
cartellino, saltando festivi e giorni non lavorativi secondo l'orario di quella
persona. Approvare due volte non produce duplicati, e una giornata su cui
risultano già ore registrate viene segnalata invece che sovrascritta.

## Struttura

```
src/core/      dominio puro: date, orari, festività, motore ore, regole
src/server/    API Hono, schema Drizzle, servizi (email, backup, Excel)
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
| `npm run typecheck` | TypeScript su tutto il progetto |
| `npm run lint` | ESLint, incluse le regole di confine fra i layer |
| `npm run build` | bundle di interfaccia e server in `dist/` |
| `npm start` | avvia il bundle di produzione |
| `npm run db:generate` | genera una migrazione dopo aver modificato lo schema |
| `npm run db:seed` | popola un database di sviluppo |

## Configurazione

Tutte le variabili sono facoltative e documentate in
[`.env.example`](.env.example). Senza SMTP l'applicazione funziona ma non invia
email: i link di reimpostazione password, le notifiche di assenza e i promemoria
vengono registrati nel log invece che spediti.

## Backup

Un backup notturno viene creato con `VACUUM INTO`, che produce una copia
consistente senza fermare l'applicazione. Dalla schermata **Manutenzione** un
amministratore può crearne uno a richiesta, scaricarlo o ripristinarne uno.

Il ripristino verifica il file caricato, mette da parte una copia del database
attuale e poi riapre la connessione senza riavviare il processo.

## Note operative

Il database è un file SQLite e i job pianificati girano nel processo: va
eseguita **una sola istanza**. Per lo stesso motivo non c'è nulla da scalare
orizzontalmente — se un domani servisse, andrebbero sostituiti sia il database
sia lo scheduler.
