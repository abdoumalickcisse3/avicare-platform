# Aucune sauvegarde récente

**Sévérité** : HIGH — rien n'est cassé aujourd'hui, tout est perdu demain.
**Temps de résolution** : < 15 min.
**Vérifié** : 2026-08-31, en local — dump produit et vérifié (96 Ko, 72 tables).

## Symptômes

- Console → **Pilotage** indique une sauvegarde vieille de plus de 24 h, ou aucune.
- Ou tu regardes après un incident et tu découvres qu'il n'y a rien à restaurer.

⚠️ **Ce symptôme est silencieux.** Rien ne tombe en panne quand les sauvegardes s'arrêtent. C'est
pour ça qu'il faut regarder Pilotage régulièrement, et pas seulement quand ça va mal.

## Diagnostic

Sur le VPS, dans l'ordre du moins coûteux au plus coûteux :

```bash
# 1. Y a-t-il des fichiers ?
ls -lh ~/avicare-backups/ | tail -5

# 2. Le cron est-il installé ?
crontab -l | grep backup-db

# 3. Qu'a dit la dernière exécution ?
tail -30 ~/avicare-backup.log

# 4. Le script tourne-t-il à la main ?
/opt/avicare-platform/infra/scripts/backup-db.sh
```

Causes fréquentes, par ordre de probabilité :

| Cause | Signe |
|---|---|
| Cron jamais installé | `crontab -l` vide — le plus fréquent après un reprovisionnement |
| Disque plein | `No space left` dans le log ; `df -h` |
| Conteneur postgres arrêté | Le script échoue sur `docker compose exec` |
| `.env` manquant ou illisible | `ERROR: missing infra/.env` |
| `rclone` absent ou mal configuré | Le dump **local** existe, seul l'envoi distant manque |

## Résolution

### Cas nominal — relancer et réinstaller le cron

```bash
/opt/avicare-platform/infra/scripts/backup-db.sh     # immédiat
crontab -e
# 30 2 * * * /opt/avicare-platform/infra/scripts/backup-db.sh >> /home/deploy/avicare-backup.log 2>&1
```

Sortie attendue (mesurée en local) :

```
Local dump: .../avicare_avicare_2026-08-31_130842.sql.gz ( 96K)
```

### Vérifier que le dump vaut quelque chose

Un fichier n'est pas une sauvegarde. Un fichier **restaurable** est une sauvegarde :

```bash
gunzip -c <dump> | grep -c "^CREATE TABLE"   # doit être ~72 (schéma V51)
gunzip -c <dump> | head -3                    # doit commencer par « PostgreSQL database dump »
```

Un dump de quelques centaines d'octets est un **échec silencieux** : le script a écrit le message
d'erreur de `pg_dump` dans le fichier gzippé.

### Copie hors site absente

Le dump local ne protège pas de la perte du VPS. Voir `infra/DEPLOY.md` §6 (`rclone` + `BACKUP_REMOTE`).

## Après

- **Restaure une sauvegarde une fois par trimestre** dans un conteneur jetable, jamais en production
  — voir [restaurer une sauvegarde](restaurer-une-sauvegarde.md). Une sauvegarde jamais restaurée est
  une hypothèse, pas une garantie.
- Si le cron a sauté après un reprovisionnement, ajoute l'étape à `DEPLOY.md`.

## Références

- Script : `infra/scripts/backup-db.sh` · Procédure : `infra/DEPLOY.md` §6
- Affichage : Console → Pilotage (fraîcheur des sauvegardes)
