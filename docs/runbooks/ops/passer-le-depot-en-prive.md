# Passer le dépôt en privé sans casser le déploiement

**Sévérité** : préventif — rien n'est cassé avant que tu agisses, tout l'est si tu agis dans le
mauvais ordre.
**Temps de résolution** : ~20 min, dont 15 sur le VPS.
**Vérifié** : **jamais rejoué.** Rédigé le 2026-10-03 à partir de l'inspection du dépôt et d'un
test de tirage anonyme des paquets GHCR depuis une machine non authentifiée. **Aucune de ces
étapes n'a été exécutée sur le VPS.** La première personne qui l'exécute met cette ligne à jour.

## Symptômes

Ce n'est pas une panne, c'est une décision : tu veux que le code cesse d'être lisible par tout le
monde. Au 2026-10-03 le dépôt est **public** depuis sa création (24 mai 2026), avec 0 fork et
0 étoile.

⚠️ **Le danger n'est pas le basculement, c'est son ordre.** Le déploiement dépend de deux accès
que le dépôt public offrait gratuitement. Bascule d'abord, et la production ne se déploie plus.

## Diagnostic — de quoi le déploiement dépend-il vraiment ?

`.github/workflows/deploy.yml` fait exactement ceci sur le VPS :

```
git pull --ff-only        ← ① accès en lecture au dépôt
cd infra && ./deploy.sh   ← ② tirage des images depuis ghcr.io
```

Vérifie l'état de chacun **avant** de toucher à la visibilité :

```bash
# ① Le VPS lit-il le dépôt en HTTPS anonyme ? (une URL https:// = oui = cassera)
ssh deploy@<VPS> 'cd /opt/avicare-platform && git remote -v'

# ② Les images sont-elles tirables sans authentification ? (200 = oui = peut casser)
for p in avicare-backend avicare-web avicare-landing; do
  t=$(curl -s "https://ghcr.io/token?scope=repository:abdoumalickcisse3/$p:pull&service=ghcr.io" \
      | python3 -c "import json,sys; print(json.load(sys.stdin).get('token',''))")
  curl -s -o /dev/null -w "$p : %{http_code}\n" -H "Authorization: Bearer $t" \
    -H "Accept: application/vnd.oci.image.index.v1+json" \
    "https://ghcr.io/v2/abdoumalickcisse3/$p/manifests/latest"
done
```

> **Pourquoi « peut » casser et pas « casse »** : la documentation GitHub est ambiguë sur le fait
> qu'un paquet GHCR *lié* à un dépôt suive automatiquement sa visibilité. On ne parie pas là-dessus
> — l'étape ② ci-dessous rend le VPS immunisé dans les deux cas.

Ce qui **ne** casse **pas**, et qu'il est inutile de préparer :

| | Pourquoi |
|---|---|
| La fiche App Store | Aucun lien produit ne pointe vers GitHub (ni politique de confidentialité, ni URL de support) |
| Les builds EAS / TestFlight | Ils partent de la machine du dev, pas du dépôt |
| Dependabot, PR, CI | Fonctionnent en privé — seul le **quota** de minutes change (voir « Après ») |

## Résolution

### ① Accès Git — une clé de déploiement en lecture seule

Sur le VPS, **avec l'utilisateur qui figure dans le secret `SSH_USER`** (`deploy`) :

```bash
ssh-keygen -t ed25519 -C "vps-deploy-avicare" -f ~/.ssh/avicare_deploy -N ""
cat ~/.ssh/avicare_deploy.pub
```

Sur github.com : dépôt → **Settings → Deploy keys → Add deploy key**. Colle la clé, titre
« VPS Contabo », **« Allow write access » DÉCOCHÉ** — le VPS n'a besoin que de lire.

De retour sur le VPS :

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/avicare_deploy
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

ssh -T git@github.com     # → "Hi abdoumalickcisse3/avicare-platform! You've successfully authenticated"

