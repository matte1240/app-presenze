# Staging Docker Deployment Setup

## Overview
Il workflow di deploy staging è stato aggiornato per utilizzare Docker invece di PM2. Questo migliora la consistenza tra gli ambienti di sviluppo, staging e produzione.

## Workflow Steps

### 1. Build and Push (Job 1)
- Builderà l'immagine Docker dell'applicazione
- Pusherà l'immagine su GitHub Container Registry con i tag:
  - `ghcr.io/matte1240/app-presenze:staging` (latest per staging)
  - `ghcr.io/matte1240/app-presenze:staging-{SHA}` (versione specifica)

### 2. Deploy (Job 2)
- Attenderà il completamento del build
- Si collegherà al server staging via SSH (tramite bastion)
- Farà il pull della nuova immagine Docker
- Fermerà i container esistenti
- Avvierà i nuovi container con docker-compose

## Required GitHub Secrets

Assicurati che i seguenti secrets siano configurati nel repository GitHub:

### Esistenti (già configurati)
- `BASTION_SSH_KEY` - Chiave privata SSH per il bastion host
- `BASTION_IP` - IP del bastion host
- `BASTION_USER` - Username per il bastion host
- `STAGING_SSH_KEY` - Chiave privata SSH per il server staging
- `STAGING_IP` - IP del server staging
- `STAGING_USER` - Username per il server staging
- `STAGING_DATABASE_URL` - Connection string PostgreSQL
- `STAGING_NEXTAUTH_SECRET` - Secret per NextAuth
- `STAGING_NEXTAUTH_URL` - URL pubblico dell'app staging
- `EMAIL_HOST` - SMTP host
- `EMAIL_PORT` - SMTP port
- `EMAIL_USER` - Email username
- `EMAIL_PASSWORD` - Email password
- `EMAIL_FROM_NAME` - Nome mittente email

### Nuovo Secret Richiesto
- **`GH_PAT`** - GitHub Personal Access Token con permessi per leggere i packages

## Come Creare il GH_PAT

1. Vai su GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Clicca "Generate new token (classic)"
3. Imposta:
   - **Note**: `Docker Pull for Staging`
   - **Expiration**: 90 days (o come preferisci)
   - **Scopes**: Seleziona solo `read:packages`
4. Genera il token e copialo
5. Vai nelle Settings del repository → Secrets and variables → Actions
6. Clicca "New repository secret"
7. Nome: `GH_PAT`
8. Valore: incolla il token generato

## Server Staging Requirements

Sul server staging devono essere installati:
- Docker
- docker-compose
- Git

### Installazione Docker (se non presente)

```bash
# Installare Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Aggiungere l'utente al gruppo docker (sostituisci 'username' con il tuo user)
sudo usermod -aG docker username

# Installare docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Struttura Directory sul Server

```
$HOME/development-webapp/
├── .git/
├── docker-compose.yml
├── .env (generato dal workflow)
├── backups/
│   └── database/
└── db_data/
    └── pgdata/
```

## Verifica Deployment

Dopo il deploy, puoi verificare lo stato con:

```bash
ssh staging
cd ~/development-webapp
docker-compose ps
docker-compose logs -f app
```

## Rollback

Se necessario, puoi fare rollback a una versione precedente:

```bash
ssh staging
cd ~/development-webapp

# Lista le immagini disponibili
docker images | grep app-presenze

# Pull di una versione specifica (sostituisci SHA)
docker pull ghcr.io/matte1240/app-presenze:staging-<SHA>

# Aggiorna docker-compose.yml per usare quella versione
sed -i 's|staging|staging-<SHA>|g' docker-compose.yml

# Riavvia i container
docker-compose down
docker-compose up -d
```

## Troubleshooting

### Errore: Cannot pull image
- Verifica che `GH_PAT` sia configurato correttamente
- Verifica che il token abbia il permesso `read:packages`
- Verifica che l'immagine esista: `docker pull ghcr.io/matte1240/app-presenze:staging`

### Errore: Container non si avvia
- Controlla i logs: `docker-compose logs app`
- Verifica che le variabili d'ambiente nel `.env` siano corrette
- Verifica che PostgreSQL sia raggiungibile: `docker-compose logs postgres`

### Container in loop di restart
- Probabilmente un errore nell'applicazione
- Controlla i logs: `docker-compose logs -f app`
- Verifica la migrazione del database: i logs mostreranno errori Prisma

## Differenze rispetto al vecchio workflow PM2

| Aspetto | PM2 (vecchio) | Docker (nuovo) |
|---------|---------------|----------------|
| Build | Sul server staging | Su GitHub Actions |
| Dipendenze | npm install sul server | Già nell'immagine |
| Database | Esterno | Container locale (postgres) |
| Prisma | Generate + migrate sul server | Migrate automatico all'avvio |
| Logs | `pm2 logs` | `docker-compose logs` |
| Restart | `pm2 restart` | `docker-compose restart` |
| Ports | 3001 | 3001 (configurabile via .env) |

## Vantaggi del nuovo approccio

1. **Consistenza**: Stesso ambiente in dev, staging e production
2. **Velocità**: Build su GitHub Actions invece che sul server
3. **Isolamento**: Ogni ambiente ha il proprio PostgreSQL containerizzato
4. **Portabilità**: Facile spostare su altri server
5. **Rollback**: Semplice tornare a versioni precedenti
6. **Cache**: Docker layer caching accelera i build successivi
