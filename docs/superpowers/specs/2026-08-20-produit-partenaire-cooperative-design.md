# Design — Produit Partenaire / Coopérative (B2B2C, item J)

> Statut : **design papier validé, NON planifié / NON développé** (2026-08-20).
> Cadrage explicite : « **prêt à signer** ». Aligné avec `docs/11-go-to-market.md` (adopté) qui dit
> de **ne bâtir la vue réseau partenaire que lorsqu'un partenaire signe** (YAGNI commercial).
> Ce document existe pour être *prêt à démarrer vite* dès qu'un provendier signe et pour affiner le
> pitch commercial. **Rien n'est codé.**

---

## 1. Contexte & écart constaté

La landing vend **deux publics** : éleveurs *et* coopératives/provendiers (carte « Devenir
partenaire », page `landing/src/pages/partenaires.astro`, lien Hero « Vous êtes coopérative /
provendier ? »). Mais le CTA est un simple `mailto:` — **côté produit, il n'existe rien** :

- Backend : **aucune** entité `partner`/`cooperative`/`réseau`. (Faux-amis : `V29__sales_channels`
  = circuits de vente d'une ferme ; « network » du client LLM = réseau HTTP.)
- Web : aucun compte coop, aucun portail, aucun tarif réseau.

C'est **cohérent** avec la stratégie : doc 11 diffère volontairement ce produit. Ce design le
prépare sans le construire.

## 2. Ce que la stratégie (doc 11) fixe déjà

- **Pitch provendier** : « X de *vos propres clients* utilisent déjà Jawdi. Un éleveur qui suit ses
  chiffres achète plus d'aliment, plus régulièrement, et reste chez vous. Équipez votre réseau —
  et je vous donne la vue agrégée dessus. »
- **Modèle éco** : le partenaire paie (palier « Sur mesure ») ; l'éleveur est **gratuit ou
  subventionné**. Paiement Wave enregistré manuellement d'abord.
- **Règle** : la vue réseau **ne se construit qu'à la signature d'un partenaire**. Un seul suffit.
- **Vétérinaires** = prescripteurs naturels, même mouvement que les provendiers.
- **Circuits de distribution (V29)** taguent déjà l'origine des fermes/ventes → instrumentation GTM.

## 3. Décisions verrouillées (brainstorming 2026-08-20)

| # | Sujet | Choix |
|---|---|---|
| 1 | Cadrage | **Design papier « prêt à signer »** — pas de code, aligné doc 11 |
| 2 | Cœur de valeur | **Les trois, hiérarchisés** : Voir → Garder → Développer |
| 3 | Rattachement ferme↔partenaire | **3 voies** : manuel super-admin · code d'invitation · auto-déclaration éleveur (PAS « le partenaire crée le compte » → l'éleveur reste propriétaire) |
| 4 | Frontière data | **L'éleveur choisit (curseurs de partage)**, avec défauts raisonnables (opérationnel ON, finances OFF) + « quitter le réseau » à tout moment |
| 5 | Surface partenaire | **Portail dédié `partner.jawdi.app`** (cible) ; **démarrage via console super-admin** (rapport read-only/PDF) pour faire signer sans bâtir le portail |

**Invariant de confiance** : l'éleveur est **propriétaire** de son compte et de ses données ; le
partenaire ne fait que *voir* ce qui lui est explicitement partagé. Finances privées par défaut.

## 4. Hiérarchie de valeur — Voir → Garder → Développer

Échelle de valeur, du moins cher/immédiat au plus gourmand en données. On **signe sur « Voir »**,
on **fidélise sur « Garder »**, on **monétise à fond sur « Développer »**.

### Couche 1 — VOIR (le « aha » qui fait signer)
Vue *read-only* agrégée par-dessus des données déjà existantes.
- Dashboard réseau : fermes actives/inactives, tonnage aliment agrégé, mortalité moyenne, nombre
  d'éleveurs.
- Liste par ferme **filtrée par les scopes** que chaque éleveur partage.
→ C'est le livrable de vente. Le moins cher, immédiat, colle au pitch doc 11.

### Couche 2 — GARDER (transformer la visibilité en fidélisation)
- Alertes « éleveur à risque » (décrochage de saisie → risque de churn/de départ du réseau).
- Co-branding : logo partenaire sur l'app de l'éleveur du réseau.
- Provisionner / subventionner des comptes éleveurs.
→ La règle doc 11 : équipe-les pour qu'ils restent.

