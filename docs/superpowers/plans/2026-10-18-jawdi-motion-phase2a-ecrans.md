# Jawdi Motion — Phase 2A : la bibliothèque d'écrans

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la bibliothèque d'écrans Jawdi — web et mobile — en composants React animables, fidèles au produit réel et nourris de données fictives, pour que les chapitres 02 à 07 et tous les films suivants n'aient plus qu'à les monter.

**Architecture:** Deux moitiés. D'abord les **références** : on démarre la vraie pile en local, on y crée une ferme fictive par l'API, et on photographie les écrans web avec Playwright ; les écrans mobiles sont déjà photographiés (13 captures iPhone réelles). Ensuite la **reconstruction** : chaque écran devient un composant React dans `src/ecrans/`, décomposable en couches pour l'animation, alimenté par `src/donnees/ferme.ts`. La fidélité se vérifie par des tests qui comparent la structure (bandes de mise en page, palette) et les libellés réels — jamais par superposition au pixel, puisqu'un composant animable n'est pas une copie.

**Tech Stack:** Remotion 4 + React 19 + TypeScript (dépôt `jawdi-motion`) ; Playwright pour les captures ; la pile `avicare-platform` en local (Docker Compose, Spring Boot, Next.js) pour les produire.

**Spec:** `docs/superpowers/specs/2026-10-18-jawdi-motion-film-presentation-design.md`

**Dépend de :** la phase 1 (`2026-10-18-jawdi-motion-phase1-pilote.md`), livrée. Ce plan est **insensible à la porte du pilote** : un écran reconstruit reste valable quel que soit le langage de mouvement retenu.

## Global Constraints

- **Dépôt** : `/Users/mac/Developer/jawdi-motion`. Rien de ce plan ne modifie `avicare-platform`.
- **Format** : composants conçus pour 1920×1080, mais **sans dimension codée en dur** : chaque écran accepte une largeur et s'échelonne, parce que les extraits verticaux les reprendront.
- **Couleurs** : uniquement les jetons de `src/jetons.ts` (`#0C4434`, `#3B8B3D`, `#F2A31A`, `#926234`, `#FAFAF9`, `#1C1917`) et les neutres du design system de la plateforme (`docs/10-design-system.md` §2). Aucune couleur relevée à l'œil sur une capture.
- **Typographie** : Outfit (interface) et JetBrains Mono (données et montants), par `pileDePolice`.
- **Données** : toutes les valeurs viennent de `src/donnees/ferme.ts`. **Aucune donnée de la ferme pilote réelle**, aucun chiffre commercial, aucun nom d'exploitation existante.
- **Libellés** : un écran ne dit que ce que le produit dit. Les libellés sont relevés dans le code réel (`web/src/app/(dashboard)/`, `mobile/app/(field)/`) et consignés dans `src/donnees/libelles.ts`.
- **Marques de tiers** : aucune interface d'Apple, de Meta ou d'un navigateur n'est redessinée. Le cadre de navigateur est neutre, avec l'adresse ; le cadre de téléphone est générique.
- **Nommage du code en français**, comme en phase 1.
- **Commits** : Conventional Commits, scope `ecrans` ou `references`.

## Review Focus

Cinq défaillances que le dossier implique et qu'aucune étape ne couvrirait sans l'ajouter.

1. **Un écran dit un libellé que le produit ne dit pas.** Le film affirmerait une fonctionnalité qui n'existe pas — et c'est le premier endroit où un associé technique ira vérifier. → test en Tâche 3.
2. **Une donnée réelle fuit dans une capture de référence.** Les captures sont produites contre une vraie base : si la ferme de référence n'est pas la ferme fictive, des données d'exploitation entrent dans le dépôt. → test en Tâche 1.
3. **Le texte d'interface est illisible à la taille d'un téléphone.** Les extraits verticaux reprendront ces écrans ; un tableau dense y devient une bouillie grise. → test en Tâche 2.
4. **Une couleur hors palette entre par recopie à l'œil.** Le film cesse d'être la marque sans que personne ne le voie. → test en Tâche 2.
5. **Un écran casse quand la donnée fictive change** — un libellé plus long déborde sa carte, un montant à cinq chiffres passe à la ligne. → test en Tâche 4.

