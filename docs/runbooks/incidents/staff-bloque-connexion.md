# Le compte staff ne peut plus se connecter

**Sévérité** : HIGH — c'est le compte qui dépanne les autres. Tant qu'il est dehors, aucun client
ne peut être dépanné, et le runbook « un éleveur est bloqué » ne s'applique plus.
**Temps de résolution** : < 10 min
**Vérifié** : 2026-10-10 — diagnostic **rejoué en production** (SSH + SQL en lecture seule) sur
l'incident réel du 8 octobre, qui est la raison de ce runbook. La remise en service par écriture
directe en base (§ Résolution C) **n'a jamais été exécutée** ; seule la génération du hash l'a été,
en local. Ne pas prétendre le contraire.

## Pourquoi ce runbook est séparé de « un éleveur est bloqué »

Parce que l'autre envoie diagnostiquer dans **Console → Sécurité**, et que cette console exige un
compte staff connecté. Quand c'est le staff qui est dehors, ce chemin est fermé : la seule porte
restante est SSH. Tout ce qui suit suppose que tu n'as rien d'autre.

## Symptômes

- Connexion refusée sur `app.jawdi.app` pour `staff@jawdi.app`, avec le message générique de
  mauvais identifiants — **le même** que pour un compte inexistant : c'est volontaire, et ça ne
  t'apprend donc rien.
- La console d'administration est inaccessible, puisqu'il faut être connecté pour l'atteindre.
- Le reste de la plateforme va très bien : les éleveurs travaillent normalement.

## Diagnostic

Tout est en lecture seule. Rien ici ne modifie la production.

```bash
# 0. La plateforme répond-elle, avant toute chose ?
curl -s https://app.jawdi.app/actuator/health          # attendu : {"status":"UP"}

# Les requêtes suivantes passent par le VPS (adresse : voir infra/DEPLOY.md).
ssh deploy@<VPS>
PSQL="docker exec avicare-prod-postgres-1 psql -U avicare -d avicare -At"
```

```sql
-- 1. Le compte existe-t-il, et est-il sain ?
SELECT id, email, role, is_active, length(password_hash), left(password_hash, 7),
       created_at, updated_at, last_login_at
  FROM users WHERE lower(email) = 'staff@jawdi.app';

-- 2. L'adresse du client est-elle bloquée ? (vide = aucun blocage en cours)
SELECT ip_address, reason, blocked_by, blocked_until FROM blocked_ips;

-- 3. Le mot de passe a-t-il changé sous tes pieds ? LA question qui tranche.
SELECT id, created_at, consumed_at FROM password_reset_codes
  WHERE user_id = (SELECT id FROM users WHERE lower(email) = 'staff@jawdi.app')
  ORDER BY created_at DESC LIMIT 5;

-- 4. Les tentatives arrivent-elles jusqu'au backend ?
SELECT created_at, event_type, ip_address, email FROM security_events
  WHERE email ILIKE '%staff%' ORDER BY created_at DESC LIMIT 10;
```

### Lire les réponses

| Ce que tu vois | Ce que c'est | Va à |
|---|---|---|
| `is_active = f` | compte désactivé | **Résolution B** |
| `length(password_hash)` ≠ 60 ou préfixe ≠ `$2a$`/`$2b$`/`$2y$` | hash corrompu (écriture manuelle ratée) | **Résolution C** |
| une ligne dans `blocked_ips` avec `AUTO_BRUTEFORCE` | c'est l'adresse qui est bloquée, pas le compte | [un éleveur est bloqué](eleveur-bloque-connexion.md) § Résolution, mais par SQL |
| un `consumed_at` **juste avant** `users.updated_at` | **le mot de passe a été changé par une réinitialisation** et celui qu'on tape est l'ancien | **Résolution A** |
| `FAILED_LOGIN` présents, tous postérieurs à ce `consumed_at` | confirme le point ci-dessus | **Résolution A** |
| aucun `FAILED_LOGIN` récent | les tentatives n'arrivent pas : problème de réseau, de DNS ou de Caddy | [la plateforme ne répond plus](../ops/plateforme-injoignable.md) |

Le rapprochement **`consumed_at` ↔ `users.updated_at`** est ce qui a résolu l'incident du 8 octobre
en une requête : les deux horodatages étaient identiques à la demi-seconde (11:44:36), et les cinq
échecs de connexion suivaient. Le compte était parfaitement sain ; c'est le mot de passe tapé qui
avait cessé d'être le bon.

