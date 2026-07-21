# B7 — Journal de recette « mode avion »

> **Statut : NON EXÉCUTÉ.** Ce scénario est la recette d'acceptation
> end-to-end de `01-roadmap-v1.md` § B7. Il DOIT être joué à la main sur un
> **appareil physique** (Expo Go), en basculant réellement le mode avion et en
> tuant/relançant l'app — ce qu'aucun test automatisé ne peut simuler. Les
> cases restent décochées tant qu'un testeur ne l'a pas exécuté. Ne pas
> cocher sans l'avoir réellement fait.

## Contexte de la recette

| Champ | Valeur |
|---|---|
| Testeur | _(à remplir)_ |
| Date | _(à remplir)_ |
| Appareil / OS | _(ex. Samsung A14 / Android 14, ou iPhone 12 / iOS 18)_ |
| Version Expo Go | _(à remplir)_ |
| Backend visé | _(URL de l'API — local, staging…)_ |
| Compte éleveur | _(email du compte de terrain OWNER/MANAGER/FARMER)_ |

## Scénario

- [ ] **Étape 1** — Installer l'app, se connecter, sélectionner ferme puis lot.
      ✅ attendu : les essentiels du lot s'affichent (effectif, âge, race).
- [ ] **Étape 2** — Activer le mode avion.
- [ ] **Étape 3** — Saisir 5 mortalités sur un lot **chair** (5 appuis « +1 » puis
      « Enregistrer », ou 5 saisies selon l'écran).
      ✅ attendu : le compteur du jour affiche 5 ; la barre indique
      « 1 action en attente de sync » — **un seul upsert journalier, pas cinq**.
- [ ] **Étape 4** — Saisir une pesée et une collecte d'œufs.
      ✅ attendu : « 3 actions en attente de sync ».
- [ ] **Étape 5** — Tuer l'app, la relancer, toujours en mode avion.
      ✅ attendu : les 3 actions sont toujours en file — c'est le test de
      **durabilité SQLite**.
- [ ] **Étape 6** — Désactiver le mode avion.
      ✅ attendu : la file se vide seule, la barre passe à « Tout est synchronisé ».
- [ ] **Étape 7** — Vérifier côté **web** que l'effectif du lot a baissé de 5,
      **exactement une fois**.
- [ ] **Étape 8** — Couper le réseau au milieu d'un drain, le rétablir.
      ✅ attendu : aucun doublon (c'est la clé `client_ref` de la Tâche 2 qui est
      éprouvée ici — mortalité et pesée dédupliquent le rejeu côté serveur).
- [ ] **Étape 9** — Consigner les résultats ci-dessous et commiter ce journal.

## Résultats

_(à remplir après exécution : capture des écrans clés, effectif web avant/après,
anomalies éventuelles.)_

---

## Ce que les tests automatisés dérisquent déjà

Cette recette manuelle confirme l'assemblage bout-en-bout ; les invariants
qu'elle éprouve sont chacun déjà couverts par un test qui tourne en CI :

| Étape | Invariant | Couverture automatisée |
|---|---|---|
| 3 | 5 mortalités chair = **un** upsert (cumul local) | `src/field/__tests__/dailyAccumulator.test.ts` |
| 3–4 | chaque écran met **une** entrée en file, avec sa clé | `app/(field)/lots/[unitId]/__tests__/{mortalite,pesee,oeufs}.test.tsx` |
| 4 | pesée : liste de poids intacte après round-trip file | `pesee.test.tsx` (JSON ↔ SQLite) |
| 4 | œufs : re-saisie d'un créneau = remplacement, pas empilement | `oeufs.test.tsx` |
| 5 | file durable (survit au redémarrage) | `src/sync/__tests__/queue.test.ts` |
| 6 | drain vide la file au retour réseau | `src/sync/__tests__/engine.test.ts` |
| 7–8 | pas de doublon au rejeu (idempotence `client_ref`) | mortalité/pesée : `client_ref` porté dans le payload + dédup serveur (backend Tâche 2, migration V30) ; ITs livestock |
| 6 | barre de statut : compteur juste, à corriger vs en attente | `src/components/__tests__/SyncStatusBar.test.tsx` |
| 8 | 5xx rejouable / 4xx terminal | `src/sync/__tests__/engine.test.ts` |

Reste à confirmer **manuellement** ce qu'aucun harnais ne reproduit : la
bascule réelle du mode avion, la persistance à travers un vrai kill/restart du
process, et la vérification croisée de l'effectif côté application web.
