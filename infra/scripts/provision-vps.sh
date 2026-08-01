#!/usr/bin/env bash
# =====================================================================
# One-shot provisioning for the Jawdi stack on a FRESH Ubuntu 22.04/24.04 VPS.
# Run as ROOT. It:
#   - updates the box and installs Docker Engine + compose plugin, git, ufw
#   - creates the `deploy` user (docker group) with your SSH public key
#   - opens the firewall (22, 80, 443 only)
#   - clones the repo to /opt/avicare-platform
#
# Usage (paste your real public key):
#   SSH_PUBKEY="ssh-ed25519 AAAA... you@mac" bash provision-vps.sh
#
# Private repo? Two options:
#   A) Make the repo public (it holds NO secrets — .env and *.pem are
#      git-ignored). Then this script clones over HTTPS with no auth. Simplest.
#   B) Keep it private: add a read-only Deploy Key to the repo first, then run
#      with REPO_SSH=1 (clones via git@github.com, persistent auth for git pull).
# =====================================================================
set -euo pipefail

: "${SSH_PUBKEY:?Set SSH_PUBKEY to your public key (contents of ~/.ssh/id_ed25519.pub)}"
REPO="${REPO:-abdoumalickcisse3/avicare-platform}"
DEST=/opt/avicare-platform

echo "==> System update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get -y upgrade
apt-get -y install ca-certificates curl git ufw

echo "==> Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> deploy user + SSH key"
id -u deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
printf '%s\n' "$SSH_PUBKEY" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> Firewall (22/80/443 only)"
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

echo "==> Clone the repo to $DEST"
if [ ! -d "$DEST/.git" ]; then
  if [ "${REPO_SSH:-}" = "1" ]; then
    sudo -u deploy git clone "git@github.com:${REPO}.git" "$DEST"
  else
    git clone "https://github.com/${REPO}.git" "$DEST"
  fi
fi
chown -R deploy:deploy "$DEST"

cat <<EOF

✅ Provisioned. Next steps (as the deploy user):
   su - deploy
   cd $DEST/infra
   cp .env.prod.example .env && nano .env      # DOMAIN, DB_PASSWORD, images (OWNER lowercase)
   cd secrets
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
   openssl rsa -pubout -in jwt_private.pem -out jwt_public.pem
   chmod 600 jwt_private.pem && cd ..
   chmod +x deploy.sh scripts/*.sh
   ./deploy.sh                                  # after images are on GHCR + DNS is set
EOF