## Résolution

### A — Refaire la réinitialisation (cas nominal)

C'est la voie normale, elle n'écrit rien à la main et reste auditée. Elle marche tant que le numéro
inscrit sur le compte reçoit WhatsApp.

```bash
curl -s -X POST https://app.jawdi.app/api/v1/auth/password-reset/request \
  -H 'Content-Type: application/json' -d '{"phone":"+221XXXXXXXXX"}'
```

Puis sur `https://app.jawdi.app/forgot-password` : coller le code (valable 15 min), taper le nouveau
mot de passe **deux fois**, et le relire avec l'œil avant d'envoyer.

> C'est exactement là que l'incident du 8 octobre s'est produit : l'écran ne demandait alors le mot
> de passe **qu'une seule fois**, et sur mobile à l'aveugle. Une faute de frappe y fixait un mot de
> passe que personne ne connaissait. Le champ de confirmation et l'œil ont été ajoutés après, pour
> cette raison.

Pour vérifier le numéro inscrit sans l'afficher en entier :
`SELECT right(phone, 4) FROM users WHERE id = <id>;`

### B — Le compte est désactivé

```sql
UPDATE users SET is_active = true WHERE id = <id>;   -- écriture
```

### C — Le numéro ne reçoit plus rien (dernier recours : écrire le hash)

À n'utiliser que si A est impossible. Le hash se fabrique **hors de la machine** : rien à installer
sur le VPS, et le mot de passe en clair ne traverse pas la production.

```bash
# Sur ta machine. BCryptPasswordEncoder(strength=12) — cf. CLAUDE.md.
python3 -m venv /tmp/bc && /tmp/bc/bin/pip install -q bcrypt
/tmp/bc/bin/python -c "import bcrypt,getpass; p=getpass.getpass('Nouveau mot de passe: ').encode(); print(bcrypt.hashpw(p, bcrypt.gensalt(12, prefix=b'2a')).decode())"
```

Le résultat doit faire **60 caractères** et commencer par `$2a$12$`. Puis, sur le VPS :

```sql
UPDATE users SET password_hash = '<le hash>' WHERE id = <id>;        -- écriture
DELETE FROM refresh_tokens WHERE user_id = <id>;                     -- coupe les sessions
```

Révoquer les sessions n'est pas optionnel : si le mot de passe a été perdu plutôt qu'oublié, les
jetons déjà émis survivraient au changement.

### Ce qui ne te sauvera pas

`ADMIN_FOUNDER_EMAIL` (cf. `FounderAdminInitializer`) **repromeut** le compte en `ADMIN` avec la
permission `*` à chaque démarrage. C'est un filet contre la perte de *droits*, jamais contre la
perte d'*accès* : il ne touche pas au mot de passe et ne crée aucun compte. En production il pointe
d'ailleurs sur `staff@jawdi.app` — c'est-à-dire sur le compte précisément bloqué.

En revanche il offre un détour utile : pointer `ADMIN_FOUNDER_EMAIL` sur un **autre** compte dont tu
connais le mot de passe, redémarrer (`./deploy.sh`), et ce compte devient staff — la console
redevient accessible, et le mot de passe du compte bloqué se réinitialise depuis
Console → Utilisateurs. À ne faire qu'avec un compte que tu contrôles, et à remettre en état après :
retirer la variable ne redescend pas le rôle, il faut le redescendre à la main.

## Après

- Note dans le journal d'incident **lequel des quatre diagnostics** a répondu. Si c'est deux fois de
  suite le rapprochement `consumed_at` ↔ `updated_at`, le problème n'est pas le compte mais l'écran
  de réinitialisation : retournes-y.
- Si tu as utilisé C, le mot de passe n'est passé par aucun journal : vérifie que tu l'as rangé dans
  le gestionnaire de mots de passe **avant** de fermer le terminal.
- Si le filet `ADMIN_FOUNDER_EMAIL` a été détourné vers un autre compte, remets-le sur le compte
  staff et redescends le rôle du compte emprunté.

## Références

- Code : `AuthService.login`, `PasswordResetService.confirm`, `FounderAdminInitializer`
- Tables : `users`, `password_reset_codes`, `refresh_tokens`, `blocked_ips`, `security_events`
- Écran : `web/src/app/(auth)/forgot-password/page.tsx`, `mobile/app/(auth)/forgot-password.tsx`
- Voisin : [un éleveur est bloqué](eleveur-bloque-connexion.md) — pour un **client**, via la console
