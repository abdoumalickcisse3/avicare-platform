# 🚨 Accès d'urgence — MODÈLE À COMPLÉTER

> **Ce fichier est un squelette.** Les champs `<À REMPLIR>` doivent l'être par Malick, et ce
> document ne doit **pas** contenir de mots de passe : il dit *où* ils sont, pas ce qu'ils sont.
>
> **Statut : incomplet.** Tant qu'il l'est, il n'y a pas de plan de continuité — il y a un document
> qui en a l'air.

## Quand ce document s'applique

Malick est injoignable depuis plus de 48 h **et** quelque chose ne va pas sur la plateforme.

Trois jours de silence sans incident ne demandent rien d'autre qu'un message amical.

## Contacts

| Rôle | Nom | Téléphone | Email |
|---|---|---|---|
| Propriétaire | Abdou Malick Cisse | `<À REMPLIR>` | `<À REMPLIR>` |
| Proche à joindre en premier | `<À REMPLIR>` | `<À REMPLIR>` | — |
| **Contact de secours plateforme** | `<À REMPLIR>` | `<À REMPLIR>` | `<À REMPLIR>` |

Le contact de secours doit avoir **lu ce document et s'être connecté une fois** avant d'en avoir
besoin. Sinon ce tableau ne vaut rien.

## Ce à quoi le contact de secours a accès

À cocher au fur et à mesure que l'accès est réellement donné **et testé** :

- [ ] Console `admin.jawdi.app` — compte staff dédié (**pas** le compte de Malick)
- [ ] Coffre de mots de passe : `<Bitwarden / 1Password / autre — À REMPLIR>`
- [ ] Hébergeur (Contabo) — facturation et redémarrage
- [ ] GitHub (lecture du dépôt, pour les runbooks)
- [ ] Registrar DNS — renouvellement uniquement
- [ ] Konekt (WhatsApp) — état du crédit

**Un compte staff dédié, jamais celui de Malick.** Deux raisons : le journal d'audit doit dire qui a
agi, et un accès prêté ne se reprend pas proprement.

Permissions suggérées pour ce compte — assez pour tenir, pas assez pour aggraver :

| Permission | Pourquoi |
|---|---|
| `metrics:read` | Voir l'état de la plateforme |
| `flags:manage` | Couper un module qui dysfonctionne |
| `security:read`, `security:manage` | Débloquer un éleveur enfermé dehors |
| `integrity:read` | Constater une incohérence — **sans** `integrity:recompute` |
| `broadcast:send` | Prévenir les clients |

Volontairement **absents** : `tenants:write`, `users:reset-password`, `impersonate:open`,
`compliance:delete`, `integrity:recompute`. Ce sont les gestes qui modifient la donnée des clients ;
ils attendent le retour de Malick.

## Ce que le contact de secours peut faire

- Couper un module qui dysfonctionne (`/console/urgence`)
- Débloquer un éleveur (`/console/securite`)
- Communiquer avec les clients (`/console/communication`)
- Suivre les runbooks (`docs/runbooks/`)
- Redémarrer le serveur, restaurer une sauvegarde en dernier recours

## Ce qu'il ou elle ne doit **pas** faire

- **Déployer du code.** Accepter la panne, ne pas l'aggraver.
- **Modifier le schéma** (Flyway).
- **Recalculer des données** clients.
- **Changer les prix ou les plans.**

## Contrepartie

`<À REMPLIR : bénévole / astreinte mensuelle / au coup par coup>`

Un service qu'on n'a pas nommé est un service qu'on n'ose pas demander — et qu'on n'ose pas refuser
non plus.

## Où trouver quoi

- Coffre de mots de passe : `<À REMPLIR>`
- Dépôt : `github.com/<org>/avicare-platform`
- Runbooks : `docs/runbooks/`
- Déploiement : `infra/DEPLOY.md`
- Procédure d'urgence : [runbook propriétaire indisponible](../runbooks/recovery/proprietaire-indisponible.md)
