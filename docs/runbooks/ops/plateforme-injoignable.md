# La plateforme ne répond plus

**Sévérité** : CRITICAL — plus personne ne peut saisir ni consulter.
**Temps de résolution** : < 20 min si c'est la facturation ; variable sinon.
**Vérifié** : 2026-09-03, **en production réelle** — incident vécu, diagnostic et remise en route
rejoués de bout en bout (voir « Ce qui s'est passé le 2026-09-03 » plus bas).

## Symptômes

- `jawdi.app` et `app.jawdi.app` ne chargent plus — le navigateur tourne puis abandonne.
- Un déploiement échoue sur `dial tcp ***:22: i/o timeout`.
- Un éleveur appelle en disant « le site ne marche pas » (et cette fois, c'est vrai).

## Diagnostic

**Ne commence pas par le serveur. Commence par toi.** La moitié des « le serveur est mort » sont
une connexion locale coupée, et se précipiter sur la console du fournisseur fait perdre dix minutes.

### 1. Ton réseau ou le sien ? (10 secondes)

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 15 https://www.cloudflare.com
```

- **200** → ton réseau va bien, continue.
- **rien** → c'est toi. Change de réseau (partage de connexion du téléphone) et recommence.

### 2. Le DNS résout-il encore ?

```bash
dig +short jawdi.app app.jawdi.app
```

Les deux doivent rendre la même IP. Une réponse vide est un problème de DNS, pas de serveur —
va voir chez le registrar, pas chez l'hébergeur.

### 3. La machine répond-elle à quoi que ce soit ?

```bash
ping -c 3 <IP>
for p in 22 80 443; do
  printf "port %-4s " $p
  nc -z -w 5 <IP> $p && echo OUVERT || echo injoignable
done
```

| Résultat | Ce que ça veut dire |
|---|---|
| Ping OK, ports fermés | La machine vit, les conteneurs sont tombés → va au cas B |
| **Tout injoignable** | La machine est éteinte, suspendue ou coupée du réseau → cas A |
| Port 443 OK mais 502/503 | Caddy répond, le backend non → `docker compose ps` et les logs |

### 4. Avant de chercher une panne technique : **la facture**

Une machine qui disparaît **d'un coup**, sans dégradation progressive, est plus souvent suspendue
pour impayé qu'en panne. Ouvre l'espace client de l'hébergeur et regarde le solde **avant** de
soupçonner le matériel. C'est exactement ce qui s'est passé le 2026-09-03.

## Résolution

### Cas A — machine éteinte ou suspendue

1. Console de l'hébergeur → état de la machine.
2. **Suspendue pour impayé** → régler, puis vérifier que la machine redémarre. Beaucoup
   d'hébergeurs lèvent la suspension **sans rallumer la VM** : s'il est écrit « stopped »,
   clique sur *Start*.
3. Attendre le retour du port 22 plutôt que de tester à l'aveugle :

```bash
until nc -z -w 5 <IP> 22; do sleep 30; done; echo "SSH ouvert"
```

4. Vérifier que la pile est remontée toute seule (les conteneurs ont `restart: unless-stopped`) :

```bash
curl -s https://app.jawdi.app/actuator/health   # attendu : {"status":"UP"}
```

5. Si la pile n'est pas remontée : `cd /opt/avicare-platform/infra && ./deploy.sh`

### Cas B — la machine vit, la pile est tombée

```bash
cd /opt/avicare-platform/infra
docker compose -f docker-compose.prod.yml ps        # qui est mort ?
docker compose -f docker-compose.prod.yml logs --tail=100 backend
df -h                                                # disque plein = cause n°1
docker compose -f docker-compose.prod.yml up -d      # relancer
```

## Après

### Vérifier que rien n'a été perdu

Une coupure franche ne corrompt rien : Postgres est transactionnel, et une migration qui n'a pas
démarré n'a rien laissé à moitié fait. À confirmer quand même :

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U avicare -d avicare -c \
  "select version, success from flyway_schema_history order by installed_rank desc limit 3;
   select count(*) from farms; select count(*) from users; select count(*) from production_units;"
```

Aucune ligne `success = false` ne doit apparaître.

### Vérifier les sauvegardes

Le cron de sauvegarde tournait **sur cette machine**. Pendant une coupure de plusieurs jours, il
n'a rien produit : la copie la plus récente date de la dernière nuit où le serveur était debout.
La réplication hors-site (Backblaze B2) conserve les précédentes. Voir
[Sauvegarde manquée](sauvegarde-manquee.md), et relancer une sauvegarde immédiatement :

```bash
/opt/avicare-platform/infra/scripts/backup-db.sh
```

### Rejouer le déploiement s'il avait échoué

Les images sont déjà sur GHCR — inutile de reconstruire. Relancer le workflow `Deploy` suffit.

## Ce qui manque encore, et qui compte plus que ce runbook

**Personne n'a été prévenu.** Le 2026-09-03, la panne a été découverte *en déployant*, pas par une
alerte. Un runbook accélère la réparation ; il ne raccourcit pas le délai avant qu'on s'aperçoive
du problème. Une supervision externe qui appelle quand `app.jawdi.app` ne répond plus se met en
place en dix minutes et couvre le cas que rien d'autre ne couvre : **la machine qui héberge la
supervision est celle qui est tombée**, donc la sonde doit vivre ailleurs.

## Ce qui s'est passé le 2026-09-03

| Heure (UTC) | Fait |
|---|---|
| ~09:56 | Déploiement déclenché ; images construites et poussées, étape SSH en échec (`dial tcp ***:22: i/o timeout`) |
| 09:58 | Diagnostic : Cloudflare répond en 0,7 s, DNS correct, ping 100 % de perte, ports 22/80/443 tous injoignables → la machine, pas le réseau local |
| ~10:09 | Cause identifiée : **suspension pour impayé** |
| 10:12 | Paiement effectué, SSH rouvert, `app.jawdi.app` → 200 |
| ~11:05 | Déploiement rejoué, réussi ; schéma migré en V52 |

**Ce que l'incident a coûté** : quelques heures d'indisponibilité totale.
**Ce qu'il n'a pas coûté** : aucune donnée. Le déploiement ayant échoué *avant* d'atteindre la
machine, aucune migration n'a été appliquée à moitié.
