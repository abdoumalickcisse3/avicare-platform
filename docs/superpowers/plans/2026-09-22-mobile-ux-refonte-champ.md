# Refonte UX des écrans de terrain — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer, sur les 7 écrans de terrain mobiles déjà validés par maquette, les grilles de
cartes KPI bordées et les listes en cartes à ombre par une bande "ticket de caisse" partagée et des
listes à séparateurs fins — sans toucher aux données, à la navigation, ni aux couleurs/polices.

**Architecture:** Un seul composant partagé nouveau (`TicketRow`, 2 à 4 colonnes) consommé par les
8 écrans concernés. Chaque écran garde son état, ses requêtes RTK Query et ses actions à
l'identique ; seul le rendu de la zone "indicateurs groupés" et des listes change. Chaque tâche
produit un écran fonctionnel et testé, mergeable indépendamment des autres (1 PR par tâche).

**Tech Stack:** React Native (Expo SDK 57), expo-router, Jest + @testing-library/react-native,
tokens de `mobile/src/theme/tokens.ts` (aucun nouveau token).

**Spec:** `docs/superpowers/specs/2026-09-22-mobile-ux-refonte-champ-design.md`

## Global Constraints

- Aucune nouvelle couleur ni police : tout remplissage plein reprend `tokens.colors.primary[600]`
  (`#2E6B2E`, déjà utilisé sur les héros existants) ou `tokens.colors.accent[400]` (`#F8961E`,
  alerte/action) ; toute liste utilise `tokens.colors.neutral[100]`/`neutral[200]` pour les traits.
- Aucun nouveau composant de dépendance externe — `TicketRow` est un composant maison, comme tous
  les composants de `mobile/src/components/ui/`.
- Chaque tâche doit laisser `npx tsc --noEmit` propre et la suite Jest complète verte
  (`npx jest`), pas seulement le fichier de test touché — ces écrans partagent des mocks de module
  API dont un oubli casse silencieusement un autre test (piège déjà rencontré dans ce dépôt).
- `RNTL 14` : `render`/`renderHook` sont asynchrones — chaque appel dans les tests est précédé de
  `await`, comme déjà fait dans tous les fichiers de test existants de ce dossier.
- Ce plan couvre uniquement les 8 écrans listés au §3 de la spec comme "référence validée". Les
  écrans qui doivent "suivre la référence sans nouvelle maquette" (fiche client, détail article,
  listes de commandes/factures/achats, onglets Équipe/Réglages de Ferme, onglets Salaires/Avances
  de Finance) ne sont pas détaillés ici — ce sont des applications mécaniques du même patron
  (`TicketRow` + rangées à trait fin), à planifier séparément une fois ces 8 tâches livrées et le
  patron éprouvé en production.

---

## Task 1: Composant partagé `TicketRow`

**Files:**
- Create: `mobile/src/components/ui/TicketRow.tsx`
- Test: `mobile/src/components/ui/__tests__/TicketRow.test.tsx`
- Modify: `mobile/src/components/ui/index.ts:1-3` (ajouter l'export)

**Interfaces:**
- Produces: `TicketRow({ items: TicketItem[] })` où
  `TicketItem = { key: string; value: string; label: string; tint?: string }`. Les tâches 2 à 9
  importent `{ TicketRow, type TicketItem }` depuis `@/components/ui`.

- [ ] **Step 1: Lire le fichier d'export existant**

Ouvrir `mobile/src/components/ui/index.ts` pour connaître le style d'export en place (probablement
`export { SectionHeader } from './SectionHeader';` ou similaire) et le reproduire à l'identique
pour `TicketRow`.