cd /opt/avicare-platform
git remote set-url origin git@github.com:abdoumalickcisse3/avicare-platform.git
git pull --ff-only        # doit réussir
```

### ② Accès GHCR — un jeton de lecture de paquets

Sur github.com : **Settings → Developer settings → Personal access tokens → Tokens (classic)** →
Generate new token → coche **`read:packages` et rien d'autre**. Ni `repo`, ni `write:packages`.

> **Pourquoi un jeton *classic* et non *fine-grained*** : `ghcr.io` a longtemps refusé les jetons
> fine-grained, et un échec d'authentification à cette étape se diagnostique mal. Le périmètre
> reste minimal — lecture de paquets, rien d'autre.

Sur le VPS, **toujours en tant que `deploy`** :

```bash
read -rs PAT && echo "$PAT" | docker login ghcr.io -u abdoumalickcisse3 --password-stdin && unset PAT
docker pull ghcr.io/abdoumalickcisse3/avicare-backend:latest   # doit réussir
```

⚠️ **Pas en `root`, pas avec `sudo`.** Les identifiants atterrissent dans le
`~/.docker/config.json` de l'utilisateur qui lance la commande, et `infra/deploy.sh` appelle
`docker compose` **sans** `sudo` — donc en tant que `deploy`. Un login fait en root serait
invisible au déploiement, et la panne ne se verrait qu'au déploiement suivant.

`read -rs` évite que le jeton reste dans l'historique du shell. Ne le colle pas dans la ligne
`echo`.

### ③ Basculer la visibilité

Seulement maintenant, depuis n'importe quelle machine authentifiée :

```bash
gh repo edit abdoumalickcisse3/avicare-platform --visibility private --accept-visibility-change-consequences
gh repo view --json visibility    # → PRIVATE
```

### ④ Prouver que la chaîne tient

```bash
# sur le VPS
cd /opt/avicare-platform && git pull --ff-only
docker pull ghcr.io/abdoumalickcisse3/avicare-backend:latest
```

Puis déclenche le workflow **deploy** (`workflow_dispatch`) et regarde l'étape
**« Verify public health »** : elle interroge `https://app.jawdi.app/actuator/health` depuis
l'extérieur du VPS. Verte = la chaîne complète tient.

## Si ça a cassé quand même

| Symptôme dans le log de déploiement | Cause | Correctif |
|---|---|---|
| `Repository not found` / `Authentication failed` sur `git pull` | Étape ① oubliée ou clé de déploiement non ajoutée | Rejouer ① ; vérifier `ssh -T git@github.com` |
| `denied` / `unauthorized` sur `docker compose pull` | Étape ② oubliée, **ou faite en root** | Rejouer ② en tant que `deploy` ; `cat ~/.docker/config.json` doit contenir `ghcr.io` |
| `Permission denied (publickey)` sur le SSH du workflow | Tu as écrasé `~/.ssh/config` au lieu d'y ajouter | Vérifier que le bloc `Host github.com` n'a pas cassé l'accès du runner — ce sont deux chemins distincts |

**Retour arrière immédiat** si la production doit redémarrer tout de suite :

```bash
gh repo edit abdoumalickcisse3/avicare-platform --visibility public --accept-visibility-change-consequences
```

Le code redevient lisible par tous, mais le déploiement repart. On répare, puis on rebascule.

## Après

- **Le compteur d'Actions démarre.** Un dépôt public a des GitHub Actions illimitées ; un dépôt
  privé sur compte gratuit est plafonné à **2 000 min/mois**. Les CI consomment ~20 min par
  poussée de PR (backend 10 + web 5 + mobile 3 + parcours API 1,5). Surveille
  `github.com/settings/billing` la première semaine ; si ça serre, le build backend est le premier
  poste à alléger.
- **La protection de branche reste impossible** en privé + gratuit (cf.
  [ADR-002](../../decisions/002-branch-protection-deferred.md)). `main` n'a aujourd'hui aucune
  garde côté serveur — `CLAUDE.md` prétend le contraire, c'est faux depuis le début.
- **Mets à jour la ligne « Vérifié »** en tête de ce fichier avec la date et l'environnement réels.
- **Le code a été public du 24 mai au jour du basculement.** Aucun secret réel n'a été trouvé dans
  l'historique (seulement `test_pwd`, `avicare_dev_pwd` et des références `${VAR}`), mais le
  basculement ne dépublie pas ce qui a pu être copié entre-temps. Si un secret est découvert plus
  tard dans l'historique, le traiter comme compromis — le rendre privé ne le protège pas
  rétroactivement.

## Voir aussi

- `infra/DEPLOY.md` §3 — l'accès GHCR y est déjà documenté pour le cas privé (jamais appliqué).
- [ADR-002](../../decisions/002-branch-protection-deferred.md) — pourquoi `main` n'est pas protégée.
