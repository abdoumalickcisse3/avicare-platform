# Design — Surfaces éleveur du produit partenaire (plan « a »)

> Statut : **design validé (2026-08-23), prêt à planifier.**
> Consomme le socle backend livré par la PR #215 (contexte `com.avicare.partner`).
> Prolonge le design papier `docs/superpowers/specs/2026-08-20-produit-partenaire-cooperative-design.md`
> (décisions #3 auto-déclaration éleveur, #4 curseurs de partage, §8 consentement éleveur).

---

## 1. Contexte

Le socle backend partenaire existe et est mergé : entités (`Partner`,
`PartnerFarmMembership`, `PartnerInviteCode`), migration V36, `PartnerService`,
`PartnerNetworkService` (dont les flux éleveur `declareSupplier` / `joinViaCode` /
`updateSharingScopes` / `leave` / `listForFarm`), `PartnerFacade`, et
`AdminPartnerController` (gaté `hasRole('ADMIN')`, chemin « prêt à signer »).

**Écart comblé par ce plan** : il n'existe aucune surface **éleveur-facing**. Un éleveur ne
peut pas encore, depuis son app, déclarer un fournisseur, rejoindre un réseau par code, voir
ses partenaires, régler ses curseurs de partage, ou quitter un réseau. Les méthodes de service
existent ; il manque le contrôleur éleveur-facing (avec la garde d'appartenance ferme), la
résolution du nom du partenaire, et les écrans web + mobile.

## 2. Périmètre

**Dans ce cycle (web + mobile) :**
- Déclarer un fournisseur/véto depuis un **annuaire** des partenaires actifs.
- **Rejoindre** un réseau par **code d'invitation**.
- **Voir ses partenaires** (adhésions non-LEFT) avec nom, type, statut.
- **Régler les curseurs de partage** d'une adhésion (5 booléens).
- **Quitter** un réseau à tout moment.

**Hors périmètre (plans ultérieurs) :**
- Portail `partner.jawdi.app` et `partner_users` (auth cloisonnée).
- Écran admin de confirmation des adhésions déclarées (le chemin admin existe déjà via
  `AdminPartnerController` + `PartnerNetworkService.confirm`).
- Couches de valeur « Voir / Garder / Développer ».
- Co-branding, monétisation.

**Aucune migration Flyway** : le schéma V36 couvre déjà tout ce qui est nécessaire. **Aucun
nouvel enum.**

## 3. Décisions verrouillées (brainstorming 2026-08-23)

| # | Sujet | Choix |
|---|---|---|
| 1 | Découverte du partenaire (voie FARMER_DECLARED) | **Annuaire des partenaires actifs** (liste filtrable FEED_SUPPLIER/VET) + rejoindre par code. Colle aux 2 voies éleveur du spec 2026-08-20. |
| 2 | Plateformes ce cycle | **Web + mobile ensemble** (parité immédiate). |
| 3 | Visibilité de la surface | **Toujours visible mais discrète** sous Réglages (web + mobile), état vide clair. **Pas de feature-flag** (cohérent avec le gating dormant + build-when-signed). |
| 4 | Confirmation | Déclaration/join éleveur → **DECLARED (en attente)**. Pas de confirmation côté éleveur ; le partenaire/admin confirme. L'éleveur voit « En attente » et peut quitter à tout moment. |
| 5 | Frontière de confiance | Garde d'appartenance **côté backend** : un éleveur ne peut agir que sur les adhésions de **sa** ferme, jamais par devinette d'ID. |

**Invariant** (repris du spec 2026-08-20) : l'éleveur est **propriétaire** de son compte et de
ses données ; finances privées par défaut ; « quitter le réseau » disponible en permanence.

## 4. Backend — `FarmerPartnerController`

Nouveau contrôleur sous `/api/v1/farms/{farmId}/partners` (patron `FarmSettingsController`,
gates via le bean `@farmAccess`).

| Méthode | Endpoint | Gate | Action service |
|---|---|---|---|
| GET | `/available?type=` | `@farmAccess.hasAccess(#farmId)` | Annuaire : partenaires ACTIVE (filtre type optionnel) |
| GET | `/` | `@farmAccess.hasAccess(#farmId)` | Mes adhésions non-LEFT, enrichies **nom + type** |
| POST | `/declare` `{partnerId}` | `@farmAccess.hasRole(#farmId, OWNER, MANAGER)` | `declareSupplier(partnerId, farmId, userId)` |
| POST | `/join` `{code}` | `@farmAccess.hasRole(#farmId, OWNER, MANAGER)` | `joinViaCode(code, farmId, userId)` |
| PUT | `/{membershipId}/scopes` `{5 bool}` | `@farmAccess.hasRole(#farmId, OWNER, MANAGER)` | garde farm-scoped → `updateSharingScopes` |
| DELETE | `/{membershipId}` | `@farmAccess.hasRole(#farmId, OWNER, MANAGER)` | garde farm-scoped → `leave` |

Lectures : tout membre de la ferme (`hasAccess`). Écritures : OWNER/MANAGER uniquement
(`hasRole`), aligné sur le reste de l'app (ex. `FarmSettingsController`).

### 4.1 Frontière de confiance — gardes farm-scoped

`PartnerNetworkService.updateSharingScopes(membershipId, …)` et `leave(membershipId)` opèrent
par `membershipId` **sans** vérifier la ferme. Un éleveur ne doit jamais pouvoir modifier
l'adhésion d'une autre ferme même en devinant l'ID. On ajoute deux variantes farm-scoped dans
`PartnerNetworkService` :

```java
PartnerFarmMembership updateSharingScopesForFarm(Long farmId, Long membershipId, SharingScopes scopes);
PartnerFarmMembership leaveForFarm(Long farmId, Long membershipId);
```

Elles chargent l'adhésion, **vérifient `membership.getFarmId().equals(farmId)`** (sinon
`NotFoundException.of("PartnerFarmMembership", membershipId)` — on ne divulgue pas l'existence
d'une adhésion d'une autre ferme), puis délèguent à la logique existante. Le contrôleur appelle
toujours les variantes farm-scoped. La garde vit dans le backend, jamais dans le front.

### 4.2 Enrichissement — dette `partnersForFarm`

Aujourd'hui `PartnerFacadeImpl.partnersForFarm` renvoie `partnerName/partnerType = null`
(dette assumée à la création du socle). La liste éleveur en a besoin. On paie la dette :
injecter `PartnerRepository` dans `PartnerFacadeImpl`, résoudre les `partnerId` distincts via
`findAllById`, et remplir `PartnerLink.partnerName/partnerType`. Le contrôleur éleveur peut
consommer soit ce `PartnerFacade.partnersForFarm`, soit un DTO dédié — on privilégie un DTO de
réponse contrôleur (`FarmPartnerResponse`) portant nom, type, statut, origine et les 5 scopes
(la carte éleveur affiche les curseurs), tout en corrigeant aussi la façade pour les futurs
consommateurs cross-contexte.

### 4.3 Annuaire

`PartnerService.listActive(PartnerType typeOrNull)` : filtre `status = ACTIVE` (et,
optionnellement, `type`). Réponse = DTO léger (`id`, `name`, `type`, `contactName`,
`contactPhone`, `logoUrl`) — pas de champ interne (`createdBy`, etc.).

### 4.4 DTOs (records Java 21)

- Requêtes : `DeclarePartnerRequest(@NotNull Long partnerId)`,
  `JoinNetworkRequest(@NotBlank String code)`,
  `UpdateSharingRequest(boolean activity, boolean flockHealth, boolean feedConsumption, boolean salesVolume, boolean finances)`.
- Réponses : `AvailablePartnerResponse(...)`, `FarmPartnerResponse(membershipId, partnerId, partnerName, partnerType, status, origin, shareActivity, shareFlockHealth, shareFeedConsumption, shareSalesVolume, shareFinances)`.

## 5. Frontend web (Next.js / MUI v9)

Nouvelle route `web/src/app/(dashboard)/reglages/partenaires/` — « Mes partenaires / Mon
réseau ». Slice RTK Query `partnersApi` (endpoints : `getAvailablePartners`, `getMyPartners`,
`declarePartner`, `joinNetwork`, `updateSharing`, `leaveNetwork`). Entrée de menu ajoutée sous
Réglages.

- **État vide** : « Vous ne faites partie d'aucun réseau. » + `[Rejoindre par code]` +
  `[Parcourir les partenaires]`.
- **Liste des adhésions** : une carte par adhésion — nom, badge type (Provendier /
  Vétérinaire), chip statut (⏳ En attente / ✓ Confirmé), **curseurs de partage** (5 toggles
  groupés **Opérationnel** [activity, flock_health, feed_consumption] vs **Commercial &
  Finances** [sales_volume, finances], finances OFF par défaut, copy d'avertissement sur le
  groupe finances), `[Quitter le réseau]` (dialog de confirmation).
- **Annuaire** (dialog) : partenaires ACTIVE, filtre par type, `[Déclarer]`.
- **Code** (dialog) : champ texte + submit ; 422 → message clair (code inconnu/expiré/épuisé).

UX du consentement : les toggles écrivent immédiatement (PUT `/scopes`) avec retour optimiste
et rollback sur erreur. Réglages réservés OWNER/MANAGER ; un membre en lecture voit l'état mais
les contrôles d'écriture sont désactivés (le backend reste l'autorité via `hasRole`).