### Couche 3 — DÉVELOPPER (la couche monétisable)
- Prévision de recommande : timing de fin de bande → besoin d'aliment à venir.
- Opportunités de tonnage, ciblage. Nourri par les circuits V29.
→ En dernier : exige de la donnée mûre (cycles de conso réellement saisis) pour être crédible.

## 5. Modèle de données (le lien qui manque aujourd'hui)

- **`partners`** — entité partenaire. `type` ∈ {`FEED_SUPPLIER` (provendier), `VET` (vétérinaire)}.
  Champs : nom, contact, logo (co-branding), statut.
- **`partner_users`** — comptes se connectant au portail ; permissions fines (patron = permissions
  staff/membres déjà en place).
- **`partner_farm_memberships`** — lien ferme↔partenaire :
  - `status` : `DECLARED` → `CONFIRMED` → `LEFT`,
  - `origin` : `MANUAL_ADMIN` | `INVITE_CODE` | `FARMER_DECLARED`,
  - `sharing_scopes` : sous-ensemble de {`activity`, `flock_health`, `feed_consumption`,
    `sales_volume`, `finances`}. Défaut : opérationnel ON, `finances` OFF. Contrôlé par l'éleveur.
- **`partner_invite_codes`** — codes réseau distribuables (voie « code d'invitation »).

**Principe d'accès aux données** : les endpoints partenaire lisent les façades métier existantes
mais **n'exposent que les scopes partagés** par chaque adhésion. Le filtrage par scope est la
frontière de confiance — implémenté côté backend, jamais contournable par le front.

## 6. Surface & phasage (aligné doc 11)

- **Cible** : portail `partner.jawdi.app` (cloisonné, même logique que `admin.jawdi.app`) +
  endpoints `/api/v1/partner/**` gatés par `partner_users` + scopes.
- **Démarrage « prêt à signer »** : la vue réseau est générée depuis la **console super-admin**
  (rattachement manuel des fermes + rapport read-only / PDF livré au prospect). **Zéro portail à
  bâtir pour décrocher le 1er partenaire.** Le portail se construit **après** signature.
- **Dépendance croisée** : le rattachement manuel (item J) vit dans la **console super-admin**
  (`docs/superpowers/specs/2026-08-20-console-super-admin-design.md`, Phase 5). Les deux docs se
  répondent.

## 7. Monétisation

Hors périmètre de ce design. Reprend doc 11 : le partenaire paie (« Sur mesure »), l'éleveur
gratuit/subventionné, Wave enregistré manuellement d'abord. À traiter dans le cycle monétisation
(doc 11 §7, T1 2027 sous conditions).

## 8. Garde-fous confiance / GTM

- **Consentement éleveur** au cœur : curseurs de partage + « quitter le réseau » à tout moment ;
  finances privées par défaut.
- **Éleveur propriétaire** du compte et des données.
- **Pas de partenaire sans preuve** (règle doc 11 §9) : ce produit ne se déclenche qu'après un
  provendier réellement intéressé, sur la base du pack preuve des pilotes.

## 9. Questions ouvertes (à trancher au spec détaillé, au moment de la signature)

- Portail : réutiliser la stack Next.js/MUI (comme web/admin) — défaut probable pour cohérence.
- `partner_users` : auth séparée (portail) vs comptes `users` avec un rôle `PARTNER` — décider au
  spec (préférence : entité séparée pour cloisonnement, cohérent avec le choix « portail dédié »).
- Co-branding : périmètre exact (logo seul vs thème) — YAGNI, commencer par le logo.
- Défauts de scopes : valider les valeurs par défaut avec les premiers éleveurs (UX du consentement).
- Vétérinaires : même modèle `partners` (type `VET`) — confirmer le sous-ensemble de scopes
  pertinent (santé oui, aliment non).

## 10. Prochaines étapes

1. **Aucune implémentation** (aligné doc 11 : bâtir quand un partenaire signe).
2. Quand un provendier montre un intérêt sérieux : livrer d'abord la **vue réseau via la console
   super-admin** (rapport) comme outil de vente.
3. À la **signature** : écrire le spec détaillé (Couche 1 « Voir » + portail minimal), puis invoquer
   `writing-plans`.
