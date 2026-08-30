# Plan — Parité mobile, lot 1 : le socle

> Spec : `docs/superpowers/specs/2026-08-30-mobile-parity-design.md` (décisions verrouillées
> le 2026-08-30).
>
> Ce lot ne livre aucune fonctionnalité métier. Il livre ce sur quoi les sept lots suivants
> s'appuieront — le construire après, ce serait le reconstruire.

---

## Pourquoi ce lot existe

Trois choses rendraient les lots suivants coûteux ou dangereux si on ne les traitait pas
d'abord.

**Les primitives de saisie n'existent pas.** `touch.counterPrimary` (96 dp),
`touch.keypadKey` (64 dp), `layout.actionBarHeight` et `layout.thumbZoneRatio` sont
définis dans les tokens et référencés nulle part. La typographie `numeric` (64 dp, décrite
comme « le héros de tout écran de saisie ») ne sert à rien non plus. Les écrans de saisie
utilisent un `TextInput` ordinaire. Quinze nouveaux écrans écrits avant ces primitives,
ce sont quinze écrans à réécrire ensuite.

**La navigation a une étape d'enregistrement cachée.** Un écran de la pile `(field)` absent
de `SCREEN_TO_TAB` s'affiche **sans barre de navigation**. C'est ce mécanisme qui a laissé
`file.tsx` inatteignable pendant des mois. Sans garde automatique, le même oubli se
reproduira en série.

**La file hors-ligne ne connaît que quatre types de mutation utilisés.** La décision D1
en ajoute six. Chacun demande un libellé, une stratégie de `client_ref` et un test de
rejeu — c'est une mécanique, pas une improvisation par écran.

---

## Tâche 1 — `Counter`

`mobile/src/components/field/Counter.tsx`

Le compteur décrit par la direction de design §5, jamais construit.

```
┌─────────────────────────────────────┐
│  Mortalité du jour                  │
│                                     │
│   ┌───────┐    12    ┌───────┐      │  ← 64 dp mono
│   │   −   │          │   +   │      │  ← 96 dp chacun
│   └───────┘          └───────┘      │
│                                     │
│        appui long : ±10             │
└─────────────────────────────────────┘
```

**Contrat.** `value`, `onChange`, `step = 1`, `min = 0`, `max?`, `label`.

**Décisions à respecter :**
- Les pavés font `touch.counterPrimary` (96 dp) — « tapé des dizaines de fois de suite ».
- La valeur est en `typography.numeric`, pas en corps de texte.
- L'appui long incrémente par dix : sans lui, compter quarante morts est quarante appuis.
- `−` est **désactivé visuellement mais présent** à `min` : un bouton qui disparaît déplace
  le bouton voisin sous le doigt.
- Le retour haptique à chaque appui (`expo-haptics`, déjà mocké dans les tests).

**Tests :** incrément/décrément, plancher respecté, appui long, `max` respecté, le bouton
désactivé reste dans le flux.

---

## Tâche 2 — `NumericKeypad`

`mobile/src/components/field/NumericKeypad.tsx`

Le clavier intégré de la direction de design §2.4.

```
┌─────────────────────────────────────┐
│              1 240                  │  ← 64 dp mono
├─────────┬─────────┬─────────────────┤
│    1    │    2    │       3         │  ← 64 dp
├─────────┼─────────┼─────────────────┤
│    4    │    5    │       6         │
├─────────┼─────────┼─────────────────┤
│    7    │    8    │       9         │
├─────────┼─────────┼─────────────────┤
│    ,    │    0    │       ⌫         │
└─────────┴─────────┴─────────────────┘
```

**Contrat.** `value: string`, `onChange`, `maxLength`, `allowDecimal = false`.

**Pourquoi ne pas utiliser le clavier système.** Le clavier Android occupe la moitié de
l'écran, change de disposition d'un téléphone à l'autre, et ses touches sont sous la barre
de suggestion. Un clavier intégré tient dans la zone de pouce, garde ses touches au même
endroit, et laisse la valeur visible.

**Décisions à respecter :**
- Touches à `touch.keypadKey` (64 dp), écart `touch.gap`.
- La virgule est masquée quand `allowDecimal` est faux — pas désactivée, absente : une
  touche morte invite à appuyer.
- `⌫` efface un caractère ; l'appui long vide.
- Aucune valeur ne dépasse `maxLength`, silencieusement.

**Tests :** frappe, effacement, effacement long, virgule absente/présente, `maxLength`
respecté, décimale unique.

---

## Tâche 3 — `ActionBar`

`mobile/src/components/field/ActionBar.tsx`

**Contrat.** Un seul enfant, ancré en bas, hauteur `layout.actionBarHeight` (88 dp), fond
opaque pour que le contenu qui défile ne passe pas dessous.

**Décisions à respecter :**
- Un seul bouton `commit` par écran — la règle d'or de la direction de design. Le composant
  ne prend qu'un enfant, ce qui rend la règle structurelle plutôt que déclarative.
- Respecte l'inset bas (`useSafeAreaInsets`) : sur un téléphone à barre gestuelle, un bouton
  collé au bord est un bouton qu'on rate.