## 6. Frontend mobile (Expo / React Native)

Écran `mobile/app/(field)/reglages/partenaires.tsx` en miroir des flux web, design bold du
design-system. Même slice/api (client mobile). Gates = `tsc` + `jest` (patrons RNTL 14 :
`render`/`renderHook` async, `act()` après `fireEvent.press`, imports relatifs des écrans,
pas de parenthèses `(field)`/`(tabs)` dans les filtres de nom jest).

## 7. Flux de données

Éleveur (OWNER/MANAGER) → écran web/mobile → RTK Query / client api →
`/api/v1/farms/{farmId}/partners/*` → gate `@farmAccess` → `FarmerPartnerController` →
`PartnerNetworkService` (variantes farm-scoped) / `PartnerService` (annuaire) → repositories.
Les booléens de scope stockés sur l'adhésion sont la **frontière de confiance** consommée plus
tard par le portail partenaire.

## 8. Gestion des erreurs

| Cas | HTTP | Origine |
|---|---|---|
| Code inconnu / inactif / expiré / épuisé | 422 | `InviteCodeInvalidException` |
| Ferme déjà dans le réseau de ce partenaire | 409 | `DuplicateMembershipException` |
| Adhésion/partenaire absent, ou adhésion d'une autre ferme | 404 | `NotFoundException` |
| Non-membre de la ferme, ou rôle insuffisant | 403 | gate `@farmAccess` |