- [ ] **Step 2: Écrire le test, qui échoue (le composant n'existe pas encore)**

```tsx
// mobile/src/components/ui/__tests__/TicketRow.test.tsx
import { render, screen } from '@testing-library/react-native';
import { TicketRow } from '../TicketRow';

describe('TicketRow', () => {
  it('affiche la valeur et le libellé de chaque colonne', async () => {
    await render(
      <TicketRow
        items={[
          { key: 'a', value: '42', label: 'Clients' },
          { key: 'b', value: '7', label: 'Débiteurs' },
        ]}
      />,
    );
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Clients')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Débiteurs')).toBeTruthy();
  });

  it('applique la couleur tint à la valeur quand elle est fournie', async () => {
    await render(<TicketRow items={[{ key: 'a', value: '7', label: 'Débiteurs', tint: '#F8961E' }]} />);
    expect(screen.getByText('7').props.style).toContainEqual(
      expect.objectContaining({ color: '#F8961E' }),
    );
  });

  it("accepte de 2 à 4 colonnes sans les tronquer", async () => {
    await render(
      <TicketRow
        items={[
          { key: 'a', value: '1', label: 'Un' },
          { key: 'b', value: '2', label: 'Deux' },
          { key: 'c', value: '3', label: 'Trois' },
          { key: 'd', value: '4', label: 'Quatre' },
        ]}
      />,
    );
    expect(screen.getByText('Quatre')).toBeTruthy();
  });
});
```

- [ ] **Step 2b: Lancer le test pour vérifier qu'il échoue**

Run: `cd mobile && npx jest src/components/ui/__tests__/TicketRow.test.tsx`
Expected: FAIL — `Cannot find module '../TicketRow'`

- [ ] **Step 3: Implémenter le composant**

```tsx
// mobile/src/components/ui/TicketRow.tsx
/**
 * Bande "ticket de caisse" : 2 à 4 chiffres de même rang, séparés par un fin trait vertical.
 * Remplace toute grille de cartes KPI bordées à ombre (doc
 * docs/superpowers/specs/2026-09-22-mobile-ux-refonte-champ-design.md §2 règle 2).
 */
import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';

export interface TicketItem {
  key: string;
  value: string;
  label: string;
  /** Couleur de la valeur seule — ex. tokens.colors.accent[400] pour une alerte. */
  tint?: string;
}

interface TicketRowProps {
  items: TicketItem[];
}

export function TicketRow({ items }: TicketRowProps) {
  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <View key={item.key} style={[styles.cell, i > 0 && styles.cellDivider]}>
          <Text style={[styles.value, item.tint ? { color: item.tint } : null]} numberOfLines={1}>
            {item.value}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.neutral[0],
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    borderRadius: tokens.radii.xl,
    paddingVertical: tokens.spacing[3],
  },
  cell: { flex: 1, alignItems: 'center', gap: 2 },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: tokens.colors.neutral[200] },
  value: { ...tokens.typography.numericSm, fontSize: 20, color: tokens.colors.field.text },
  label: { ...tokens.typography.bodySm, fontSize: 11, color: tokens.colors.field.textMuted },
});
```

- [ ] **Step 4: Ajouter l'export**

Modifier `mobile/src/components/ui/index.ts` pour ajouter :

```ts
export { TicketRow, type TicketItem } from './TicketRow';
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `cd mobile && npx jest src/components/ui/__tests__/TicketRow.test.tsx`
Expected: PASS — 3 tests verts

- [ ] **Step 6: Vérifier tsc**

Run: `cd mobile && npx tsc --noEmit`
Expected: aucune sortie

- [ ] **Step 7: Commit**

```bash
cd mobile
git checkout -b feat/mobile-ticket-row
git add src/components/ui/TicketRow.tsx src/components/ui/__tests__/TicketRow.test.tsx src/components/ui/index.ts
git commit -m "feat(mobile): composant TicketRow partagé pour les bandes d'indicateurs"
git push -u origin feat/mobile-ticket-row
```

Ouvrir la PR, attendre la CI verte, fusionner (`gh pr merge --rebase --delete-branch`) avant de
démarrer la Tâche 2 — les tâches suivantes importent ce composant depuis `main`.

---

## Task 2: Écran Accueil — bande ticket au lieu de la grille 2×2

**Files:**
- Modify: `mobile/app/(field)/(tabs)/home.tsx` (bloc `{/* Stat tiles */}` et son `StyleSheet`)
- Test: `mobile/app/(field)/(tabs)/__tests__/home.test.tsx` (déjà vert, ne doit pas casser)

**Interfaces:**
- Consumes: `TicketRow`, `TicketItem` depuis `@/components/ui` (Tâche 1).
- Consumes: `tiles: Tile[]` déjà construit par `buildTiles()` dans ce fichier — inchangé.

- [ ] **Step 1: Lancer le test existant pour confirmer qu'il est vert avant modification**

Run: `cd mobile && npx jest app/\(field\)/\(tabs\)/__tests__/home.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 2: Importer TicketRow**

Ajouter à côté des imports de composants existants (`import { SectionHeader } from '@/components/ui';`) :

```tsx
import { TicketRow } from '@/components/ui';
```

- [ ] **Step 3: Remplacer le bloc de tuiles**

Remplacer entièrement ce bloc :

```tsx
            {/* Stat tiles — the period below applies to every one of them. */}
            <PeriodSelector />
            <View style={styles.tileGrid}>
              {tiles.map((t, i) => {
                const Icon = t.icon;
                return (
                  <Animated.View key={t.key} entering={FadeInDown.delay(80 + i * 50).springify().damping(18)} style={styles.tileCell}>
                    <View style={[styles.tile, t.alert && styles.tileAlert]}>
                      <View style={styles.tileTop}>
                        <View style={[styles.tileIcon, { backgroundColor: withAlpha(t.tint, 0.14) }]}>
                          <Icon size={18} color={t.tint} />
                        </View>
                        {t.trend && <TrendChip trend={t.trend} invert={t.invertTrend} />}
                      </View>
                      <Text style={styles.tileValue} numberOfLines={1}>{t.value}</Text>
                      <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
                      {t.series && t.series.length >= 2 && (
                        <View style={styles.tileSpark}>
                          <Sparkline data={t.series} color={t.tint} width={140} height={28} strokeWidth={2} />
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </View>
```

par :

```tsx
            {/* Stat tiles — the period below applies to every one of them. */}
            <PeriodSelector />
            <TicketRow
              items={tiles.map((t) => ({
                key: t.key,
                value: t.value,
                label: t.label,
                tint: t.alert ? tokens.colors.error : undefined,
              }))}
            />
```

- [ ] **Step 4: Retirer les styles devenus inutilisés**

Dans le `StyleSheet.create` en bas du fichier, retirer les clés `tileGrid`, `tileCell`, `tile`,
`tileAlert`, `tileTop`, `tileIcon`, `tileValue`, `tileLabel`, `tileSpark` (plus aucune référence
après l'étape 3). Garder `TrendChip` et `Sparkline` : encore utilisés par le héros
(`hero.trend`/`hero.series`) plus haut dans le même fichier.

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe toujours**

Run: `cd mobile && npx jest app/\(field\)/\(tabs\)/__tests__/home.test.tsx`
Expected: PASS — les libellés `Effectif vivant` et `Mortalité` sont désormais rendus par
`TicketRow`, mais restent du texte simple, donc `getByText`/`getAllByText` continuent de les
trouver.

- [ ] **Step 6: tsc + suite complète**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: tsc muet, 755+3 tests verts (les 3 de la Tâche 1 s'ajoutent au total existant)

- [ ] **Step 7: Commit**

```bash
cd mobile
git checkout main && git pull --ff-only
git checkout -b feat/mobile-home-ticket-row
git add app/\(field\)/\(tabs\)/home.tsx
git commit -m "feat(mobile): l'accueil remplace la grille de tuiles par une bande ticket"
git push -u origin feat/mobile-home-ticket-row
```

---

## Task 3: Écran Ma Ferme — bande ticket + activité à trait fin

**Files:**
- Modify: `mobile/app/(field)/fermes.tsx` (bloc `Vue d'ensemble` : `styles.kpiGrid` et
  `styles.activityRow`)

**Interfaces:**
- Consumes: `TicketRow` depuis `@/components/ui`.
- Consumes: `cards` (déjà construit dans ce fichier, 4 éléments `{label, hint, value}`) — la spec
  ne garde que 3 colonnes (effectif, mortalité, ponte) car "Aliment / jour" fait doublon avec
  l'écran Stocks ; retirer la 4ᵉ entrée de `cards`.

- [ ] **Step 1: Réduire `cards` à 3 entrées**

Remplacer :

```tsx
  const ls = dashboard?.livestock;
  const cards = useMemo(
    () => [
      { label: 'Effectif total', hint: 'Sujets actifs', value: dashLoading ? '…' : ls ? formatNumber(ls.totalHeadcount) : 'n/d' },
      { label: 'Mortalité', hint: `Sur ${PERIOD_LABELS[period]}`, value: dashLoading ? '…' : pct(ls?.mortalityRate) },
      { label: `Ponte (${PERIOD_LABELS[period]})`, hint: 'Taux de ponte', value: dashLoading ? '…' : pct(ls?.layingRate) },
      { label: 'Aliment / jour', hint: 'Conso. moyenne', value: dashLoading ? '…' : kg(ls?.dailyFeedKg) },
    ],
    [dashLoading, ls],
  );
```

par :

```tsx
  const ls = dashboard?.livestock;
  const cards = useMemo(
    () => [
      { key: 'headcount', label: 'Effectif', value: dashLoading ? '…' : ls ? formatNumber(ls.totalHeadcount) : 'n/d' },
      {
        key: 'mortality',
        label: 'Mortalité',
        value: dashLoading ? '…' : pct(ls?.mortalityRate),
        tint: ls && ls.mortalityRate > 0 ? tokens.colors.error : undefined,
      },
      { key: 'laying', label: 'Ponte', value: dashLoading ? '…' : pct(ls?.layingRate) },
    ],
    [dashLoading, ls],
  );
```

(`kg`/`PERIOD_LABELS` peuvent devenir inutilisés dans ce fichier — vérifier avec `tsc` à l'étape 5
et retirer l'import si c'est le cas.)

- [ ] **Step 2: Importer TicketRow**

```tsx
import { TicketRow } from '@/components/ui';
```

- [ ] **Step 3: Remplacer le rendu de la grille KPI**

Remplacer :

```tsx
            <PeriodSelector />
            <View style={styles.kpiGrid}>
              {cards.map((c, i) => (
                <Animated.View key={c.label} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={styles.kpi}>
                  <Text style={styles.kpiLabel}>{c.label}</Text>
                  <Text style={styles.kpiVal}>{c.value}</Text>
                  <Text style={styles.kpiHint}>{c.hint}</Text>
                </Animated.View>
              ))}
            </View>
```

par :

```tsx
            <PeriodSelector />
            <TicketRow items={cards} />
```

- [ ] **Step 4: Rangées d'activité à trait fin (déjà proche — retirer juste la bordure/ombre de carte)**

Dans le `StyleSheet`, la clé `activityRow` est actuellement :

```tsx
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[3],
  },
```

Remplacer par :

```tsx
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing[3],
    paddingVertical: tokens.spacing[3],
  },
  activityRowBorder: {
    borderTopWidth: 1,
    borderTopColor: tokens.colors.neutral[100],
  },
```

Puis dans le JSX de la liste d'activité, ajouter le séparateur conditionnel (comme déjà fait pour
`memberRow`/`eventRow` ailleurs dans le code) :

```tsx
                {activity.map((item, i) => (
                  <View key={`${item.at}-${i}`} style={[styles.activityRow, i > 0 && styles.activityRowBorder]}>
```

- [ ] **Step 5: Retirer les styles devenus inutilisés et vérifier tsc**

Retirer `kpiGrid`, `kpi`, `kpiLabel`, `kpiVal`, `kpiHint` du `StyleSheet`.

Run: `cd mobile && npx tsc --noEmit`
Expected: si `kg`/`PERIOD_LABELS` ne sont plus utilisés, tsc ne signale rien de leur côté (imports
inutilisés ne sont pas des erreurs tsc par défaut dans ce projet — vérifier `noUnusedLocals` dans
`tsconfig.json` ; si actif, retirer l'import).

- [ ] **Step 6: Lancer les tests de l'écran**

Run: `cd mobile && npx jest app/\(field\)/__tests__/fermes.test.tsx`
Expected: PASS — le test vérifie `screen.getByText('1 200')`, un texte brut que `TicketRow` rend
toujours.

- [ ] **Step 7: Suite complète + commit**

```bash
cd mobile
npx jest
git checkout main && git pull --ff-only
git checkout -b feat/mobile-fermes-ticket-row
git add app/\(field\)/fermes.tsx
git commit -m "feat(mobile): Ma Ferme remplace la grille KPI par une bande ticket"
git push -u origin feat/mobile-fermes-ticket-row
```

---

## Task 4: Écran Élevage (liste des lots) — rangées à trait fin

**Files:**
- Modify: `mobile/app/(field)/(tabs)/elevage.tsx`

**Interfaces:**
- Ne consomme pas `TicketRow` : la bande à 3 chiffres existe déjà *à l'intérieur* de chaque carte
  (`styles.stats`, avec `statDivider` déjà en traits fins) — seule la carte qui l'enveloppe change.

- [ ] **Step 1: Exposer l'index de la boucle, puis ajouter le calcul du taux de mortalité**

Le `.map` actuel n'expose pas d'index (nécessaire à l'étape 2 pour le séparateur). Remplacer
`{rows.map((b: PoultryBatch) => {` par `{rows.map((b: PoultryBatch, i: number) => {`.

Après la ligne `const deaths = b.deaths;`, ajouter :

```tsx
                  // Seuil d'alerte visuel (pastille), pas une règle métier : à réviser si un
                  // seuil de ferme existe un jour côté paramétrage (docs/superpowers/specs
                  // §5 — risque déjà noté à l'écriture de ce plan).
                  const mortalityPct = b.initialCount > 0 ? (deaths / b.initialCount) * 100 : 0;
                  const highMortality = mortalityPct >= 5;
```

- [ ] **Step 2: Remplacer le style de carte par un style de rangée**

Remplacer :

```tsx
                <Pressable
                  key={b.id}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => router.push(`/(field)/lots/${b.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={b.name ?? `Lot #${b.id}`}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{b.name ?? `Lot #${b.id}`}</Text>
                      <Text style={styles.breed}>{breedName.get(b.breedId) ?? 'Race —'}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
```

par :

```tsx
                <Pressable
                  key={b.id}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
                  onPress={() => router.push(`/(field)/lots/${b.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={b.name ?? `Lot #${b.id}`}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.nameRow}>
                      {highMortality && <View style={styles.alertDot} accessibilityLabel="Mortalité élevée" />}
                      <Text style={styles.name} numberOfLines={1}>{b.name ?? `Lot #${b.id}`}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
```

(La race `breedName` disparaît de l'affichage — c'est une simplification volontaire de la spec
§2 règle 4 (« une valeur, jamais son libellé »). Si elle doit rester visible, le plus simple est
de l'accoler au statut plutôt que de créer une 3ᵉ ligne — laissé à l'appréciation du reviewer,
sans casser le test s'il en existe un sur `breedName` : il n'y en a pas de trouvé dans
`app/(field)/(tabs)/__tests__/`, `elevage.tsx` n'a pas de fichier de test à ce jour.)

- [ ] **Step 3: Mettre à jour le `StyleSheet`**

Remplacer la clé `card`/`cardPressed` :

```tsx
  card: {
    backgroundColor: tokens.colors.neutral[0],
    borderRadius: tokens.radii.xl,
    borderWidth: 1,
    borderColor: tokens.colors.neutral[200],
    padding: tokens.spacing[4],
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.92 },
```

par :

```tsx
  row: { paddingVertical: tokens.spacing[4] },
  rowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  rowPressed: { opacity: 0.92 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2] },
  alertDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.colors.accent[400] },
```

Retirer la clé `breed` du `StyleSheet` (plus utilisée).

- [ ] **Step 4: tsc + suite complète**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: tsc muet, tous les tests verts (aucun test dédié à cet écran aujourd'hui — la
régression à surveiller est ailleurs, d'où la suite complète).

- [ ] **Step 5: Commit**

```bash
cd mobile
git checkout main && git pull --ff-only
git checkout -b feat/mobile-elevage-liste-rows
git add app/\(field\)/\(tabs\)/elevage.tsx
git commit -m "feat(mobile): la liste des lots passe en rangées à trait fin"
git push -u origin feat/mobile-elevage-liste-rows
```

---

## Task 5: Écran détail d'un lot — bande ticket à 4 chiffres

**Files:**
- Modify: `mobile/app/(field)/lots/[unitId]/index.tsx`

**Interfaces:**
- Consumes: `TicketRow` depuis `@/components/ui`.
- Ne touche pas aux graphiques (`GrowthChart`, `MortalityChart`, `FeedConsumptionChart`), à la carte
  de prévision (`forecastCard`), ni aux onglets — gardés à l'identique (spec §2 règle 6).

- [ ] **Step 1: Importer TicketRow**

```tsx
import { TicketRow } from '@/components/ui';
```

- [ ] **Step 2: Remplacer la grille KPI et retirer le composant `Kpi` devenu inutile**

Remplacer :

```tsx
        {/* KPI grid */}
        <View style={styles.kpiGrid}>
          <Kpi label="Effectif actuel" value={batch ? formatNumber(batch.currentCount) : '—'} unit="sujets" />
          <Kpi label="Âge" value={String(age)} unit="jours" />
          <Kpi label="Mortalité" value={`${mortalityPct.toFixed(1)}%`} unit="cumulée" tone={deaths > 0 ? tokens.colors.error : undefined} />
          <Kpi label="Poids moyen" value={avgKg != null ? avgKg.toFixed(2) : '—'} unit="kg" tone={tokens.colors.primary[600]} />
        </View>
```

par :

```tsx
        {/* KPI ticket row */}
        <TicketRow
          items={[
            { key: 'headcount', value: batch ? formatNumber(batch.currentCount) : '—', label: 'Effectif' },
            { key: 'age', value: `J${age}`, label: 'Âge' },
            {
              key: 'mortality',
              value: `${mortalityPct.toFixed(1)}%`,
              label: 'Mortalité',
              tint: deaths > 0 ? tokens.colors.error : undefined,
            },
            { key: 'weight', value: avgKg != null ? `${avgKg.toFixed(2)}kg` : '—', label: 'Poids moyen' },
          ]}
        />
```

Puis retirer entièrement la fonction `Kpi` (définie plus bas dans le fichier, entre `LotDetailScreen`
et `Perf`) :

```tsx
function Kpi({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label.toUpperCase()}</Text>
      <View style={styles.kpiValRow}>
        <Text style={[styles.kpiVal, tone && { color: tone }]} numberOfLines={1}>{value}</Text>
        {unit ? <Text style={styles.kpiUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Retirer les styles devenus inutilisés**

Dans le `StyleSheet`, retirer `kpiGrid`, `kpi`, `kpiLabel`, `kpiValRow`, `kpiVal`, `kpiUnit`.

- [ ] **Step 4: tsc + suite complète**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: tsc muet (confirme que `Kpi` n'est plus référencé nulle part), suite verte — pas de
fichier de test dédié à cet écran aujourd'hui.

- [ ] **Step 5: Commit**

```bash
cd mobile
git checkout main && git pull --ff-only
git checkout -b feat/mobile-lot-detail-ticket-row
git add app/\(field\)/lots/\[unitId\]/index.tsx
git commit -m "feat(mobile): le détail d'un lot remplace sa grille KPI par une bande ticket"
git push -u origin feat/mobile-lot-detail-ticket-row
```

---

## Task 6: Écran Commerce (clients) — bande ticket + rangées à trait fin

**Files:**
- Modify: `mobile/app/(field)/(tabs)/commerce.tsx`
- Test: `mobile/app/(field)/(tabs)/__tests__/commerce.test.tsx` (déjà vert, ne doit pas casser)

**Interfaces:**
- Consumes: `TicketRow` depuis `@/components/ui`.

- [ ] **Step 1: Importer TicketRow**

```tsx
import { TicketRow } from '@/components/ui';
```

- [ ] **Step 2: Remplacer la ligne de 3 cartes KPI**

Remplacer :

```tsx
        {/* KPI row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Users size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.kpiVal}>{formatNumber(clients?.length ?? 0)}</Text>
            <Text style={styles.kpiLabel}>Clients</Text>
          </View>
          <View style={[styles.kpi, debtors.length > 0 && styles.kpiAlert]}>
            <Text style={[styles.kpiVal, debtors.length > 0 && { color: tokens.colors.warning }]}>{formatNumber(debtors.length)}</Text>
            <Text style={styles.kpiLabel}>Débiteurs</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{formatCurrency(totalEncours)}</Text>
            <Text style={styles.kpiLabel}>Encours</Text>
          </View>
        </View>
```

par :

```tsx
        {/* KPI ticket row */}
        <TicketRow
          items={[
            { key: 'clients', value: formatNumber(clients?.length ?? 0), label: 'Clients' },
            {
              key: 'debtors',
              value: formatNumber(debtors.length),
              label: 'Débiteurs',
              tint: debtors.length > 0 ? tokens.colors.accent[400] : undefined,
            },
            { key: 'encours', value: formatCurrency(totalEncours), label: 'Encours' },
          ]}
        />
```

`Users` reste importé (utilisé dans `emptyDisc`) ; retirer `styles.kpiRow`, `styles.kpi`,
`styles.kpiAlert`, `styles.kpiVal`, `styles.kpiLabel` du `StyleSheet`.

- [ ] **Step 3: Rangées client à trait fin**

Remplacer :

```tsx
                <Pressable
                  key={c.id}
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir ${c.displayName}`}
                  onPress={() => router.push(`/(field)/commerce/client/${c.id}`)}
                >
```

par :

```tsx
                <Pressable
                  key={c.id}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir ${c.displayName}`}
                  onPress={() => router.push(`/(field)/commerce/client/${c.id}`)}
                >
```

(le `.map` doit exposer l'index — remplacer `{filtered.map((c: Client) => {` par
`{filtered.map((c: Client, i: number) => {` juste au-dessus).

Dans le `StyleSheet`, remplacer :

```tsx
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[3] },
```

par :

```tsx
  row: { paddingVertical: tokens.spacing[4], gap: tokens.spacing[3] },
  rowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
```

- [ ] **Step 4: Retirer le libellé "Encours" répété sur chaque ligne**

Remplacer :

```tsx
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Encours</Text>
                    <Text style={[styles.balanceVal, { color }]}>{formatCurrency(c.currentBalanceXof)}</Text>
                  </View>
```

par :

```tsx
                  <Text style={[styles.balanceVal, { color }]}>{formatCurrency(c.currentBalanceXof)}</Text>
```

Retirer `balanceRow` et `balanceLabel` du `StyleSheet`.

- [ ] **Step 5: Lancer le test existant**

Run: `cd mobile && npx jest app/\(field\)/\(tabs\)/__tests__/commerce.test.tsx`
Expected: PASS — le test ne porte que sur le FAB « Nouvelle vente », non touché.

- [ ] **Step 6: tsc + suite complète + commit**

```bash
cd mobile
npx tsc --noEmit && npx jest
git checkout main && git pull --ff-only
git checkout -b feat/mobile-commerce-ticket-row
git add app/\(field\)/\(tabs\)/commerce.tsx
git commit -m "feat(mobile): Commerce remplace ses cartes KPI et clients par des rangées ticket"
git push -u origin feat/mobile-commerce-ticket-row
```

---

## Task 7: Écran Stocks — bande ticket + section Alertes fusionnée

**Files:**
- Modify: `mobile/app/(field)/(tabs)/stocks.tsx`
- Test: `mobile/app/(field)/(tabs)/__tests__/stocks.test.tsx` (à réécrire — le texte attendu change)

**Interfaces:**
- Consumes: `TicketRow` depuis `@/components/ui`.
- Ce test est le seul du plan dont le texte attendu change : la spec fusionne 3 encarts colorés en
  1 section, donc les chaînes `Stock négatif — 1` / `Commandes en retard — 1` disparaissent.
  Étape TDD complète (test qui échoue → implémentation → test qui passe).

- [ ] **Step 1: Réécrire le test AVANT le code (il doit échouer contre le code actuel)**

```tsx
// mobile/app/(field)/(tabs)/__tests__/stocks.test.tsx
import { render, screen } from '@testing-library/react-native';

const alerts = {
  lowStockItems: [],
  negativeStockItems: [
    { stockItemId: 3, articleKey: 'corn_crushed', label: 'Maïs concassé', currentQuantity: -12, unit: 'kg' },
  ],
  pendingPurchaseOrders: [
    {
      purchaseOrderId: 9,
      orderNumber: 'BA-2026-004',
      supplierId: 2,
      supplierName: 'Provendier du Sahel',
      expectedDeliveryDate: '2026-08-28',
      daysOverdue: 6,
      totalXof: 180000,
    },
  ],
  recentMovements: [],
};

jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  Redirect: () => null,
}));
jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => 7),
  useDispatch: jest.fn(() => jest.fn()),
  useStore: jest.fn(() => ({})),
}));
jest.mock('@/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/auth/useSession', () => ({
  useFarmAccess: jest.fn(() => ({ farmRole: 'OWNER', can: () => true, isAdmin: true, session: null })),
}));
jest.mock('@/store/api/inventoryStockApi', () => ({
  useGetStockItemsQuery: jest.fn(() => ({ data: [], isLoading: false })),
  useGetLowStockItemsQuery: jest.fn(() => ({ data: [] })),
  useGetStockValuationQuery: jest.fn(() => ({ data: { totalValueXof: 250000 } })),
  useGetInventoryAlertsQuery: jest.fn(() => ({ data: alerts })),
}));

import StocksScreen from '../stocks';

describe('Stocks tab', () => {
  it('regroupe les alertes de tous types dans une seule section', async () => {
    await render(<StocksScreen />);

    expect(screen.getByText('Alertes (2)')).toBeTruthy();
    expect(screen.getByText('Maïs concassé')).toBeTruthy();
    expect(screen.getByText(/BA-2026-004/)).toBeTruthy();
    expect(screen.getByText(/6 j de retard/)).toBeTruthy();
  });

  it('affiche le nombre d\'alertes dans la bande ticket, en orange', async () => {
    await render(<StocksScreen />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd mobile && npx jest app/\(field\)/\(tabs\)/__tests__/stocks.test.tsx`
Expected: FAIL — `Alertes (2)` introuvable dans le rendu actuel.

- [ ] **Step 3: Construire une liste d'alertes unifiée**

Après le calcul existant de `lowCount`, `negative`, `overdueOrders`, ajouter :

```tsx
  type AlertRow = { key: string; icon: LucideIcon; tint: string; label: string; value: string };
  const alertRows: AlertRow[] = [
    ...negative.map((i): AlertRow => ({
      key: `neg-${i.stockItemId}`,
      icon: AlertTriangle,
      tint: tokens.colors.error,
      label: i.label ?? i.articleKey,
      value: `${formatNumber(i.currentQuantity)}${i.unit ? ` ${i.unit}` : ''}`,
    })),
    ...(lowStock ?? []).map((i): AlertRow => ({
      key: `low-${i.id}`,
      icon: AlertTriangle,
      tint: tokens.colors.warning,
      label: articleLabel(i.articleKey),
      value: `${formatNumber(i.currentQuantity)}${i.unit ? ` ${i.unit}` : ''}`,
    })),
    ...overdueOrders.map((o): AlertRow => ({
      key: `late-${o.purchaseOrderId}`,
      icon: Truck,
      tint: tokens.colors.info,
      label: `${o.orderNumber} · ${o.supplierName}`,
      value: `${o.daysOverdue} j de retard`,
    })),
  ];
```

`AlertTriangle`, `Truck`, `LucideIcon` sont déjà importés en tête de fichier.

- [ ] **Step 4: Remplacer les 3 encarts colorés par la bande ticket + une section**

Remplacer :

```tsx
        {/* KPI row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <PackageOpen size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.kpiVal}>{formatNumber(items?.length ?? 0)}</Text>
            <Text style={styles.kpiLabel}>Articles</Text>
          </View>
          <View style={[styles.kpi, lowCount > 0 && styles.kpiAlert]}>
            <AlertTriangle size={18} color={lowCount > 0 ? tokens.colors.error : tokens.colors.neutral[400]} />
            <Text style={[styles.kpiVal, lowCount > 0 && { color: tokens.colors.error }]}>{formatNumber(lowCount)}</Text>
            <Text style={styles.kpiLabel}>Alertes</Text>
          </View>
          <View style={styles.kpi}>
            <Wallet size={18} color={tokens.colors.primary[600]} />
            <Text style={styles.kpiVal}>{formatCurrency(valuation?.totalValueXof ?? 0)}</Text>
            <Text style={styles.kpiLabel}>Valeur</Text>
          </View>
        </View>

        {negative.length > 0 && (
          <View style={styles.negativeCard}>
            <View style={styles.lowHead}>
              <AlertTriangle size={16} color={tokens.colors.error} />
              <Text style={styles.negativeTitle}>Stock négatif — {formatNumber(negative.length)}</Text>
            </View>
            <Text style={styles.negativeHint}>
              Un compte sous zéro n&apos;est pas une rupture : c&apos;est une sortie enregistrée
              deux fois, ou une entrée jamais saisie. À corriger par un mouvement d&apos;inventaire.
            </Text>
            {negative.map((i) => (
              <View key={i.stockItemId} style={styles.lowRow}>
                <Text style={styles.lowName}>{i.label ?? i.articleKey}</Text>
                <Text style={styles.negativeQty}>
                  {formatNumber(i.currentQuantity)} {i.unit ?? ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {overdueOrders.length > 0 && (
          <View style={styles.lowCard}>
            <View style={styles.lowHead}>
              <Truck size={16} color={tokens.colors.warning} />
              <Text style={styles.lowTitle}>
                Commandes en retard — {formatNumber(overdueOrders.length)}
              </Text>
            </View>
            {overdueOrders.map((o) => (
              <View key={o.purchaseOrderId} style={styles.lowRow}>
                <Text style={styles.lowName}>
                  {o.orderNumber} · {o.supplierName}
                </Text>
                <Text style={styles.lowQty}>
                  {o.daysOverdue} j de retard
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Low-stock highlight */}
        {lowStock && lowStock.length > 0 && (
          <View style={styles.lowCard}>
            <View style={styles.lowHead}>
              <AlertTriangle size={16} color={tokens.colors.error} />
              <Text style={styles.lowTitle}>Stock bas — {formatNumber(lowStock.length)}</Text>
            </View>
            {lowStock.map((i) => (
              <View key={i.id} style={styles.lowRow}>
                <Text style={styles.lowName} numberOfLines={1}>{articleLabel(i.articleKey)}</Text>
                <Text style={styles.lowQty}>
                  {formatNumber(i.currentQuantity)}{i.unit ? ` ${i.unit}` : ''}
                  {i.alertThreshold !== null ? (
                    <Text style={styles.lowThreshold}>{`  / seuil ${formatNumber(i.alertThreshold)}`}</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        )}
```

par :

```tsx
        {/* KPI ticket row */}
        <TicketRow
          items={[
            { key: 'articles', value: formatNumber(items?.length ?? 0), label: 'Articles' },
            {
              key: 'alerts',
              value: formatNumber(alertRows.length),
              label: 'Alertes',
              tint: alertRows.length > 0 ? tokens.colors.accent[400] : undefined,
            },
            { key: 'value', value: formatCurrency(valuation?.totalValueXof ?? 0), label: 'Valeur' },
          ]}
        />

        {alertRows.length > 0 && (
          <View style={styles.alertsBlock}>
            <Text style={styles.alertsTitle}>Alertes ({alertRows.length})</Text>
            {alertRows.map((a, i) => {
              const Icon = a.icon;
              return (
                <View key={a.key} style={[styles.alertRow, i > 0 && styles.alertRowBorder]}>
                  <Icon size={16} color={a.tint} />
                  <Text style={styles.alertLabel} numberOfLines={1}>{a.label}</Text>
                  <Text style={[styles.alertValue, { color: a.tint }]}>{a.value}</Text>
                </View>
              );
            })}
          </View>
        )}
```

- [ ] **Step 5: Mettre à jour le `StyleSheet`**

Retirer `kpiRow`, `kpi`, `kpiAlert`, `kpiVal`, `kpiLabel`, `negativeCard`, `negativeTitle`,
`negativeHint`, `negativeQty`, `lowCard`, `lowHead`, `lowTitle`, `lowRow`, `lowName`, `lowQty`,
`lowThreshold`. Ajouter :

```tsx
  alertsBlock: { marginTop: tokens.spacing[2], marginBottom: tokens.spacing[4] },
  alertsTitle: { ...tokens.typography.bodySm, fontWeight: '700', color: tokens.colors.field.textMuted, marginBottom: tokens.spacing[2] },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[2] },
  alertRowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
  alertLabel: { ...tokens.typography.bodyMd, color: tokens.colors.field.text, flex: 1 },
  alertValue: { ...tokens.typography.numericSm, fontSize: 13 },
```

- [ ] **Step 6: Rangées d'articles à trait fin + retrait du badge "Bas" redondant**

Remplacer :

```tsx
                <Pressable
                  key={i.id}
                  style={styles.card}
```

par :

```tsx
                <Pressable
                  key={i.id}
                  style={[styles.row, idx > 0 && styles.rowBorder]}
```

(renommer la variable de boucle `i` → `idx` dans ce `.map` précisément, car `i` désigne déjà
l'article de stock — `{filtered.map((i, idx) => {`).

Remplacer le bloc bas de carte :

```tsx
                  <View style={styles.cardBottom}>
                    <Text style={[styles.qty, low && { color: tokens.colors.error }]}>
                      {formatNumber(i.currentQuantity)}
                      <Text style={styles.unit}>{i.unit ? ` ${i.unit}` : ''}</Text>
                    </Text>
                    {low && (
                      <View style={styles.lowBadge}>
                        <AlertTriangle size={12} color={tokens.colors.errorDark} />
                        <Text style={styles.lowBadgeText}>Bas</Text>
                      </View>
                    )}
                  </View>
```

par :

```tsx
                  <Text style={[styles.qty, low && { color: tokens.colors.error }]}>
                    {formatNumber(i.currentQuantity)}
                    <Text style={styles.unit}>{i.unit ? ` ${i.unit}` : ''}</Text>
                  </Text>
```

Dans le `StyleSheet`, remplacer `card`/`cardPressed` (s'il y en a — sinon `card` seul) par
`row`/`rowBorder` comme dans les tâches précédentes, et retirer `cardBottom`, `lowBadge`,
`lowBadgeText`.

- [ ] **Step 7: Lancer le test réécrit à l'étape 1**

Run: `cd mobile && npx jest app/\(field\)/\(tabs\)/__tests__/stocks.test.tsx`
Expected: PASS

- [ ] **Step 8: tsc + suite complète + commit**

```bash
cd mobile
npx tsc --noEmit && npx jest
git checkout main && git pull --ff-only
git checkout -b feat/mobile-stocks-alerts-unifiees
git add app/\(field\)/\(tabs\)/stocks.tsx app/\(field\)/\(tabs\)/__tests__/stocks.test.tsx
git commit -m "feat(mobile): Stocks fusionne ses trois encarts d'alerte en une section"
git push -u origin feat/mobile-stocks-alerts-unifiees
```

---

## Task 8: Écran Sanitaire — bande ticket + synthèse fusionnée

**Files:**
- Modify: `mobile/app/(field)/sanitaire.tsx`

**Interfaces:**
- Consumes: `TicketRow` depuis `@/components/ui`.
- Pas de fichier de test existant pour cet écran.

- [ ] **Step 1: Importer TicketRow**

```tsx
import { TicketRow } from '@/components/ui';
```

- [ ] **Step 2: Remplacer la grille 2×2 par la bande ticket**

Remplacer :

```tsx
            {/* KPI tiles */}
            <View style={styles.kpiGrid}>
              {tiles.map((t) => (
                <View key={t.label} style={[styles.kpiTile, { borderLeftColor: t.color }]}>
                  <View style={styles.kpiTop}>
                    <Text style={styles.kpiLabel}>{t.label}</Text>
                    <View style={[styles.kpiIcon, { backgroundColor: `${t.color}1A` }]}><t.icon size={16} color={t.color} /></View>
                  </View>
                  <Text style={[styles.kpiVal, { color: t.color }]}>{isLoading ? '—' : t.value}</Text>
                  <Text style={styles.kpiHint}>{t.hint}</Text>
                </View>
              ))}
            </View>
```

par :

```tsx
            {/* KPI ticket row */}
            <TicketRow
              items={tiles.map((t) => ({
                key: t.label,
                value: isLoading ? '—' : t.value,
                label: t.label,
                tint: t.color,
              }))}
            />
```

(`tiles` reste construit exactement comme aujourd'hui, quatre entrées — `TicketRow` accepte 4
colonnes sans changement.)

- [ ] **Step 3: Aplatir le conteneur de la timeline "Événements récents"**

La spec demande une liste "juste un titre discret au-dessus", pas une carte bordée autour de tout
le bloc (titre + filtres + liste). Remplacer :

```tsx
            {/* Timeline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Événements récents</Text>
              <View style={styles.filters}>
```

par :

```tsx
            {/* Timeline */}
            <View style={styles.section}>
              <Text style={styles.cardTitle}>Événements récents</Text>
              <View style={styles.filters}>
```

Le reste du bloc (filtres, `shown.map(...)`) ne change pas — `eventRow`/`eventBorder` sont déjà en
traits fins. Ajouter `section: { marginBottom: tokens.spacing[2] }` au `StyleSheet` (à l'étape 5).

- [ ] **Step 4: Fusionner les cartes "Programmes vaccinaux" et "Bibliothèque médicale"**

Remplacer les deux blocs :

```tsx
            {/* Vaccination programs */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <CalendarRange size={18} color={tokens.colors.primary[600]} />
                <Text style={styles.cardTitle}>Programmes vaccinaux</Text>
              </View>
              <Text style={styles.body}>
                {formatNumber(programs?.length ?? 0)} programme(s) plateforme · {formatNumber(units?.length ?? 0)} lot(s) suivi(s).
              </Text>
              <Text style={styles.bodyMuted}>
                Assignez un programme depuis l&apos;onglet Sanitaire de chaque lot pour suivre le calendrier vaccinal.
              </Text>
            </View>

            {/* Medical library */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <BookOpen size={18} color={tokens.colors.primary[600]} />
                <Text style={styles.cardTitle}>Bibliothèque médicale</Text>
              </View>
              <View style={styles.libRow}>
                <View style={styles.libStat}>
                  <Text style={styles.libLabel}>Vaccins</Text>
                  <Text style={styles.libVal}>{formatNumber(vaccines?.length ?? 0)}</Text>
                </View>
                <View style={styles.libStat}>
                  <Text style={styles.libLabel}>Traitements</Text>
                  <Text style={styles.libVal}>{treatments ? formatNumber(treatments.length) : '—'}</Text>
                </View>
              </View>
            </View>
```

par :

```tsx
            {/* Protocoles & catalogue — une seule ligne de synthèse */}
            <View style={styles.summaryRow}>
              <CalendarRange size={16} color={tokens.colors.field.textMuted} />
              <Text style={styles.summaryText}>
                {formatNumber(programs?.length ?? 0)} programme(s) · {formatNumber(units?.length ?? 0)} lot(s) suivi(s)
                {'  ·  '}
                {formatNumber(vaccines?.length ?? 0)} vaccins · {treatments ? formatNumber(treatments.length) : '—'} traitements
              </Text>
            </View>
```

`BookOpen` devient un import inutilisé — le retirer de la liste d'imports `lucide-react-native`
en tête de fichier.

- [ ] **Step 5: Mettre à jour le `StyleSheet`**

Retirer `kpiGrid`, `kpiTile`, `kpiTop`, `kpiLabel`, `kpiIcon`, `kpiVal`, `kpiHint`, `body`,
`bodyMuted`, `libRow`, `libStat`, `libLabel`, `libVal`. Retirer aussi `card` et `cardHead` : après
l'étape 3, plus aucun bloc de ce fichier n'utilise le conteneur bordé (`card` enveloppait la
timeline, `cardHead` les deux blocs fusionnés à l'étape 4) — seul `cardTitle` (typographie seule,
sans bordure) reste utilisé par le titre « Événements récents ». Ajouter :

```tsx
  section: { marginBottom: tokens.spacing[2] },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing[2], paddingVertical: tokens.spacing[2] },
  summaryText: { ...tokens.typography.bodySm, color: tokens.colors.field.textMuted, flex: 1 },
```

- [ ] **Step 6: tsc + suite complète**

Run: `cd mobile && npx tsc --noEmit && npx jest`
Expected: tsc muet, suite verte.

- [ ] **Step 7: Commit**

```bash
cd mobile
git checkout main && git pull --ff-only
git checkout -b feat/mobile-sanitaire-ticket-row
git add app/\(field\)/sanitaire.tsx
git commit -m "feat(mobile): Suivi sanitaire fusionne ses tuiles et ses cartes de synthèse"
git push -u origin feat/mobile-sanitaire-ticket-row
```

---

## Task 9: Écran Finance — dépenses en rangées à trait fin

**Files:**
- Modify: `mobile/app/(field)/finance.tsx`
- Test: `mobile/app/(field)/__tests__/finance.test.tsx` (déjà vert, ne doit pas casser)

**Interfaces:**
- Ne consomme pas `TicketRow` : le héros de Finance est déjà un bloc plein à un seul chiffre
  (spec §2 règle 1, déjà conforme) — seule la liste de dépenses/salaires change de rangée.

- [ ] **Step 1: Rangées de dépenses à trait fin**

Remplacer :

```tsx
              {(expenses ?? []).map((e: Expense, i) => (
                <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).springify().damping(18)}>
                  <Pressable
                    // Only MANUAL expenses are editable: the backend answers 422
                    // EXPENSE_NOT_EDITABLE on one derived from a purchase, a vet visit or a
                    // salary, so those rows open nothing.
                    disabled={!canManage || e.source !== 'MANUAL'}
                    accessibilityRole={canManage && e.source === 'MANUAL' ? 'button' : undefined}
                    accessibilityLabel={
                      canManage && e.source === 'MANUAL' ? `Corriger ${e.label}` : undefined
                    }
                    onPress={() => setEditing(e)}
                    style={styles.card}
                  >
```

par :

```tsx
              {(expenses ?? []).map((e: Expense, i) => (
                <Animated.View key={e.id} entering={FadeInDown.delay(i * 40).springify().damping(18)}>
                  <Pressable
                    disabled={!canManage || e.source !== 'MANUAL'}
                    accessibilityRole={canManage && e.source === 'MANUAL' ? 'button' : undefined}
                    accessibilityLabel={
                      canManage && e.source === 'MANUAL' ? `Corriger ${e.label}` : undefined
                    }
                    onPress={() => setEditing(e)}
                    style={[styles.row, i > 0 && styles.rowBorder]}
                  >
```

Appliquer le même remplacement `styles.card` → `[styles.row, i > 0 && styles.rowBorder]` sur la
`Pressable`/`Animated.View` de la liste des salaires (bloc `(salaries ?? []).map((s: Salary, i) =>`
un peu plus bas dans le même fichier — structure identique, même style `card` réutilisé).

- [ ] **Step 2: Mettre à jour le `StyleSheet`**

Remplacer :

```tsx
  card: { backgroundColor: tokens.colors.neutral[0], borderRadius: tokens.radii.xl, borderWidth: 1, borderColor: tokens.colors.neutral[200], padding: tokens.spacing[4], gap: tokens.spacing[2] },
```

par :

```tsx
  row: { paddingVertical: tokens.spacing[4], gap: tokens.spacing[2] },
  rowBorder: { borderTopWidth: 1, borderTopColor: tokens.colors.neutral[100] },
```

- [ ] **Step 3: Lancer le test existant**

Run: `cd mobile && npx jest app/\(field\)/__tests__/finance.test.tsx`
Expected: PASS — le test vérifie du texte (`'Sac aliment'`) et des `accessibilityLabel`
(`'Corriger Sac aliment'`), tous deux inchangés.

- [ ] **Step 4: tsc + suite complète + commit**

```bash
cd mobile
npx tsc --noEmit && npx jest
git checkout main && git pull --ff-only
git checkout -b feat/mobile-finance-rows
git add app/\(field\)/finance.tsx
git commit -m "feat(mobile): Finance remplace ses cartes de dépense/salaire par des rangées"
git push -u origin feat/mobile-finance-rows
```

---

## Ordre d'exécution

Tâche 1 d'abord et seule (les 8 suivantes en dépendent). Les tâches 2 à 9 sont ensuite
indépendantes entre elles — exécutables dans n'importe quel ordre, y compris en parallèle si
plusieurs workers sont disponibles, chacune sur sa propre branche partant de `main` une fois la
Tâche 1 mergée.