---

## Structure de fichiers

| Fichier | Responsabilité |
|---|---|
| `outils/references/pile-locale.md` | la marche à suivre pour démarrer la pile et semer la ferme fictive |
| `outils/references/semer-ferme-fictive.py` | crée la ferme du film par l'API locale |
| `outils/references/capturer-web.ts` | photographie les écrans web avec Playwright |
| `references/web/*.png` | les captures web (données fictives), **référence de rendu** |
| `references/mobile/*.PNG` | les 13 captures iPhone réelles, copiées depuis la plateforme |
| `references/INVENTAIRE.md` | quel écran pour quel chapitre, et d'où vient chaque capture |
| `src/donnees/libelles.ts` | **pur** — les libellés réels relevés dans le produit |
| `src/donnees/navigation.ts` | **pur** — les entrées de menu web et les onglets mobiles réels |
| `src/ecrans/CadreNavigateur.tsx` | cadre de navigateur neutre (adresse, pas Chrome) |
| `src/ecrans/CadreTelephone.tsx` | cadre de téléphone générique + barre d'état |
| `src/ecrans/web/CoquilleWeb.tsx` | la coquille de l'app : barre latérale, en-tête, zone de contenu |
| `src/ecrans/web/{Elevage,Sanitaire,Stock,Commercial,Finance,Bilans}.tsx` | les six écrans du chapitre 03 |
| `src/ecrans/web/TableauDeBord.tsx` | le tableau de bord — la cible du chapitre 02 |
| `src/ecrans/mobile/CoquilleMobile.tsx` | la coquille mobile : en-tête, onglets du bas |
| `src/ecrans/mobile/{SaisieJournaliere,FileDeSynchro}.tsx` | les deux écrans du chapitre 02 |
| `src/ecrans/mobile/{Lots,Oeufs,Sanitaire,Commerce}.tsx` | les écrans mobiles du chapitre 03 |
| `src/ecrans/couches.ts` | **pur** — nomme les couches animables d'un écran (fond, cartes, lignes, accent) |
| `tests/ecrans/*.test.ts` | fidélité, lisibilité, palette, robustesse |

---

### Task 1 : La pile locale, la ferme fictive, et les captures web

**Files:**
- Create: `outils/references/pile-locale.md`, `outils/references/semer-ferme-fictive.py`, `outils/references/capturer-web.ts`
- Create: `references/web/` (sorties), `references/mobile/` (copies), `references/INVENTAIRE.md`
- Modify: `package.json` (dépendance `playwright`, script `references`)
- Test: `tests/references.test.ts`

**Interfaces:**
- Consumes: `analyserPng`, `boiteDuContenu` (phase 1, `outils/rendu/image-cle.ts`).
- Produces: `references/web/<ecran>.png` pour chaque identifiant de `ECRANS_WEB` ; et, depuis `outils/references/inventaire.ts` : `ECRANS_WEB: string[]`, `ECRANS_MOBILE: string[]`, `inventaire(): { ecran: string; chapitre: string; source: 'capture-web' | 'capture-iphone' }[]`, `referenceDe(id: string): string | undefined` (le chemin de la capture).

- [ ] **Step 1 : Démarrer la pile et semer la ferme fictive**

```bash
cd /Users/mac/Developer/avicare-platform && make up          # Postgres 5434, Redis 6380
cd /Users/mac/Developer/avicare-platform && make backend-run # attendre /actuator/health → UP
cd /Users/mac/Developer/avicare-platform/web && npm run dev  # port 3000
```

