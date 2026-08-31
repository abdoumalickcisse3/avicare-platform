# Restaurer une sauvegarde

**Sévérité** : CRITICAL — c'est le geste qui écrase les données actuelles.
**Temps de résolution** : 10-20 min selon la taille.
**Vérifié** : 2026-08-31, en local — restauration complète dans un conteneur jetable, **0 erreur**,
72 tables, schéma v51, 32 fermes, 36 utilisateurs retrouvés.

## Quand

- Corruption de données, suppression massive accidentelle, migration ratée irréversible.
- **Ou** : exercice trimestriel. C'est le seul usage qui garantit que le geste marchera le jour où
  il faudra vraiment.

## ⚠️ Avant de toucher à la production

1. **Prends une sauvegarde de l'état actuel**, aussi cassé soit-il. On restaure parfois la mauvaise
   date, et l'état cassé contient peut-être des données arrivées après la sauvegarde cible.
   ```bash
   /opt/avicare-platform/infra/scripts/backup-db.sh
   ```
2. **Vérifie la sauvegarde cible** avant de la déployer (voir « Répétition » ci-dessous).
3. **Préviens les clients.** La restauration perd tout ce qui a été saisi depuis la sauvegarde. Un
   éleveur qui a fait sa saisie du matin doit le savoir avant, pas le découvrir.
4. **Coupe le trafic** si l'incident est en cours : Console → Urgence, ou arrête le conteneur web.

## Répétition — restaurer dans un conteneur jetable

**Fais toujours ça d'abord.** Ça ne touche à rien et ça répond à la seule question qui compte : ce
fichier est-il restaurable ?

```bash
docker run -d --name jawdi-restore-test \
  -e POSTGRES_DB=avicare -e POSTGRES_USER=avicare -e POSTGRES_PASSWORD=test \
  -p 5436:5432 postgres:16-alpine

gunzip -c <dump.sql.gz> | docker exec -i jawdi-restore-test psql -q -U avicare avicare

docker exec -i jawdi-restore-test psql -U avicare -d avicare -c "
  SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS tables,
         (SELECT max(version::int) FROM flyway_schema_history WHERE success) AS schema_version,
         (SELECT count(*) FROM farms) AS fermes,
         (SELECT count(*) FROM users) AS utilisateurs;"

docker rm -f jawdi-restore-test
```

Résultat réel de l'exercice du 2026-08-31 :

```
 tables | schema_version | fermes | utilisateurs
     72 |             51 |     32 |           36
erreurs de restauration : 0
```

Ce qu'il faut vérifier :
- **0 erreur** pendant la restauration ;
- `schema_version` **cohérente avec le code déployé** — restaurer un dump plus ancien que le code
  fait démarrer l'application sur un schéma incomplet ; Flyway appliquera les migrations manquantes,
  mais vérifie que c'est bien ce que tu veux ;
- les volumétries plausibles (une base à 0 ferme est un dump vide).

## Résolution — restaurer en production

```bash
cd /opt/avicare-platform/infra
./scripts/restore-db.sh ~/avicare-backups/avicare_avicare_<stamp>.sql.gz
# demande une confirmation « yes » explicite
```

Puis :

```bash
./deploy.sh                       # redémarre, Flyway applique les migrations manquantes
curl -s https://app.<domaine>/actuator/health    # doit répondre {"status":"UP"}
```

Enfin, **contrôle métier** avant d'annoncer que c'est réglé : ouvre la console, vérifie le nombre de
fermes et une donnée récente que tu connais. Un `health: UP` dit que l'application tourne, pas que
les bonnes données sont là.

## Si la restauration échoue

- **Erreurs de contraintes** : le dump vient d'un schéma différent. Prends une sauvegarde plus proche
  de la version déployée, ou déploie le code correspondant d'abord.
- **Fichier corrompu** (`gunzip: unexpected end of file`) : prends la sauvegarde précédente, et
  vérifie la copie hors site.
- **Plus rien ne marche** : la sauvegarde prise à l'étape 1 est ton filet. Restaure-la.

## Après

- Note ce qui a été perdu (fenêtre entre la sauvegarde et l'incident) et préviens les fermes
  concernées **nommément**. C'est leur travail qui a disparu.
- Refais l'exercice en conteneur jetable après l'incident : la confiance dans la procédure vient de
  l'avoir faite, pas de l'avoir lue.

## Références

- Scripts : `infra/scripts/restore-db.sh`, `backup-db.sh` · `infra/DEPLOY.md` §6
- Runbook amont : [sauvegarde manquée](sauvegarde-manquee.md)
