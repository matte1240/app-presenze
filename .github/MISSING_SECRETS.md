# Secrets GitHub Mancanti per Staging

## ⚠️ Variabile da Configurare

Per far funzionare il workflow di deploy staging, devi aggiungere questo secret su GitHub:

### GH_PAT (GitHub Personal Access Token)
**Nome**: `GH_PAT`  
**Descrizione**: GitHub Personal Access Token per pull delle immagini Docker da GitHub Container Registry

**Come crearlo**:
1. Vai su https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Nome: `Docker Pull Token`
4. Scopes: Seleziona solo **`read:packages`**
5. Expiration: 90 giorni (o "No expiration" se preferisci)
6. Click "Generate token"
7. **Copia il token** (lo vedrai solo una volta!)
8. Vai su https://github.com/matte1240/app-presenze/settings/secrets/actions
9. Click "New repository secret"
10. Nome: `GH_PAT`
11. Secret: incolla il token copiato
12. Click "Add secret"

**⚠️ Importante**: Questo token serve per permettere al server staging di fare il pull delle immagini Docker da GitHub Container Registry (ghcr.io).

---

## ✅ Secrets Già Configurati

Questi secrets sono già presenti e configurati correttamente:

- [x] `STAGING_DATABASE_URL` - Connection string PostgreSQL staging
- [x] `STAGING_IP` - IP del server staging
- [x] `STAGING_NEXTAUTH_SECRET` - Secret NextAuth per staging
- [x] `STAGING_NEXTAUTH_URL` - URL pubblico app staging
- [x] `STAGING_SSH_KEY` - Chiave SSH per accesso staging
- [x] `STAGING_USER` - Username SSH per staging
- [x] `BASTION_IP`, `BASTION_USER`, `BASTION_SSH_KEY` - Configurazione bastion host
- [x] `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM_NAME` - Email SMTP

---

## 🚀 Dopo aver aggiunto GH_PAT

1. Fai merge di `docker-test` in `dev` oppure push direttamente su `dev`
2. Il workflow "Deploy to Staging" partirà automaticamente
3. Controlla i log su: https://github.com/matte1240/app-presenze/actions
4. Verifica l'app su: il tuo `STAGING_NEXTAUTH_URL`