`semer-ferme-fictive.py` reprend la démarche de `scripts/seed-app-store-demo.py` de la plateforme (inscription, ferme, achat d'aliment, saisies journalières, une bande clôturée avec sa marge, une bande en cours, une vente, une facture, un paiement, une visite véto) mais avec **l'identité de `src/donnees/ferme.ts`** et contre `http://localhost:8080`. Il échoue bruyamment sur le premier 4xx/5xx : rien ici ne doit être relancé à l'aveugle.

**Si la pile refuse de démarrer**, se replier sur les routes simulées : la configuration Playwright de la plateforme (`web/playwright.config.ts`) dit que chaque appel `/api/v1/*` y est déjà simulé au niveau du navigateur, et `web/e2e/*.spec.ts` en donne le motif. Consigner le repli dans `references/INVENTAIRE.md` — une capture faite sur données simulées n'a pas la même valeur de preuve qu'une capture faite sur la vraie API.

- [ ] **Step 2 : Écrire le test qui échoue**

```ts
// tests/references.test.ts
import { ECRANS_WEB, ECRANS_MOBILE, inventaire } from '../outils/references/inventaire';

test('chaque écran dont le film a besoin a sa référence', () => {
  for (const e of [...ECRANS_WEB, ...ECRANS_MOBILE]) expect(existsSync(cheminDeReference(e))).toBe(true);
});

test('aucune référence n’est une image vide', async () => {
  for (const e of ECRANS_WEB) await expect(analyserPng(readFileSync(cheminDeReference(e)))).resolves.toBeUndefined();
});

test('les captures web sont assez grandes pour servir de référence', () => {
  for (const e of ECRANS_WEB) expect(dimensionsDe(e).largeur).toBeGreaterThanOrEqual(1440);
});

// Défaillance n°2 : une donnée réelle qui fuit
test('aucune référence ne porte le nom d’une ferme réelle', () => {
  expect(JSON.stringify(inventaire())).not.toMatch(/maurice/i);
  for (const e of ECRANS_WEB) expect(texteDe(e)).toContain(ferme.nom);
});
```

`texteDe` lit le texte capturé à côté de chaque PNG : `capturer-web.ts` écrit un `.txt` frère contenant le texte visible de la page, précisément pour que ce test existe sans OCR.

- [ ] **Step 3 : Lancer et vérifier l'échec**

Run: `npx vitest run tests/references.test.ts`
Expected: FAIL — `outils/references/inventaire` introuvable.

- [ ] **Step 4 : Implémenter**

- `outils/references/inventaire.ts` : exporte `ECRANS_WEB` (`tableau-de-bord`, `elevage-lots`, `elevage-lot`, `sanitaire`, `stock`, `commercial-vente`, `finance`, `bilans`) et `ECRANS_MOBILE` (les huit captures déjà légendées dans `scripts/build-app-store-screenshots.py` de la plateforme), plus `inventaire()` qui dit pour chaque écran son chapitre et sa provenance.
- `outils/references/capturer-web.ts` : lance Chromium par Playwright en 1600×1000, se connecte avec le compte fictif, visite chaque route, attend la fin du chargement, écrit `references/web/<ecran>.png` **et** `<ecran>.txt` (le texte visible).
- Copier les 13 PNG de `docs/brand/screen/` vers `references/mobile/`.
- `references/INVENTAIRE.md` : le tableau écran → chapitre → provenance → date.

- [ ] **Step 5 : Lancer, vérifier le succès, et REGARDER trois captures**

Run: `npx vitest run tests/references.test.ts` → PASS
Puis ouvrir `tableau-de-bord.png`, `elevage-lots.png` et `commercial-vente.png` : si la donnée y est vide ou absurde, c'est le semis qu'il faut corriger, pas la capture.

- [ ] **Step 6 : Commettre**

```bash
git add -A && git commit -m "feat(references): captures des écrans web sur ferme fictive, et inventaire"
```

---

### Task 2 : Les cadres, la coquille web, et les règles qui tiennent tous les écrans

**Files:**
- Create: `src/ecrans/CadreNavigateur.tsx`, `src/ecrans/CadreTelephone.tsx`, `src/ecrans/web/CoquilleWeb.tsx`, `src/ecrans/couches.ts`
- Create: `src/donnees/navigation.ts`
- Modify: `src/compositions.ts`, `src/Root.tsx` (composition `EcranTemoin`)
- Test: `tests/ecrans/coquille.test.ts`, `tests/ecrans/palette.test.ts`

**Interfaces:**
- Consumes: `jetons`, `pileDePolice`, `ferme` (phase 1).
- Produces: `type ProprietesDEcran = { largeur: number; avancement: number }` — **le contrat commun à tous les écrans de la bibliothèque** ; `<CadreNavigateur adresse largeur>`, `<CadreTelephone largeur horsLigne?>`, `<CoquilleWeb entreeActive largeur>{contenu}</CoquilleWeb>`, `type Couche = 'fond' | 'cartes' | 'lignes' | 'accent'`, `estAnimable(couche)`, et `MENU_WEB` / `ONGLETS_MOBILE` (les entrées réelles, relevées dans le code du produit).

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
// tests/ecrans/palette.test.ts — défaillance n°4
test('aucun écran n’introduit une couleur hors palette', async () => {
  const couleurs = await couleursDe('EcranTemoin', 1);
  for (const c of couleurs) expect(estDansLaPalette(c), c).toBe(true);
});
```

```ts
// tests/ecrans/coquille.test.ts — défaillance n°3
test('le texte de la coquille reste lisible à la taille d’un téléphone', async () => {
  // Réduit au tiers (la bande utile d’un 9:16), aucun texte ne doit tomber
  // sous 14 px d’équivalent écran.
  expect(await plusPetitTexteRendu('EcranTemoin', { largeur: 640 })).toBeGreaterThanOrEqual(14);
});

test('la barre latérale porte les vraies entrées du produit', () => {
  expect(MENU_WEB.map((e) => e.libelle)).toEqual([
    'Tableau de bord', 'Élevage', 'Stocks', 'Commercial', 'Finance', 'Réglages',
  ]);
});

test('le cadre de navigateur ne redessine aucune marque', () => {
  const html = rendreEnChaine(<CadreNavigateur adresse="app.jawdi.app" largeur={1600} />);
  expect(html).not.toMatch(/chrome|safari|firefox/i);
  expect(html).toContain('app.jawdi.app');
});
```

`couleursDe` et `plusPetitTexteRendu` sont de nouvelles aides dans `tests/aides/` : la première échantillonne les couleurs d'une image rendue et les arrondit ; la seconde mesure la hauteur des glyphes par analyse des bandes de contenu.

- [ ] **Step 2 : Lancer et vérifier l'échec**

Run: `npx vitest run tests/ecrans` → FAIL (modules introuvables)

- [ ] **Step 3 : Implémenter**

- `src/donnees/navigation.ts` : relever les entrées **dans le code réel** — `web/src/app/(dashboard)/layout.tsx` pour le menu, `mobile/app/(field)/(tabs)/_layout.tsx` pour les onglets. Ne pas les inventer.
- `src/ecrans/couches.ts` : le vocabulaire de décomposition, pour que les chapitres puissent séparer un écran en couches et les faire bouger indépendamment (parallaxe).
- `CoquilleWeb` : barre latérale, en-tête avec le nom de la ferme, zone de contenu. Mise à l'échelle par la propriété `largeur` — **aucune valeur en pixels figée** hors de la maquette de base.
- `CadreNavigateur` : trois pastilles neutres, une barre d'adresse, un coin arrondi. `CadreTelephone` : encoche, barre d'état avec l'heure et, en option, le mode avion.
- `EcranTemoin` : une composition qui monte la coquille avec du contenu factice, uniquement pour les tests ci-dessus.

- [ ] **Step 4 : Lancer, vérifier le succès, rendre et regarder**

Run: `npx vitest run tests/ecrans` → PASS
Puis rendre `EcranTemoin` en image clé et la **comparer côte à côte** avec `references/web/tableau-de-bord.png` : mêmes bandes, même densité, même poids visuel.

- [ ] **Step 5 : Commettre**

---

### Task 3 : Les trois écrans web du métier d'élevage

**Files:**
- Create: `src/ecrans/web/TableauDeBord.tsx`, `src/ecrans/web/Elevage.tsx`, `src/ecrans/web/Sanitaire.tsx`
- Create: `src/donnees/libelles.ts`
- Modify: `src/compositions.ts`, `src/Root.tsx`
- Test: `tests/ecrans/elevage.test.ts`, `tests/ecrans/libelles.test.ts`

`src/donnees/libelles.ts` exporte `LIBELLES` (tous les libellés d'interface relevés dans le produit) et, parmi eux, `LIBELLES_FILE` — ceux de la file de synchronisation, dont la tâche 6 a besoin.

**Interfaces:**
- Consumes: `CoquilleWeb`, `MENU_WEB`, `Couche` (T2) ; `ferme`, `chiffresEnquete` (phase 1) ; les captures de T1.
- Produces: `<TableauDeBord largeur avancement>`, `<Elevage …>`, `<Sanitaire …>` — chacun accepte `avancement: number` (0→1) pour que les chapitres animent l'arrivée de ses couches.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
// tests/ecrans/libelles.test.ts — défaillance n°1 : le film invente un libellé
import { LIBELLES } from '../../src/donnees/libelles';

test('chaque libellé affiché existe dans le code du produit', () => {
  const source = sourceDuProduit(); // concatène web/src/app/(dashboard) et mobile/app/(field)
  for (const l of Object.values(LIBELLES)) expect(source, l).toContain(l);
});
```

```ts
// tests/ecrans/elevage.test.ts
test('le tableau de bord montre le cheptel, la mortalité du jour et la marge', async () => {
  const texte = await texteRendu('TableauDeBord');
  expect(texte).toContain(String(ferme.bandes[1].effectif));
  expect(texte).toMatch(/mortalité/i);
});

test('la courbe de poids a autant de points que de semaines de la bande', () => {
  expect(pointsDeLaCourbe(ferme.bandes[0])).toHaveLength(Math.ceil(ferme.bandes[0].dureeJours / 7));
});

test('les montants sont en XOF entiers, sans décimale', async () => {
  for (const m of montantsRendus('TableauDeBord')) expect(m).not.toMatch(/[.,]\d/);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter, vérifier le succès**

`LIBELLES` se remplit en **lisant** `web/src/app/(dashboard)/dashboard/page.tsx`, `elevage/lots/page.tsx` et `elevage/sanitaire/page.tsx`. Chaque écran se construit en regardant sa capture de référence, pas de mémoire.

- [ ] **Step 3 : Rendre les trois écrans en image clé et les comparer à leurs captures**

- [ ] **Step 4 : Commettre**

---

### Task 4 : Les trois écrans web du commerce et de l'argent

**Files:**
- Create: `src/ecrans/web/Stock.tsx`, `src/ecrans/web/Commercial.tsx`, `src/ecrans/web/Finance.tsx`
- Modify: `src/donnees/libelles.ts`, `src/compositions.ts`, `src/Root.tsx`
- Test: `tests/ecrans/commerce.test.ts`

**Interfaces:**
- Consumes: T2, T3 (`LIBELLES`).
- Produces: `<Stock …>`, `<Commercial …>`, `<Finance …>`, même contrat `largeur` / `avancement`.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
// tests/ecrans/commerce.test.ts — défaillance n°5 : la donnée change, l'écran casse
test.each([
  { libelle: 'Sac de démarrage 50 kg', montant: 21_500 },
  { libelle: 'Un libellé d’article volontairement très long pour éprouver la carte', montant: 1_250_000 },
])('la carte tient avec « $libelle »', async ({ libelle, montant }) => {
  const b = await boiteDeLaCarte('Stock', { libelle, montant });
  expect(b.droite).toBeLessThanOrEqual(b.carteDroite);
  expect(b.bas).toBeLessThanOrEqual(b.carteBas);
});

test('la vente au kilo affiche un poids et un prix au kilo', async () => {
  const texte = await texteRendu('Commercial');
  expect(texte).toMatch(/kg/);
  expect(texte).toContain('2 200');
});

test('aucun écran ne montre de TVA', async () => {
  for (const e of ['Stock', 'Commercial', 'Finance']) expect(await texteRendu(e)).not.toMatch(/TVA/i);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter, vérifier le succès**

- [ ] **Step 3 : Rendre, comparer aux captures, commettre**

---

### Task 5 : Bilans, et l'inventaire qui prouve que la bibliothèque est complète

**Files:**
- Create: `src/ecrans/web/Bilans.tsx`
- Create: `src/ecrans/index.ts` (le registre des écrans)
- Test: `tests/ecrans/inventaire.test.ts`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: depuis `src/ecrans/index.ts` : `ecransDisponibles(): string[]`, `ecransMobiles(): string[]`, `ecran(id: string): React.FC<ProprietesDEcran>` (le type vient de T2), et `ecransDuDomaine(domaine: string): { web?: string; mobile?: string }` — c'est par là que les chapitres de la phase 2B prendront leurs écrans.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
test('chaque écran promis par le dossier existe dans la bibliothèque', () => {
  for (const id of ECRANS_WEB) expect(ecransDisponibles()).toContain(id);
});

test('chaque écran accepte le même contrat', () => {
  for (const id of ecransDisponibles()) {
    expect(() => rendreEnChaine(ecran(id)({ largeur: 1600, avancement: 0.5 }))).not.toThrow();
  }
});

test('le compte de résultat de bande montre une marge positive sur la bande clôturée', async () => {
  expect(await texteRendu('Bilans')).toContain('312 000');
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter, vérifier le succès, commettre**

---

### Task 6 : La coquille mobile et les deux écrans du chapitre 02

**Files:**
- Create: `src/ecrans/mobile/CoquilleMobile.tsx`, `src/ecrans/mobile/SaisieJournaliere.tsx`, `src/ecrans/mobile/FileDeSynchro.tsx`
- Modify: `src/donnees/navigation.ts`, `src/ecrans/index.ts`, `src/compositions.ts`, `src/Root.tsx`
- Test: `tests/ecrans/mobile-saisie.test.ts`

**Interfaces:**
- Consumes: `CadreTelephone` (T2), `ONGLETS_MOBILE`, `ferme`.
- Produces: `<SaisieJournaliere etape avancement>` où `etape ∈ 'vide' | 'saisi' | 'valide'`, et `<FileDeSynchro enAttente>` où `enAttente` est le nombre d'éléments restants.

- [ ] **Step 1 : Écrire les tests qui échouent**

```ts
// tests/ecrans/mobile-saisie.test.ts
test('les onglets du bas sont ceux du produit', () => {
  expect(ONGLETS_MOBILE.map((o) => o.libelle)).toEqual(['Accueil', 'Lots', 'Sanitaire', 'Stocks', 'Menu']);
});

test('la saisie journalière demande la mortalité, l’aliment et l’eau', async () => {
  const texte = await texteRendu('SaisieJournaliere');
  for (const champ of ['Mortalité', 'Aliment', 'Eau']) expect(texte).toContain(champ);
});

test('le mode avion est visible quand on saisit hors ligne', async () => {
  expect(await texteRendu('SaisieJournaliere', { horsLigne: true })).toMatch(/hors ligne|avion/i);
});

test('la file se vide : trois éléments, puis zéro', async () => {
  expect(await compterLignes('FileDeSynchro', { enAttente: 3 })).toBe(3);
  expect(await compterLignes('FileDeSynchro', { enAttente: 0 })).toBe(0);
});

test('la file montre ce que le produit montre, pas une invention', () => {
  // Le dossier l'exige : « la file doit être montrée telle qu'elle est ».
  const source = lireSourceMobile('app/(field)/file.tsx');
  for (const l of LIBELLES_FILE) expect(source, l).toContain(l);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter, vérifier le succès**

La fidélité se vérifie contre `references/mobile/IMG_6458.PNG` (« Votre journée enregistrée en 30 secondes — même sans connexion »), qui est exactement cet écran.

- [ ] **Step 3 : Rendre les trois états de la saisie et les regarder, puis commettre**

---

### Task 7 : Les quatre écrans mobiles du chapitre 03

**Files:**
- Create: `src/ecrans/mobile/{Lots,Oeufs,Sanitaire,Commerce}.tsx`
- Modify: `src/ecrans/index.ts`, `src/compositions.ts`, `src/Root.tsx`, `references/INVENTAIRE.md`
- Test: `tests/ecrans/mobile-domaines.test.ts`

**Interfaces:**
- Consumes: T6.
- Produces: quatre écrans au même contrat, référencés dans `ecransDisponibles()`.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
test('chaque domaine du chapitre 03 a son écran mobile ET son écran web', () => {
  for (const d of ['elevage', 'sanitaire', 'stock', 'commercial', 'finance', 'bilans']) {
    expect(ecransDuDomaine(d).web).toBeDefined();
  }
  for (const d of ['elevage', 'sanitaire', 'oeufs', 'commercial']) {
    expect(ecransDuDomaine(d).mobile).toBeDefined();
  }
});

test('chaque écran mobile a sa capture de référence', () => {
  for (const id of ecransMobiles()) expect(referenceDe(id)).toBeDefined();
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter, vérifier le succès**

Références : `IMG_6453` (lots), `IMG_6455` (ponte), `IMG_6456` (vaccins), `IMG_6457` (vente).

- [ ] **Step 3 : Rendre les quatre écrans, les regarder, mettre `INVENTAIRE.md` à jour, commettre**

---

### Task 8 : La passe de fidélité, et le verrou qui empêche la bibliothèque de dériver

**Files:**
- Create: `outils/references/comparer.ts`
- Modify: `ETAT.md`
- Test: `tests/ecrans/fidelite.test.ts`

**Interfaces:**
- Consumes: tout.
- Produces: `comparerStructure(ecran, reference): { bandes: number; ecartMaximal: number }` — compare les bandes horizontales de contenu entre le composant rendu et sa capture.

- [ ] **Step 1 : Écrire le test qui échoue**

```ts
test.each(ecransDisponibles())('la structure de %s suit sa référence', async (id) => {
  // Pas une superposition au pixel : un composant animable n'est pas une copie.
  // On compare le NOMBRE de bandes de contenu et leur position relative.
  const r = await comparerStructure(id, referenceDe(id));
  expect(r.ecartMaximal).toBeLessThan(0.12); // 12 % de la hauteur
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec, implémenter, vérifier le succès**

Un écart supérieur à 12 % veut dire que la reconstruction a pris une autre mise en page que le produit — il faut corriger le composant, **jamais** le seuil.

- [ ] **Step 3 : Écrire la passe de fidélité dans `ETAT.md`**

Pour chaque écran : sa capture de référence, la date, et **« rendu et comparé »** ou **« rendu, pas encore comparé »**. Ne jamais gonfler cette ligne.

- [ ] **Step 4 : Lancer les deux suites, commettre, pousser**

```bash
npx vitest run && npx tsc --noEmit && (cd outils/son && python3 -m unittest test_mesurer_tempo)
git add -A && git commit -m "feat(ecrans): passe de fidélité et verrou de structure"
git push origin main
```

---

## Les aides de test

Les tests ci-dessus appellent des aides (`texteRendu`, `montantsRendus`, `compterLignes`,
`boiteDeLaCarte`, `couleursDe`, `plusPetitTexteRendu`, `rendreEnChaine`, `sourceDuProduit`,
`lireSourceMobile`, `pointsDeLaCourbe`, `dimensionsDe`, `texteDe`, `cheminDeReference`,
`comparerStructure`). Elles vivent dans `tests/aides/`, au-dessus de `rendreImageCle`,
`rendreImageBrute`, `boiteDuContenu` et `grappesHorizontales` livrés en phase 1. Chacune est
créée par la **première** tâche qui en a besoin ; aucune tâche ne les possède en propre.

## Ce qui est laissé au constructeur

- La **mise en page fine** de chaque écran : combien de cartes, quelle densité de tableau, quels KPI mis en avant — en suivant la capture, pas une idée.
- Le **découpage en couches** de chaque écran (ce qui bouge ensemble en parallaxe).
- Les **valeurs exactes** affichées, dans les contraintes de `ferme.ts`.
- Le choix entre capture sur vraie API et routes simulées, si la pile refuse de démarrer — à consigner.
- Le **dessin des icônes** d'interface (sobres, vectorielles, jamais générées par IA).

## Ce que ce plan ne fait PAS

- Aucun chapitre, aucun montage : c'est la phase 2B.
- Aucun format vertical : c'est la phase 2C.
- Aucun son.
- Aucune modification d'`avicare-platform` : la pile n'est que démarrée et lue.