**Tests :** rendu de l'enfant, hauteur, inset appliqué.

---

## Tâche 4 — Garde de navigation

`mobile/src/constants/__tests__/navigationCoverage.test.ts`

Le test qui aurait attrapé `file.tsx`.

**Ce qu'il fait.** Parcourt `app/(field)/**`, dérive la route de chaque fichier d'écran,
et vérifie que chacune est atteignable par au moins un chemin :

1. présente dans `TAB_ITEMS`, ou
2. présente dans `DRAWER_ITEMS` (lu par le tiroir **et** par l'écran Menu), ou
3. présente dans `SCREEN_TO_TAB` — un écran de détail atteint depuis son parent, ou
4. listée dans une constante `INTENTIONALLY_UNLISTED` du test, **avec un commentaire
   justifiant chaque entrée**.

La quatrième porte n'est pas une échappatoire : elle rend l'exception visible et
argumentée, au lieu de laisser l'oubli silencieux.

**Cas connus à lister explicitement** : `(field)/index.tsx` (sélecteur de ferme, atteint
par redirection), les routes dynamiques `[unitId]`, `[id]`, `[category]`, `[clientId]`.

**Test du test :** retirer `file` de `SCREEN_TO_TAB` doit faire échouer la suite. Un test
de couverture qui ne peut pas échouer ne couvre rien.

---

## Tâche 5 — Extension de la file hors-ligne

Selon D1, six types rejoignent la file. Trois existent déjà dans l'énumération mais ne
sont utilisés que par l'assistant ; trois sont à créer.

| Type | État | Stratégie de `client_ref` |
|---|---|---|
| `VACCINATION` | existe, non utilisé par un écran | aléatoire |
| `HEALTH_OBSERVATION` | existe, non utilisé par un écran | aléatoire |
| `CREATE_CLIENT` | existe, non utilisé par un écran | aléatoire |
| `STOCK_ADJUSTMENT` | existe, non utilisé par un écran | aléatoire |
| `EXPENSE` | **à créer** | aléatoire |
| `TREATMENT` | **à créer** | aléatoire |

**Ce lot ne branche aucun écran dessus** — il prépare la mécanique et les libellés. Le
branchement se fait dans le lot du domaine concerné, avec son test de rejeu.

**Décisions à respecter :**
- Chaque type ajouté à `MutationKind` **doit** recevoir son libellé dans `KIND_LABELS`
  (`file.tsx`), sinon l'écran de file affiche `undefined` à un éleveur qui essaie de
  comprendre pourquoi sa saisie a échoué.
- Un test vérifie que `KIND_LABELS` couvre exhaustivement `MutationKind` — le type
  `Record<MutationKind, string>` l'impose déjà au compilateur, mais le test documente
  l'intention et survivra à un `Partial`.

---

## Tâche 6 — Les douze `tagTypes` manquants

`mobile/src/store/api/baseApi.ts`

`User`, `Permission`, `Setting`, `UnitEvent`, `Treatment`, `Veterinarian`, `VetVisit`,
`HealthProgram`, `HealthSchedule`, `StockMovement`, `Advance`, `Subscription`.

Aucun endpoint ne les utilise encore. Ils sont ajoutés maintenant parce qu'un `tagType`
absent fait échouer l'invalidation **silencieusement** : la mutation réussit, l'écran ne
se rafraîchit pas, et le bug ressemble à un problème de cache.

---

## Tâche 7 — Migrer `mortalite.tsx` sur les primitives

La preuve que les primitives tiennent en usage réel, et pas seulement en test.

`app/(field)/lots/[unitId]/mortalite.tsx` passe de son `TextInput` à
`Counter` + `ActionBar`. C'est l'écran le mieux testé du dépôt — son test vérifie déjà que
deux saisies produisent deux `clientRef` distincts et que le `clientRef` du payload et
celui de la ligne de file coïncident.

**Contrainte :** ces tests existants doivent continuer de passer **sans être réécrits pour
s'accommoder du nouveau composant**. S'ils doivent changer au-delà des sélecteurs, c'est
que la primitive a changé le comportement — et il faut s'arrêter.

---

## Critères d'acceptation

1. Les trois primitives existent, sont testées, et respectent les deux portes de contraste
   (WCAG AA **et** écart de luminance ≥ 0,75).
2. Le test de couverture de navigation passe — et échoue si l'on retire `file` de
   `SCREEN_TO_TAB`, vérifié en le cassant.
3. `KIND_LABELS` couvre `MutationKind`, testé.
4. `mortalite.tsx` fonctionne sur les nouvelles primitives, ses tests d'origine intacts.
5. `npx tsc --noEmit` propre ; suite mobile verte ; aucune régression sur les 238 tests
   existants.
6. Aucun écran métier nouveau — ce lot est un socle, pas une livraison fonctionnelle.

---

## Ce que ce lot ne fait pas

- Il ne branche aucun écran sur les nouveaux types de mutation.
- Il ne monte pas `SyncStatusBar` (reporté au lot 8, décision assumée dans la spec §7).
- Il ne touche ni au décodage de session, ni à la persistance, ni au moteur de
  synchronisation — trois morceaux délicats, documentés, qui fonctionnent.
