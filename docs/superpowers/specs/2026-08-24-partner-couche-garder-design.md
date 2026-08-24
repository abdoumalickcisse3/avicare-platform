# Couche « Garder » (partenaire C1) — Design

> Cycle « c » du produit partenaire. Suite de la couche « Voir » (B1 backend + B2 portail).
> Réf. : `docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md` §4 couche 2.

## 1. Problème

La couche « Voir » fait signer un partenaire ; elle ne le retient pas. Un provendier qui voit
son réseau une fois n'a aucune raison d'y revenir. La couche « Garder » lui donne **une raison
hebdomadaire de rouvrir le portail** et **une action à mener** : repérer l'éleveur qui décroche
avant qu'il ne quitte le réseau.

Règle doc 11 : *équipe-les pour qu'ils restent*.

## 2. Décisions (arbitrées 2026-08-24)

| # | Sujet | Choix |
|---|---|---|
| 1 | Périmètre du cycle | **Couche « Garder » seule** — « Développer » (prévision de recommande) part en cycle C2 |
| 2 | Alertes | **Matérialisées** (table `partner_alerts` + scan quotidien) **+ push WhatsApp** au partenaire |
| 3 | Co-branding | **Logo seul** (URL saisie par l'ADMIN), affiché dans l'app éleveur. Pas d'upload de fichier |
| 4 | Comptes subventionnés | **Hors périmètre** — dépend de la console super-admin (non codée) et de la monétisation (spec §7) |
| 5 | Seuils de décrochage | **Propriétés Spring** (`partner.risk.*`), pas `parameters` : seuil plateforme, non réglable par ferme |

## 3. Invariant de confiance (inchangé, et c'est le point sensible)

Une alerte est un **dérivé de données partagées**. Donc :

- Une ferme qui ne partage **pas** le scope `activity` ne génère **aucune** alerte de décrochage,
  et n'apparaît pas dans le compteur. Son silence n'est pas observable par le partenaire.
- Le corps de l'alerte ne cite **que** ce que le scope autorise : nom de la ferme + nombre de jours
  sans saisie. Jamais un chiffre de mortalité, de vente ou de finance.
- Le masquage reste **backend** (`PartnerAlertScanner`), jamais délégué au front — même frontière
  que `PartnerNetworkReadService`.

Corollaire assumé : le partenaire apprend qu'une ferme a **quitté** son réseau (alerte `FARM_LEFT`).
C'est un fait qui le concerne directement (il perd un adhérent), pas une donnée d'exploitation.

## 4. Modèle de données

### `partner_alerts` (V38)

Miroir volontaire de `notifications` (même sémantique `dedup_key` / ACTIVE→RESOLVED), mais table
séparée : les destinataires sont des `partner_users`, pas des `users`, et `notifications` est keyée
`farm_id` côté éleveur. Fusionner les deux mélangerait deux audiences et deux frontières d'accès.

| Colonne | Type | Note |
|---|---|---|
| `partner_id` | FK `partners` ON DELETE CASCADE | destinataire |
| `farm_id` | FK `farms` ON DELETE CASCADE | ferme concernée |
| `category` | `FARM_SILENT` \| `FARM_LEFT` | CHECK |
| `severity` | `INFO` \| `WARNING` \| `CRITICAL` | CHECK |
| `title` / `body` | texte FR prêt à afficher | |
| `dedup_key` | ex. `FARM_SILENT:farm:42` | unique partiel sur ACTIVE |
| `status` | `ACTIVE` \| `RESOLVED` | + `resolved_at` |

Index unique partiel `(partner_id, dedup_key) WHERE status='ACTIVE'` → idempotence du scan.

### `whatsapp_outbox.notification_id` devient NULLABLE (V38, corrective)

Une alerte partenaire n'a pas de `notification` éleveur. Plutôt que dupliquer toute la machinerie
d'envoi (outbox + dispatcher + retry + Konekt), on **rend la colonne nullable** et le contexte
partenaire enfile via une façade. Le `WhatsAppDispatcher` draine déjà tout ce qui est PENDING,
quelle que soit l'origine — aucune modification du dispatcher.

## 5. Détection

### `FARM_SILENT` — décrochage de saisie (scan quotidien)

Source : `LivestockFacade.recentActivity(farmId, 1)` → `ActivityItem.at` = **dernière saisie**
(événements de cycle + mouvements de stock). Aucun nouveau read model.

| Jours sans saisie | Niveau | Alerte |
|---|---|---|
| `< partner.risk.watch-days` (7) | `OK` | aucune |
| 7 → 13 | `WATCH` | aucune (visible en colonne, pas de push) |
| `≥ partner.risk.at-risk-days` (14) | `AT_RISK` | `FARM_SILENT` WARNING + WhatsApp |
| `≥ partner.risk.critical-days` (30) | `AT_RISK` | `FARM_SILENT` CRITICAL + WhatsApp |

Le dedup key **porte le palier** : `FARM_SILENT:farm:42:WARNING` puis `…:CRITICAL`. Conséquence
voulue : quand une ferme franchit 30 jours, la clé WARNING disparaît des conditions courantes (donc
son alerte passe RESOLVED) et une alerte CRITICAL naît → **un second push**, un seul. Sans le palier
dans la clé, l'aggravation serait silencieuse.

Le scan tourne après celui de l'éleveur (`0 30 6 * * *`, Africa/Dakar) et réconcilie : une ferme
qui ressaisit voit son alerte passer RESOLVED, ce qui **réarme** le dedup key.

### `FARM_LEFT` — départ du réseau (événement)

`PartnerNetworkService.leave()` crée l'alerte directement (pas au scan) : c'est un fait ponctuel,
pas une condition persistante. Sévérité CRITICAL, jamais réconciliée par le scan (elle est
resolved à la lecture par le partenaire — ou reste ACTIVE, au choix du front).

## 6. Surfaces

### Portail partenaire (`partner.jawdi.app`)

- **Bandeau d'alertes** en tête de dashboard : « 2 éleveurs décrochent » + liste (nom, jours de
  silence, sévérité). Rien à afficher = pas de bandeau (pas d'état vide bruyant).
- **Colonne « Suivi »** dans la table des fermes : puce OK / À surveiller / À risque, `—` quand la
  ferme ne partage pas `activity` (cohérent avec le reste de la ligne).
- `GET /api/v1/partner/network/alerts` + `riskLevel` ajouté à `NetworkFarmRow`.

### App éleveur (co-branding)

- `PATCH /api/v1/admin/partners/{id}` (nom, contacts, `logoUrl`) — **absent aujourd'hui**, le
  `logoUrl` n'est settable qu'à la création.
- `logoUrl` ajouté à `FarmPartnerResponse` (le front éleveur ne le reçoit pas encore).
- Bloc **« Mon réseau »** sur le dashboard éleveur : logo + nom des partenaires CONFIRMED, lien
  vers `/reglages/partenaires`. Discret — c'est du co-branding, pas de la publicité.

## 7. Hors périmètre (assumé)

- Provisionner / subventionner des comptes éleveurs (spec §4 couche 2, 3ᵉ item) → console
  super-admin + monétisation, non codées.
- Préférences de notification par partenaire (canal, seuil) : YAGNI tant qu'un seul partenaire
  réel n'est pas branché. Le push WhatsApp suit le flag global `notifications.whatsapp.enabled`.
- Prévision de recommande / tonnage → cycle C2 « Développer ».

## 8. Risques

- **Faux positifs saisonniers** : une ferme entre deux bandes ne saisit rien et n'est pas « à
  risque ». Mitigation : `recentActivity` couvre aussi les mouvements de stock, et une ferme sans
  unité active est déjà `active=false` côté « Voir ». À surveiller avec de vraies données — c'est
  le premier réglage à ajuster après le premier partenaire branché.
- **Bruit WhatsApp** : le dedup key + la réconciliation garantissent 1 message par épisode de
  silence, pas 1 par jour. Le seuil CRITICAL à 30 j re-notifie une fois — c'est le rôle du palier dans le dedup key (§5).
