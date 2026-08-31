# Un éleveur ne peut plus se connecter

**Sévérité** : HIGH — le client est dehors, et il paie.
**Temps de résolution** : < 5 min
**Vérifié** : 2026-08-31, en local (application + PostgreSQL de développement) — jamais en production.

## Symptômes

- « Ça me dit que je n'ai pas le droit », « impossible de me connecter depuis ce matin ».
- Le client reçoit **403** avec le code `ADDRESS_BLOCKED` et le message
  *« Trop de tentatives depuis cette adresse. Réessayez plus tard. »*
- Souvent **plusieurs personnes de la même ferme** en même temps — c'est le signe qui compte.

## Pourquoi ça arrive

Cinq échecs de connexion depuis une même adresse en 15 minutes la bloquent une heure (P4). C'est une
défense contre les scripts, mais **au Sénégal une ville entière peut partager un NAT d'opérateur** :
un employé qui se trompe cinq fois peut enfermer dehors toute la ferme, voire des fermes voisines.

**C'est le faux positif le plus probable de la plateforme.** Traite-le comme tel : la présomption va
au client.

## Diagnostic

1. **Console → Sécurité** (`/console/securite`), section « Adresses actuellement refusées ».
2. Cherche l'adresse. Si la colonne « Par » indique `automatique`, c'est le blocage anti-force brute.
3. Regarde le **compte visé** dans le journal en dessous :
   - c'est **l'email du client** → il s'est trompé de mot de passe, ou son mobile rejoue un ancien
     mot de passe enregistré ;
   - ce sont **des emails inconnus** → c'est une vraie attaque, et l'adresse partagée est une
     victime collatérale. Débloque quand même, mais surveille.

En ligne de commande si la console est inaccessible :

```sql
SELECT ip_address, reason, blocked_by, blocked_until FROM blocked_ips;
SELECT event_type, email, created_at FROM security_events
 WHERE ip_address = '<IP>' ORDER BY created_at DESC LIMIT 10;
```

## Résolution

### Cas nominal — débloquer

Console → Sécurité → « Débloquer », **avec une raison** (elle part dans le journal d'audit avec ton
nom). L'accès revient immédiatement.

Sortie réelle du test :

```
symptôme            : 403 ADDRESS_BLOCKED
bloquée             : 41.82.10.77 | 5 échecs de connexion en 15 min | par AUTO_BRUTEFORCE | reste 59 min
après déblocage     : 401 (joignable, plus bloquée)
```

Un 401 après déblocage est le **bon** résultat : la route répond, elle demande juste une
authentification.

### Si ça recommence pour le même client

Son application mobile rejoue probablement un mot de passe périmé. Fais-lui se **déconnecter puis
reconnecter** sur le mobile. Sinon, réinitialise son mot de passe depuis Console → Utilisateurs.

### Si ça touche plusieurs fermes sans rapport

Le seuil est trop bas pour la réalité réseau du terrain. Relève-le **sans redéployer** :

```bash
# infra/.env sur le VPS
BRUTEFORCE_MAX_FAILURES=10
BRUTEFORCE_BLOCK_MINUTES=15
./deploy.sh          # relit .env
```

### Escalade — tout désarmer

Si le mécanisme lui-même dysfonctionne :

```bash
IP_BLOCKING_ENABLED=false    # les blocages ne s'appliquent plus, le journal continue
```

## Après

- Note dans le journal d'incident **quel type de blocage** c'était (client maladroit / vraie attaque
  / réseau partagé). Trois occurrences du même type = un réglage à changer, pas un incident à
  reproduire.
- Si c'était une vraie attaque : l'adresse se rebloquera d'elle-même à la prochaine série.

## Références

- Endpoints : `GET /api/v1/admin/security`, `POST /api/v1/admin/security/unblock`
- Tables : `blocked_ips`, `security_events`
- Décision : `docs/decisions/013-threat-detection-rate-limiting.md`
