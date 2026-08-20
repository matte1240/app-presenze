# Configurazione GitHub per Deploy Produzione

## 1. Secrets da configurare su GitHub

Vai su **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Secrets necessari per PRODUZIONE:

1. **PRODUCTION_SSH_KEY**
   - Chiave SSH privata per accedere al server di produzione
   - Tipo: Chiave privata RSA (contenuto file `~/.ssh/id_rsa` o similare)
   
2. **PRODUCTION_IP**
   - Indirizzo IP del server di produzione
   - Esempio: `10.20.30.40`

3. **PRODUCTION_USER**
   - Username SSH per il server di produzione
   - Esempio: `ubuntu` o `admin`

4. **PRODUCTION_DATABASE_URL**
   - URL di connessione al database PostgreSQL di produzione
   - Formato: `postgresql://username:password@host:5432/database_name?schema=public`

5. **PRODUCTION_NEXTAUTH_SECRET**
   - Secret per NextAuth (deve essere diverso da staging)
   - Generalo con: `openssl rand -base64 32`

6. **PRODUCTION_NEXTAUTH_URL**
   - URL pubblico dell'applicazione in produzione
   - Esempio: `https://production.tuodominio.com` o `https://tuodominio.com`

### Secrets già configurati (riutilizzati da staging):

- **BASTION_SSH_KEY** - Chiave per bastion host
- **BASTION_IP** - IP del bastion host
- **BASTION_USER** - User del bastion host

## 2. Branch Protection Rules (Raccomandato)

Per proteggere il branch `main` da push accidentali:

1. Vai su **Settings** → **Branches** → **Add branch protection rule**
2. Branch name pattern: `main`
3. Attiva:
   - ✅ **Require a pull request before merging**
   - ✅ **Require approvals** (almeno 1)
   - ✅ **Require status checks to pass before merging**
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Do not allow bypassing the above settings**

## 3. Workflow di Deploy

### Per STAGING (branch `dev`):
```bash
git checkout dev
git add .
git commit -m "feat: nuova funzionalità"
git push origin dev
# → Deploy automatico su staging
```

### Per PRODUCTION (branch `main`):
```bash
# 1. Crea Pull Request da dev → main su GitHub
# 2. Fai code review
# 3. Merge della PR
# → Deploy automatico su production

# OPPURE in locale (se hai i permessi):
git checkout main
git merge dev
git push origin main
# → Deploy automatico su production
```

## 4. Deploy Manuale

Puoi anche triggerare un deploy manuale da GitHub:

1. Vai su **Actions** tab
2. Seleziona "Deploy to Production"
3. Click su **Run workflow**
4. Seleziona il branch `main`
5. Click su **Run workflow**

## 5. Struttura directory sul server

Sul server di produzione verrà creata questa struttura:

```
~/production-webapp/         # Directory principale app
  ├── .env                   # File con variabili d'ambiente
  ├── .git/                  # Repository git
  ├── .next/                 # Build Next.js
  ├── node_modules/          # Dependencies
  ├── prisma/                # Schema e migrations
  └── ...
```

## 6. Comandi Docker sul server di produzione

Connettiti al server e usa questi comandi:

```bash
# Stato containers
docker compose ps

# Logs in tempo reale
docker compose logs -f app

# Restart manuale
docker compose restart app

# Stop
docker compose down

# Rebuild e restart
docker compose up -d --build
```

## 7. Checklist pre-deployment

Prima di deployare in produzione:

- [ ] Database PostgreSQL di produzione pronto e accessibile
- [ ] Secrets configurati su GitHub
- [ ] SSH keys configurate correttamente
- [ ] Testato su staging
- [ ] Branch `main` aggiornato con ultime modifiche
- [ ] Backup del database (se necessario)
- [ ] DNS puntato correttamente (se nuovo dominio)

## 8. Rollback in caso di problemi

Se il deploy fallisce o ci sono problemi:

```bash
# Sul server di produzione
cd ~/production-webapp
git log --oneline  # Trova il commit precedente
git reset --hard <commit-hash>
docker compose down
docker compose build
docker compose up -d
```

## 9. Monitoraggio

Dopo il deploy, verifica:

1. **GitHub Actions**: Check che il workflow sia completato con successo
2. **Docker Status**: `docker compose ps` deve mostrare containers `Up`
3. **Logs**: `docker compose logs app --tail 50` per vedere eventuali errori
4. **Health Check**: `docker compose ps` verifica status `healthy` per postgres
5. **URL Pubblico**: Testa l'applicazione all'URL di produzione
6. **Database**: Verifica che le migrations siano applicate correttamente

## 10. Sicurezza

- ✅ Le chiavi SSH non vengono mai committate nel repository
- ✅ I secrets sono criptati da GitHub
- ✅ StrictHostKeyChecking disabilitato solo per CI/CD (non per uso umano)
- ✅ Le variabili d'ambiente vengono passate in modo sicuro via SSH
- ✅ Il file .env locale non viene mai committato (gitignored)
