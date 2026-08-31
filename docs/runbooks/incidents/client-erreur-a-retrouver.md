# « J'ai eu une erreur ce matin »

**Sévérité** : MEDIUM — un client bloqué sur une action, pas une panne.
**Temps de résolution** : < 5 min pour identifier la requête.
**Vérifié** : 2026-08-31, en local (application + PostgreSQL de développement) — jamais en production.

## Symptômes

- « Ma facture ne s'est pas générée », « ça n'a pas marché », « il y a eu un message rouge ».
- Le client peut te lire une **référence courte** (8 caractères, ex. `F1CBCC9D`) : elle apparaît dans
  le message d'erreur pour les pannes serveur (5xx). S'il n'en a pas, c'est probablement une erreur
  métier (champ manquant, transition interdite) — voir plus bas.

## Diagnostic

### 1. Avec la référence

Console → **Traces** (`/console/traces`), colle la référence dans « Référence / identifiant ».

Sortie réelle du test :

```
référence communiquée : F1CBCC9D
trouvé  : #107 POST /api/v1/farms -> 400 en 6 ms
auteur  : p5-...@jawdi.app
```

Ouvre la trace : tu vois le **corps envoyé** (secrets masqués), la **réponse**, et la stack trace
s'il y en a une.

### 2. Sans la référence

Filtre par **email du client** et coche **« Erreurs seulement »**, puis recoupe avec l'heure qu'il
donne. Les traces gardent **30 jours** : au-delà, il n'y a plus rien à chercher.

⚠️ **Ce que les traces ne contiennent pas** : les lectures qui ont réussi. Seules les erreurs, les
écritures et les lectures lentes sont conservées. Si tu ne trouves rien pour une consultation qui
s'est bien passée, c'est normal — et ça veut dire que le problème n'est pas là.

### 3. Lire le résultat

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| **4xx** avec un `code` métier | Le client a fait une action refusée. Lis `detail` : c'est la phrase qu'il aurait dû lire. Souvent un problème d'**explication**, pas de code. |
| **403** `ADDRESS_BLOCKED` | Autre runbook : [éleveur bloqué](eleveur-bloque-connexion.md) |
| **429** | Il a cliqué trop vite, ou une intégration boucle. `Retry-After` dit combien de temps. |
| **503** `FEATURE_TEMPORARILY_UNAVAILABLE` | Un module est **coupé** : Console → Urgence pour voir pourquoi et par qui. |
| **500** avec stack trace | Vrai bug. La stack trace nomme la classe. |
| **Aucune trace** | Soit la requête n'est jamais arrivée (réseau, mobile hors ligne), soit c'était une lecture réussie. |

## Résolution

- **Erreur métier** : réexplique au client, et note la formulation qui l'a induit en erreur.
- **Bug 500** : la trace donne la classe, le payload et l'heure — de quoi ouvrir une issue
  reproductible. Si le module est dangereux en l'état, **coupe-le** (Console → Urgence) plutôt que de
  laisser des données se dégrader pendant que tu corriges.
- **Rien trouvé** : demande au client une capture d'écran. La référence y figure.

## Après

Ajoute le cas au journal d'incident. Si trois clients butent sur le même 4xx, ce n'est plus un
incident : c'est l'interface qui ment.

## Références

- Endpoints : `GET /api/v1/admin/traces`, `GET /api/v1/admin/traces/{id}`
- Table : `request_traces` (rétention 30 jours)
- Décision : `docs/decisions/010-request-tracing.md`