Le front localise ces cas en messages éleveur clairs (FR).

## 9. Tests

- **Backend** — `FarmerPartnerControllerTest` (DB-less, `@SpringBootTest` + profil `test`,
  patron `SecurityE2ETest` pour les `@MockitoBean`, token forgé via `jwtService`) :
  OWNER 200 · non-membre 403 · **wrong-farm 404** (garde d'appartenance) · declare happy ·
  join happy · 422 code invalide · 409 doublon · toggles scopes. Test service pour
  `updateSharingScopesForFarm` / `leaveForFarm` (match + mismatch) et pour `partnersForFarm`
  enrichi (nom/type résolus). **Aucun nouveau repository** → pas de nouveau `@MockitoBean` à
  câbler dans les contextes DB-less.
- **Web** — tests du slice `partnersApi` + composants clés (état vide, carte adhésion, dialogs)
  selon les conventions web.
- **Mobile** — jest (tsc + jest) sur l'écran et ses interactions.

## 10. Isolation / limites

- `FarmerPartnerController` : une seule responsabilité (surface éleveur), gates uniformes,
  ne connaît que `PartnerNetworkService` + `PartnerService`.
- Les gardes farm-scoped restent **dans le service** (frontière de confiance non contournable).
- Aucun couplage cross-contexte nouveau : le contexte `partner` reste autonome (référence
  `farms`/`users` par ID) ; la surface éleveur vit dans le contexte `partner`, exposée sous le
  chemin `/api/v1/farms/{farmId}/**` uniquement pour l'uniformité des gates.

## 11. Prochaines étapes

Invoquer `writing-plans` pour produire le plan d'implémentation task-by-task (backend →
web → mobile), en TDD, sur la branche `feat/partner-farmer-surfaces`.
