# Jawdi — VPS deployment runbook

Single-VPS deploy with Docker Compose: **Caddy** (auto-HTTPS) → **web** (Next.js) +
**backend** (Spring Boot) → **postgres** + **redis**. Images are built in GitHub
Actions, pushed to **GHCR**, and pulled on the VPS.

Recommended box: **4 vCPU / 8 GB / 80 GB NVMe** (e.g. Hetzner CX32, Netcup VPS 1000 G12,
or OVH/Scaleway Paris for lowest Senegal latency). Ubuntu 22.04/24.04 LTS.

---

## 0. One-time: build args & routing

- **Three sites, one box.** Caddy routes by hostname:
  - `DOMAIN` + `www.DOMAIN` → **landing** (Astro vitrine).
  - `app.DOMAIN` → **web** (Next.js dashboard) + backend.
  - `partner.DOMAIN` → the **same web container**, partner portal (`/portal`) + backend.
  - `admin.DOMAIN` → the **same web container**, platform back-office (`/console`) + backend.
- The web image bakes `NEXT_PUBLIC_API_URL=""` (empty) → the browser calls
  **same-origin** `/api/*` on `app.DOMAIN` (and on `partner.DOMAIN`), which Caddy routes
  to the backend. No separate API host, and no CORS to configure for the portal.
- The landing bakes its CTA links at build time (`PUBLIC_APP_LOGIN_URL`,
  `PUBLIC_APP_SIGNUP_URL`) → "Se connecter" → `app.DOMAIN/login`, "Commencer
  gratuitement" → `app.DOMAIN/signup`. Override via repo **Variables** if the
  domain differs from the workflow defaults (jawdi.app).
- Backend runs the `prod` Spring profile (feature gating **enforced**, ADR-004).
- **Back-office** (`admin.DOMAIN`): set `ADMIN_FOUNDER_EMAIL` in `infra/.env` to an email that is
  **already signed up**. On every restart that account is promoted to platform staff and granted
  every permission; the app never creates it. Left empty, the console refuses everyone — the safe
  default. The promotion is itself written to `admin_audit_log`.
- **On-call number** (`ADMIN_ONCALL_PHONE` in `infra/.env`): where urgent platform alerts are sent —
  a module cut by the kill switch, a cut lifted or expired, a CRITICAL data-integrity finding.
  Left empty, those alerts are still written to `admin_audit_log` but **reach nobody**; the backend
  says so in a WARN line at startup, and the Pilotage screen shows "astreinte : absente". Requires
  WhatsApp sending to be on (`NOTIF_WHATSAPP_ENABLED` + `KONEKT_API_SECRET`) — the alert takes the
  same rail as everything else.

## 1. Provision the VPS

```bash
# as root on a fresh Ubuntu box
apt-get update && apt-get -y upgrade
curl -fsSL https://get.docker.com | sh          # Docker Engine + compose plugin
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
# add your SSH public key to /home/deploy/.ssh/authorized_keys, then harden sshd
```

Open firewall ports 22, 80, 443 only.

## 2. Get the repo + config on the VPS

```bash
su - deploy
git clone https://github.com/OWNER/avicare-platform.git /opt/avicare-platform
cd /opt/avicare-platform/infra

cp .env.prod.example .env
nano .env          # set DOMAIN (apex), DB_PASSWORD, BACKEND_IMAGE/WEB_IMAGE/LANDING_IMAGE (OWNER lowercase)

# JWT keys (fresh, NOT the dev keys):
cd secrets
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem
chmod 600 jwt_private.pem
cd ..
chmod +x deploy.sh scripts/backup-db.sh
```

## 3. DNS + GHCR access

- Point **five** A/AAAA records to the VPS IP: the apex `DOMAIN`, `www`, `app`, `partner` and
  `admin` (e.g. `jawdi.app`, `www.jawdi.app`, `app.jawdi.app`, `partner.jawdi.app`,
  `admin.jawdi.app`). Caddy issues a cert for each. If using Cloudflare, keep them **DNS-only (grey cloud)** until Caddy
  has issued the first certs, then you may enable the proxy (SSL mode **Full (strict)**).
- If your GHCR packages are **private**, log the VPS into GHCR once:
  ```bash
  echo <GHCR_READ_PAT> | docker login ghcr.io -u <github-user> --password-stdin
  ```
  (Or make the two packages public in GitHub → simpler, no login needed.)

## 4. GitHub secrets (for the deploy workflow)

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SSH_HOST` | VPS IP / hostname |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | private key whose public half is in `authorized_keys` |
| `DEPLOY_DIR` | `/opt/avicare-platform` |

`GITHUB_TOKEN` (auto) pushes to GHCR — no extra secret needed.

## 5. First deploy

Manual, from the VPS:

```bash
cd /opt/avicare-platform/infra
./deploy.sh            # pulls :latest images, runs migrations (Flyway), starts all
docker compose -f docker-compose.prod.yml logs -f backend
curl -fsS https://$DOMAIN/actuator/health     # {"status":"UP"}
```

Then from GitHub: run the **Deploy** workflow (Actions → Deploy → *Run workflow*).
It builds/pushes images tagged with the commit SHA and runs `deploy.sh <sha>` over SSH.
Once trusted, uncomment the `push: branches: [main]` trigger in `.github/workflows/deploy.yml`
for continuous deployment.

## 6. Backups (do this before real users)

Nightly `pg_dump` -> gzip, kept 14 days under `~/avicare-backups` (deploy user), with an
optional offsite copy via rclone. First set up the cron (works local-only immediately):

```bash
crontab -e
# 30 2 * * * /opt/avicare-platform/infra/scripts/backup-db.sh >> /home/deploy/avicare-backup.log 2>&1
```

Then add offsite durability (survives losing the VPS). Configure an rclone remote
(Backblaze B2 / S3 / Contabo Object Storage), then point the script at it:

```bash
rclone config                      # create a remote named e.g. "backup"
echo 'BACKUP_REMOTE=backup:avicare-db' >> /opt/avicare-platform/infra/.env
```

Restore: `./scripts/restore-db.sh ~/avicare-backups/avicare_avicare_<stamp>.sql.gz`.

## 7. Day-2

- Logs: `docker compose -f docker-compose.prod.yml logs -f <svc>`
- Update: push to main (or run the workflow) → images rebuilt, `deploy.sh <sha>` restarts.
- Rollback: `./deploy.sh <previous-sha>` (immutable SHA tags make this safe).
- Scale up: resize the VPS to 16 GB and raise `BACKEND_MEM` in `.env`, or move
  Postgres to a managed instance (OVH/Scaleway) and drop the `postgres` service.

## Notes / limits (V1)

- Single box, no HA. Fine for beta; add managed DB + a second node when paying
  customers arrive.
- `mem_limit` on backend (`BACKEND_MEM`, default 3g) keeps the JVM from starving PG/Redis.
- Observability (Prometheus/OTel from doc 00) is intentionally left out to save RAM;
  add it later as separate compose services.
