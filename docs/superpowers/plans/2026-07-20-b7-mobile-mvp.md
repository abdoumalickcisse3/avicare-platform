# B7 — Mobile MVP terrain : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une app React Native permettant à un éleveur de saisir mortalité, journalier, pesées et collectes d'œufs depuis le poulailler, y compris sans réseau, avec synchronisation automatique au retour de connectivité.

**Architecture:** File de mutations sortantes durable (SQLite) + cache de lecture jetable (RTK Query persisté) — pas de moteur de sync bidirectionnel. La synchronisation rejoue les endpoints métier existants ; seuls les deux endpoints non idempotents (mortalité événement, pesée) reçoivent une clé `client_ref` côté backend.

**Tech Stack:** Expo SDK 56, React Native 0.85, React 19, TypeScript strict, expo-router, Redux Toolkit + RTK Query, expo-sqlite, expo-secure-store, netinfo, Jest + React Native Testing Library. Backend : Spring Boot 3.4, Java 21, Flyway, Testcontainers.

**Spec de référence :** `docs/08-mobile-react-native.md` (décisions M1→M10).

---

## Global Constraints

- **Tout doit tourner dans Expo Go** — aucun module natif custom, aucun build de développement.
- Expo SDK **56**, React Native **0.85**, React **19**, TypeScript **strict** (`"strict": true`, aucun `any` implicite).
- Textes user-facing en **français**. Messages techniques, logs et noms de symboles en **anglais**.
- Aucune couleur, taille de police ni espacement en dur : tout vient de `mobile/src/theme/tokens.ts`, lui-même dérivé de `docs/10-design-system.md`.
- Cibles tactiles **≥ 44×44 px**, hauteur de bouton **48 px**, espacement inter-cibles **≥ 8 px** (doc 10 §9).
- Couleurs de marque verrouillées : primaire `#3D8B3D` (main), `#2E6B2E` (600), accent `#F8961E`. CTA orange : fond `accent-400` + texte `#122B12` (6.79:1) — jamais de blanc sur orange (2.24:1, échec WCAG).
- Conventional Commits, scope par périmètre : `feat(mobile): ...`, `feat(backend:livestock): ...`.
- **Aucune signature ni référence à Claude** dans les messages de commit ni dans les corps de PR (`CLAUDE.md`, vérifié sur PR #134).
- Backend : Spotless google-java-format, indentation 2 espaces. Services `@Service` + `@RequiredArgsConstructor`, DTOs en records Java 21.
- **Migrations Flyway immuables.** Dernière mergée : `V29__sales_channels.sql` → la nôtre est `V30`.
- Tests avant de cocher une case (règle projet).

---

## File Structure

### Mobile — créé

| Fichier | Responsabilité |
|---|---|
| `mobile/src/theme/tokens.ts` | Tokens doc 10 portés en RN (couleurs, espacement, rayons, typo) |
| `mobile/src/theme/index.ts` | Export du thème + helpers |
| `mobile/src/sync/types.ts` | `MutationKind`, `QueuedMutation`, `SqlDriver` |
| `mobile/src/sync/schema.ts` | DDL de `mutation_queue` |
| `mobile/src/sync/driver.ts` | Implémentation `SqlDriver` sur expo-sqlite |
| `mobile/src/sync/queue.ts` | `enqueue` / `peekNext` / `markDone` / `markFailed` / `countPending` |
| `mobile/src/sync/engine.ts` | Boucle de drain, backoff, classification des échecs |
| `mobile/src/sync/triggers.ts` | Câblage netinfo + AppState → `drain()` |
| `mobile/src/auth/tokens.ts` | Lecture/écriture des tokens dans SecureStore |
| `mobile/src/auth/session.ts` | Décodage JWT, memberships, rôle |
| `mobile/src/store/api/baseApi.ts` | baseQuery RTK Query + refresh sur 401 |
| `mobile/src/store/api/*.ts` | Slices : auth, farms, productionUnits, dailyRecords, eggs |
| `mobile/src/components/*` | Composants terrain (Stepper, StatusBar, FieldButton) |
| `mobile/app/**` | Écrans expo-router |

### Backend — modifié

| Fichier | Changement |
|---|---|
| `backend/avicare-app/src/main/resources/db/migration/V30__mobile_idempotency.sql` | Créé |
| `.../livestock/domain/LifecycleEvent.java` | + champ `clientRef` |
| `.../livestock/poultry/WeighingSample.java` | + champ `clientRef` |
| `.../livestock/dto/request/RecordMortalityRequest.java` | + `UUID clientRef` |
| `.../livestock/dto/request/WeighingRequest.java` | + `UUID clientRef` |
| `.../livestock/repository/LifecycleEventRepository.java` | + `findByClientRef` |
| `.../livestock/repository/WeighingSampleRepository.java` | + `findByClientRef` |
| `.../livestock/service/LivestockService.java` | Court-circuit idempotent |
| `.../livestock/poultry/GrowthAnalysisService.java` | Court-circuit idempotent |

---

## Ordre des tâches

Le backend (Tâche 2) passe tôt : il débloque les tâches 11 et 12 et il est indépendant du mobile.

| # | Tâche | Dépend de |
|---|---|---|
| 1 | Direction de design terrain | — |
| 2 | Backend : idempotence V30 | — |
| 3 | Bootstrap Expo + thème + tests | 1 |
| 4 | Auth : SecureStore, login, garde de route | 3 |
| 5 | File SQLite | 3 |
| 6 | Moteur de sync | 5 |
| 7 | Déclencheurs + barre de statut | 6 |
| 8 | Sélecteur de ferme + liste des lots | 4 |
| 9 | Détail lot (essentiels, cache) | 8 |
| 10 | Saisie journalier chair (cumul local) | 6, 9 |
| 11 | Saisie mortalité ponte | 2, 6, 9 |
| 12 | Saisie pesée | 2, 6, 9 |
| 13 | Saisie collecte d'œufs | 6, 9 |
| 14 | Écran file d'attente | 6, 7 |
| 15 | Recette mode avion | toutes |

---

### Task 1: Direction de design terrain

**REQUIRED SUB-SKILL:** invoquer `frontend-design` avant toute décision visuelle. Le design précède le code — contrainte explicite.

**Files:**
- Create: `docs/superpowers/specs/2026-07-20-b7-mobile-design-direction.md`
- Create: `mobile/src/theme/tokens.ts`
- Create: `mobile/src/theme/index.ts`

**Interfaces:**
- Produces: `tokens` (objet gelé : `colors`, `spacing`, `radii`, `typography`, `touch`), consommé par tous les composants des tâches 3→14.

**Contexte à charger avant de designer :** `docs/10-design-system.md` (palette §2, typo §3, espacement §4, mobile §9) et `docs/08-mobile-react-native.md` §4.

Doc 10 couvre déjà le socle : palette, échelle 4px, cibles 44×44, boutons 48px, ratios de contraste mesurés. **Le design B7 ne réinvente pas ça** — il le porte en RN et répond à ce que doc 10 ne traite pas, parce que doc 10 a été écrit pour du web responsive, pas pour du terrain :

1. **Lisibilité en plein soleil** — le contraste WCAG 4.5:1 est un plancher de bureau. Sous soleil sénégalais à midi, quels couples texte/fond restent lisibles ? Faut-il un mode « haute luminosité » ?
2. **Mains gantées ou sales** — 44×44 est un minimum d'accessibilité, pas un confort de terrain. Quelle taille réelle pour un bouton `+1 mort` utilisé cinquante fois d'affilée ?
3. **Usage à une main** — l'autre main porte un seau. Les actions primaires doivent tomber dans le pouce, donc **en bas** d'écran, jamais en haut.
4. **Saisie numérique** — un `+`/`−` large bat un champ texte avec clavier. Le clavier numérique masque la moitié de l'écran et se referme mal avec des doigts humides.
5. **Le statut offline est un élément de premier plan**, pas une icône discrète : l'éleveur doit savoir à tout instant si son travail est parti ou en attente. C'est le cœur de la confiance dans l'app.

- [ ] **Step 1: Invoquer la skill de design**

Invoquer `frontend-design` avec le contexte ci-dessus. Produire une direction visuelle qui répond aux 5 points, pas un thème générique.

- [ ] **Step 2: Écrire la direction de design**

Rédiger `docs/superpowers/specs/2026-07-20-b7-mobile-design-direction.md` couvrant : principes terrain retenus, hiérarchie des écrans, anatomie du composant de saisie numérique, traitement visuel des trois états de sync (synchronisé / en attente / échec), et les écarts assumés vis-à-vis de doc 10 avec leur justification.

- [ ] **Step 3: Écrire les tokens**

`mobile/src/theme/tokens.ts` — valeurs reprises de doc 10 §2/§3/§4, augmentées des décisions terrain de l'étape 2.

```typescript
export const tokens = {
  colors: {
    primary: { 50: '#F0F7F0', 100: '#DCEEDC', 200: '#B8DDB8', 300: '#8BC68B',
               400: '#5EAA5E', 500: '#3D8B3D', 600: '#2E6B2E' },
    accent:  { 400: '#F8961E', 500: '#E67E0A' },
    earth: '#122B12',
    // Complété à l'étape 2 : sémantiques (success/warning/danger),
    // neutres, et les couleurs des 3 états de sync.
  },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 },
  radii: { sm: 4, md: 8, lg: 12, full: 9999 },
  touch: { min: 44, button: 48, gap: 8 },
} as const;

export type Tokens = typeof tokens;
```

- [ ] **Step 4: Vérifier les contrastes**

Pour chaque couple texte/fond introduit à l'étape 2, calculer le ratio WCAG et le consigner dans la direction de design. Tout couple sous 4.5:1 (texte normal) ou 3:1 (texte ≥ 18px) est rejeté. Rappel doc 10 : blanc sur `accent-400` = 2.24:1, **interdit**.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-07-20-b7-mobile-design-direction.md mobile/src/theme/
git commit -m "design(mobile): field-mode design direction and RN tokens"
```

---

### Task 2: Backend — idempotence des saisies non rejouables

**Files:**
- Create: `backend/avicare-app/src/main/resources/db/migration/V30__mobile_idempotency.sql`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/domain/LifecycleEvent.java`
- Modify: `backend/avicare-app/src/main/java/com/avicare/livestock/poultry/WeighingSample.java`
- Modify: `.../livestock/dto/request/RecordMortalityRequest.java`
- Modify: `.../livestock/dto/request/WeighingRequest.java`
- Modify: `.../livestock/repository/LifecycleEventRepository.java`
- Modify: `.../livestock/repository/WeighingSampleRepository.java`
- Modify: `.../livestock/service/LivestockService.java`
- Modify: `.../livestock/poultry/GrowthAnalysisService.java`
- Test: `backend/avicare-app/src/test/java/com/avicare/livestock/MobileIdempotencyIT.java`

**Interfaces:**
- Produces: `RecordMortalityRequest(int count, String reason, UUID clientRef)` et `WeighingRequest(LocalDate sampleDate, List<Integer> individualWeights, String notes, UUID clientRef)` — consommés par les tâches 11 et 12.

**Pourquoi seulement ces deux :** `daily-records` (upsert sur `lot, date`) et `egg-production/collections` (upsert sur `unité, date, créneau`) sont idempotents par construction. `recordMortality` applique un delta `−count` et `recordWeighing` fait un `INSERT` pur : les rejouer corrompt l'effectif ou duplique un échantillon.

- [ ] **Step 1: Écrire le test d'intégration qui échoue**

`MobileIdempotencyIT.java` :

```java
@Test
void recordMortality_sameClientRef_appliesOnce() {
  UUID ref = UUID.randomUUID();
  int before = livestockService.getUnit(unitId).getCurrentCount();

  LifecycleEvent first = livestockService.recordMortality(unitId, 3, "field", userId, ref);
  LifecycleEvent replay = livestockService.recordMortality(unitId, 3, "field", userId, ref);

  assertThat(replay.getId()).isEqualTo(first.getId());
  assertThat(livestockService.getUnit(unitId).getCurrentCount()).isEqualTo(before - 3);
}

@Test
void recordMortality_nullClientRef_staysAppendOnly() {
  int before = livestockService.getUnit(unitId).getCurrentCount();

  livestockService.recordMortality(unitId, 2, "web", userId, null);
  livestockService.recordMortality(unitId, 2, "web", userId, null);

  assertThat(livestockService.getUnit(unitId).getCurrentCount()).isEqualTo(before - 4);
}

@Test
void recordWeighing_sameClientRef_createsOneSample() {
  UUID ref = UUID.randomUUID();
  WeighingCommand cmd = new WeighingCommand(LocalDate.now(), List.of(1200, 1250, 1180), null);

  WeighingSample first = growthAnalysisService.recordWeighing(batchId, cmd, userId, ref);
  WeighingSample replay = growthAnalysisService.recordWeighing(batchId, cmd, userId, ref);

  assertThat(replay.getId()).isEqualTo(first.getId());
  assertThat(weighingSampleRepository.findByPoultryBatchId(batchId)).hasSize(1);
}
```

Le second test est le garde-fou de non-régression : le web n'envoie pas de `clientRef` et doit conserver le comportement append.

- [ ] **Step 2: Vérifier que le test échoue**

Run: `cd backend && ./mvnw -pl avicare-app test-compile`
Expected: FAIL — `recordMortality` ne prend que 4 arguments.

- [ ] **Step 3: Écrire la migration**

`V30__mobile_idempotency.sql` :

```sql
-- Idempotency keys for mobile replay (doc 08 §9).
-- Only the two non-idempotent field endpoints need this: daily records and
-- egg collections are upserts and replay safely without a key.
ALTER TABLE lifecycle_events ADD COLUMN client_ref UUID NULL;
ALTER TABLE weighing_samples ADD COLUMN client_ref UUID NULL;

-- Partial: every web-originated row leaves client_ref NULL and must not collide.
CREATE UNIQUE INDEX uq_lifecycle_events_client_ref
  ON lifecycle_events (client_ref) WHERE client_ref IS NOT NULL;
CREATE UNIQUE INDEX uq_weighing_samples_client_ref
  ON weighing_samples (client_ref) WHERE client_ref IS NOT NULL;
```

- [ ] **Step 4: Mapper le champ sur les entités**

Dans `LifecycleEvent.java` et `WeighingSample.java` :

```java
@Column(name = "client_ref")
private UUID clientRef;
```

- [ ] **Step 5: Étendre les DTOs**

```java
public record RecordMortalityRequest(
    @Positive int count, @Size(max = 500) String reason, UUID clientRef) {}
```

```java
public record WeighingRequest(
    @NotNull LocalDate sampleDate,
    @NotEmpty List<@Positive Integer> individualWeights,
    @Size(max = 2000) String notes,
    UUID clientRef) {}
```

- [ ] **Step 6: Ajouter les lookups**

```java
Optional<LifecycleEvent> findByClientRef(UUID clientRef);
```

```java
Optional<WeighingSample> findByClientRef(UUID clientRef);
```

- [ ] **Step 7: Court-circuiter dans les services**

`LivestockService.recordMortality` — nouvelle surcharge, l'ancienne signature délègue avec `null` pour ne casser aucun appelant :

```java
@Transactional
public LifecycleEvent recordMortality(Long unitId, int count, String reason, Long userId) {
  return recordMortality(unitId, count, reason, userId, null);
}

@Transactional
public LifecycleEvent recordMortality(
    Long unitId, int count, String reason, Long userId, UUID clientRef) {
  if (count <= 0) {
    throw new BusinessRuleException("INVALID_MORTALITY_COUNT", "Mortality count must be positive");
  }
  if (clientRef != null) {
    Optional<LifecycleEvent> existing = lifecycleEventRepository.findByClientRef(clientRef);
    if (existing.isPresent()) {
      return existing.get();
    }
  }
  LifecycleEvent event = recordEvent(unitId, EVENT_MORTALITY, -count, reason, Map.of(), userId);
  event.setClientRef(clientRef);
  return event;
}
```

Même motif dans `GrowthAnalysisService.recordWeighing` : le court-circuit se place **avant** le calcul des statistiques et avant `computePerformance`.

- [ ] **Step 8: Câbler les contrôleurs**

Passer `request.clientRef()` dans `ProductionUnitController.recordMortality` et `PoultryWeighingController.recordWeighing`.

- [ ] **Step 9: Vérifier que les tests passent**

Run: `cd backend && ./mvnw -pl avicare-app verify`
Expected: BUILD SUCCESS, les 3 tests de `MobileIdempotencyIT` verts.

> Rappel environnement : les `*IT` sous Testcontainers ne tournent pas sur cette machine (Docker 29.x). Si l'exécution locale échoue au démarrage du conteneur, valider le reste en local et s'appuyer sur la CI, qui exécute bien `verify` depuis la PR #80.

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat(backend:livestock): idempotency key on mortality and weighing

Mobile replays queued mutations after a network drop, which would
double-decrement a flock or duplicate a weighing sample. An optional
client_ref short-circuits both, returning the original row.

Daily records and egg collections are upserts and need no key.
Web writes leave client_ref NULL, hence the partial unique index."
```

---

### Task 3: Bootstrap Expo, thème et harnais de test

**Files:**
- Modify: `mobile/package.json`, `mobile/tsconfig.json`, `mobile/app.json`
- Delete: `mobile/App.tsx` (remplacé par expo-router)
- Create: `mobile/app/_layout.tsx`, `mobile/index.ts`
- Create: `mobile/jest.config.js`, `mobile/jest.setup.ts`
- Test: `mobile/src/theme/__tests__/tokens.test.ts`

**Interfaces:**
- Produces: projet Expo démarrable, `npm test` opérationnel, routing expo-router actif.

- [ ] **Step 1: Installer les dépendances**

```bash
cd mobile
npx expo install expo-router expo-sqlite expo-secure-store expo-constants expo-linking \
  react-native-safe-area-context react-native-screens @react-native-async-storage/async-storage \
  @react-native-community/netinfo
npm install @reduxjs/toolkit react-redux redux-persist react-hook-form zod @hookform/resolvers
npm install --save-dev jest jest-expo @testing-library/react-native @types/jest better-sqlite3 @types/better-sqlite3
```

`better-sqlite3` est un **devDependency** : il n'entre jamais dans le bundle. Il sert à exécuter le vrai SQL de la file dans les tests Node (tâche 5), là où `expo-sqlite` exige un runtime natif.

- [ ] **Step 2: Configurer TypeScript strict**

`mobile/tsconfig.json` :

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 3: Basculer l'entrée sur expo-router**

`mobile/index.ts` :

```typescript
import 'expo-router/entry';
```

Dans `mobile/app.json`, ajouter `"scheme": "avicare"` et `"plugins": ["expo-router"]`. Supprimer `mobile/App.tsx`.

- [ ] **Step 4: Configurer Jest**

`mobile/jest.config.js` :

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|react-navigation|@react-navigation/.*)/)',
  ],
};
```

Ajouter `"test": "jest"` aux scripts de `package.json`.

- [ ] **Step 5: Écrire le test de garde des tokens**

`mobile/src/theme/__tests__/tokens.test.ts` :

```typescript
import { tokens } from '../tokens';

describe('design tokens', () => {
  it('keeps the locked brand colours from doc 10', () => {
    expect(tokens.colors.primary[500]).toBe('#3D8B3D');
    expect(tokens.colors.primary[600]).toBe('#2E6B2E');
    expect(tokens.colors.accent[400]).toBe('#F8961E');
  });

  it('meets the doc 10 touch-target floor', () => {
    expect(tokens.touch.min).toBeGreaterThanOrEqual(44);
    expect(tokens.touch.button).toBeGreaterThanOrEqual(48);
  });

  it('uses a 4px spacing scale', () => {
    for (const value of Object.values(tokens.spacing)) {
      expect(value % 4).toBe(0);
    }
  });
});
```

- [ ] **Step 6: Écrire le layout racine**

`mobile/app/_layout.tsx` :

```tsx
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 7: Vérifier**

Run: `cd mobile && npx tsc --noEmit && npm test`
Expected: 0 erreur TypeScript, 3 tests verts.

Run: `cd mobile && npx expo start`
Expected: le bundler démarre, l'app se charge dans Expo Go sans écran rouge.

- [ ] **Step 8: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): bootstrap expo-router, strict TS and jest harness"
```

---

### Task 4: Authentification

**Files:**
- Create: `mobile/src/auth/tokens.ts`, `mobile/src/auth/session.ts`
- Create: `mobile/src/store/api/baseApi.ts`, `mobile/src/store/api/authApi.ts`, `mobile/src/store/index.ts`
- Create: `mobile/app/(auth)/login.tsx`, `mobile/app/(auth)/_layout.tsx`, `mobile/app/(field)/_layout.tsx`
- Test: `mobile/src/auth/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `tokens` (Tâche 1).
- Produces: `saveTokens(t: AuthTokens): Promise<void>`, `getAccessToken(): Promise<string | null>`, `clearTokens(): Promise<void>`, `decodeSession(accessToken: string): Session`, où `Session = { userId: number; role: 'ADMIN' | 'USER'; memberships: Membership[] }` et `Membership = { farmId: number; farmRole: string; permissions: string[] }`.

**Rappel :** aucun travail backend. `AuthController` fait transiter le refresh token dans le **body** (« mobile / Bearer-first »).

- [ ] **Step 1: Écrire le test de session**

```typescript
import { decodeSession, hasFieldAccess } from '../session';

const payload = {
  sub: '42', role: 'USER',
  memberships: [{ farmId: 7, farmRole: 'FARMER', permissions: ['livestock:write'] }],
};
const token = `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.y`;

describe('decodeSession', () => {
  it('reads userId, role and memberships from the JWT claims', () => {
    const session = decodeSession(token);
    expect(session.userId).toBe(42);
    expect(session.memberships[0]?.farmId).toBe(7);
  });

  it('grants field access to FARMER but not to BUYER', () => {
    expect(hasFieldAccess(decodeSession(token))).toBe(true);
    const buyer = { ...payload, memberships: [{ farmId: 7, farmRole: 'BUYER', permissions: [] }] };
    const buyerToken = `x.${Buffer.from(JSON.stringify(buyer)).toString('base64url')}.y`;
    expect(hasFieldAccess(decodeSession(buyerToken))).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd mobile && npm test -- session`
Expected: FAIL — module `../session` introuvable.

- [ ] **Step 3: Implémenter session.ts**

```typescript
export type Membership = { farmId: number; farmRole: string; permissions: string[] };
export type Session = { userId: number; role: 'ADMIN' | 'USER'; memberships: Membership[] };

const FIELD_ROLES = ['OWNER', 'MANAGER', 'FARMER', 'VETERINARIAN'];

export function decodeSession(accessToken: string): Session {
  const part = accessToken.split('.')[1];
  if (!part) throw new Error('Malformed JWT');
  const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  return {
    userId: Number(claims.sub),
    role: claims.role,
    memberships: claims.memberships ?? [],
  };
}

export function hasFieldAccess(session: Session): boolean {
  return session.memberships.some((m) => FIELD_ROLES.includes(m.farmRole));
}
```

> `Buffer` n'existe pas nativement sous Hermes. Ajouter `import { Buffer } from 'buffer';` en tête du module et vérifier que le bundle démarre à l'étape 7.

- [ ] **Step 4: Implémenter tokens.ts**

```typescript
import * as SecureStore from 'expo-secure-store';

const ACCESS = 'avicare.accessToken';
const REFRESH = 'avicare.refreshToken';

export type AuthTokens = { accessToken: string; refreshToken: string };

export async function saveTokens(t: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, t.accessToken);
  await SecureStore.setItemAsync(REFRESH, t.refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
}
```

Jamais dans AsyncStorage, jamais dans le state Redux persisté.

- [ ] **Step 5: Implémenter baseApi avec refresh sur 401**

`baseQueryWithReauth` : sur `401`, appeler `POST /api/v1/auth/refresh` avec le refresh token en body, sauvegarder les nouveaux tokens, rejouer **une seule fois**. Sur échec du refresh, `clearTokens()` puis redirection vers `(auth)/login`.

- [ ] **Step 6: Écrire l'écran de login et les gardes**

`(auth)/login.tsx` : formulaire React Hook Form + Zod (email, mot de passe), bouton hauteur `tokens.touch.button`. `(field)/_layout.tsx` : si pas de token → redirection login ; si token mais `hasFieldAccess === false` → écran « Application réservée aux équipes de terrain ».

- [ ] **Step 7: Vérifier**

Run: `cd mobile && npm test && npx tsc --noEmit`
Expected: tous verts.

Vérification manuelle dans Expo Go : login avec un compte réel, puis relancer l'app → la session persiste sans redemander le mot de passe.

- [ ] **Step 8: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): auth with secure token storage and field-role guard"
```

---

### Task 5: File de mutations SQLite

**Files:**
- Create: `mobile/src/sync/types.ts`, `schema.ts`, `driver.ts`, `queue.ts`
- Test: `mobile/src/sync/__tests__/queue.test.ts`, `mobile/src/sync/__tests__/fakeDriver.ts`

**Interfaces:**
- Produces:
  - `type MutationKind = 'DAILY_RECORD' | 'MORTALITY' | 'WEIGHING' | 'EGG_COLLECTION'`
  - `type QueuedMutation = { id: number; clientRef: string; farmId: number; kind: MutationKind; endpoint: string; payload: unknown; status: 'PENDING' | 'IN_FLIGHT' | 'FAILED'; attempts: number; lastError: string | null; createdAt: string }`
  - `interface SqlDriver { exec(sql: string): void; run(sql: string, params: unknown[]): void; all<T>(sql: string, params: unknown[]): T[] }`
  - `createQueue(driver: SqlDriver)` → `{ enqueue, peekNext, markDone, markFailed, markPending, bumpAttempts, countPending, listFailed, listAll }`

  Signatures exactes :
  ```typescript
  enqueue(m: Omit<QueuedMutation, 'id' | 'status' | 'attempts' | 'lastError' | 'createdAt'>): void
  peekNext(): QueuedMutation | null   // null si vide ou si tout est FAILED
  markDone(id: number): void          // DELETE — la file est un tampon, pas un journal
  markFailed(id: number, message: string): void
  markPending(id: number): void       // « Réessayer » depuis l'écran file
  bumpAttempts(id: number): void
  countPending(): number              // PENDING + IN_FLIGHT, hors FAILED
  listFailed(): QueuedMutation[]
  listAll(): QueuedMutation[]         // ordre d'insertion, tous statuts
  ```

**Pourquoi une interface `SqlDriver` :** `expo-sqlite` exige un runtime natif et ne s'exécute pas sous Jest. En isolant le driver, les tests font tourner **le vrai SQL** via `better-sqlite3` en mémoire — on teste les requêtes réellement, pas un mock qui ment.

- [ ] **Step 1: Écrire le faux driver**

```typescript
import Database from 'better-sqlite3';
import type { SqlDriver } from '../types';

export function createFakeDriver(): SqlDriver {
  const db = new Database(':memory:');
  return {
    exec: (sql) => { db.exec(sql); },
    run: (sql, params) => { db.prepare(sql).run(...(params as never[])); },
    all: <T>(sql: string, params: unknown[]) => db.prepare(sql).all(...(params as never[])) as T[],
  };
}
```

- [ ] **Step 2: Écrire les tests de la file**

```typescript
import { createFakeDriver } from './fakeDriver';
import { createQueue } from '../queue';
import { QUEUE_SCHEMA } from '../schema';

function setup() {
  const driver = createFakeDriver();
  driver.exec(QUEUE_SCHEMA);
  return createQueue(driver);
}

const mutation = {
  clientRef: 'ref-1', farmId: 7, kind: 'MORTALITY' as const,
  endpoint: '/api/v1/farms/7/production-units/3/mortality',
  payload: { count: 2, reason: 'field' },
};

describe('mutation queue', () => {
  it('returns mutations in insertion order', () => {
    const q = setup();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    expect(q.peekNext()?.clientRef).toBe('a');
  });

  it('removes a mutation once done', () => {
    const q = setup();
    q.enqueue(mutation);
    const next = q.peekNext();
    q.markDone(next!.id);
    expect(q.peekNext()).toBeNull();
    expect(q.countPending()).toBe(0);
  });

  it('rejects a duplicate clientRef', () => {
    const q = setup();
    q.enqueue(mutation);
    expect(() => q.enqueue(mutation)).toThrow();
  });

  it('skips failed mutations when peeking', () => {
    const q = setup();
    q.enqueue(mutation);
    q.markFailed(q.peekNext()!.id, 'Effectif insuffisant');
    expect(q.peekNext()).toBeNull();
    expect(q.listFailed()).toHaveLength(1);
    expect(q.listFailed()[0]?.lastError).toBe('Effectif insuffisant');
  });

  it('counts only pending mutations', () => {
    const q = setup();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    q.markFailed(q.peekNext()!.id, 'boom');
    expect(q.countPending()).toBe(1);
  });

  it('round-trips the payload as JSON', () => {
    const q = setup();
    q.enqueue(mutation);
    expect(q.peekNext()?.payload).toEqual({ count: 2, reason: 'field' });
  });
});
```

Le test « skips failed » encode la décision M7 : un échec définitif ne doit pas bloquer la file derrière lui.

- [ ] **Step 3: Vérifier l'échec**

Run: `cd mobile && npm test -- queue`
Expected: FAIL — `../queue` introuvable.

- [ ] **Step 4: Écrire le schéma**

```typescript
export const QUEUE_SCHEMA = `
CREATE TABLE IF NOT EXISTS mutation_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_ref  TEXT NOT NULL UNIQUE,
  farm_id     INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  endpoint    TEXT NOT NULL,
  payload     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mutation_queue_status ON mutation_queue (status, id);
`;
```

- [ ] **Step 5: Implémenter la file**

`peekNext` sélectionne `WHERE status IN ('PENDING','IN_FLIGHT') ORDER BY id LIMIT 1` — `IN_FLIGHT` est repris car une mutation laissée en vol par un crash doit repartir. `markDone` fait un `DELETE` (la file est un tampon, pas un journal). `markFailed` passe en `FAILED` et incrémente `attempts`.

- [ ] **Step 6: Implémenter le driver expo-sqlite**

`driver.ts` — même interface, adossée à `openDatabaseSync('avicare.db')`.

- [ ] **Step 7: Vérifier**

Run: `cd mobile && npm test -- queue`
Expected: 6 tests verts.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/sync/
git commit -m "feat(mobile): durable SQLite mutation queue"
```

---

### Task 6: Moteur de synchronisation

**Files:**
- Create: `mobile/src/sync/engine.ts`
- Test: `mobile/src/sync/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `createQueue` (Tâche 5), `getAccessToken` (Tâche 4).
- Produces: `createEngine({ queue, transport, refresh, now })` → `{ drain(): Promise<DrainResult> }` avec `DrainResult = { sent: number; failed: number; retryable: number }`. `transport(m: QueuedMutation): Promise<{ status: number; body?: unknown }>`.

**Règle centrale (M7) :** `4xx` hors `401` est **définitif**. Un `422` (règle métier) ou un `403` (module inactif) ne passera jamais en le rejouant ; le laisser en tête de file gèlerait toutes les saisies suivantes.

- [ ] **Step 1: Écrire les tests du moteur**

```typescript
describe('sync engine', () => {
  it('removes a mutation after a 2xx', async () => {
    const q = setupQueue(); q.enqueue(mutation);
    const engine = createEngine({ queue: q, transport: async () => ({ status: 201 }) });
    const result = await engine.drain();
    expect(result.sent).toBe(1);
    expect(q.countPending()).toBe(0);
  });

  it('parks a 422 as terminal and keeps draining', async () => {
    const q = setupQueue();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    let call = 0;
    const engine = createEngine({
      queue: q,
      transport: async () => (++call === 1
        ? { status: 422, body: { detail: 'Effectif insuffisant' } }
        : { status: 201 }),
    });
    const result = await engine.drain();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(1);
    expect(q.listFailed()[0]?.lastError).toBe('Effectif insuffisant');
  });

  it('keeps a 500 retryable and stops the pass', async () => {
    const q = setupQueue(); q.enqueue(mutation);
    const engine = createEngine({ queue: q, transport: async () => ({ status: 503 }) });
    const result = await engine.drain();
    expect(result.retryable).toBe(1);
    expect(q.countPending()).toBe(1);
    expect(q.listFailed()).toHaveLength(0);
  });

  it('refreshes once on 401 then replays', async () => {
    const q = setupQueue(); q.enqueue(mutation);
    let refreshed = false; let call = 0;
    const engine = createEngine({
      queue: q,
      transport: async () => (++call === 1 ? { status: 401 } : { status: 201 }),
      refresh: async () => { refreshed = true; return true; },
    });
    const result = await engine.drain();
    expect(refreshed).toBe(true);
    expect(result.sent).toBe(1);
  });

  it('gives up after the attempt ceiling', async () => {
    const q = setupQueue(); q.enqueue(mutation);
    const engine = createEngine({ queue: q, transport: async () => ({ status: 503 }), maxAttempts: 3 });
    await engine.drain(); await engine.drain(); await engine.drain();
    expect(q.listFailed()).toHaveLength(1);
  });

  it('sends one mutation at a time, in order', async () => {
    const q = setupQueue();
    q.enqueue({ ...mutation, clientRef: 'a' });
    q.enqueue({ ...mutation, clientRef: 'b' });
    const seen: string[] = [];
    const engine = createEngine({
      queue: q,
      transport: async (m) => { seen.push(m.clientRef); return { status: 201 }; },
    });
    await engine.drain();
    expect(seen).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `cd mobile && npm test -- engine`
Expected: FAIL — `createEngine` introuvable.

- [ ] **Step 3: Implémenter le moteur**

```typescript
const MAX_BACKOFF_MS = 5 * 60 * 1000;

export function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS);
}

export function createEngine(deps: EngineDeps) {
  const { queue, transport, refresh, maxAttempts = 8 } = deps;
  let running = false;

  async function drain(): Promise<DrainResult> {
    if (running) return { sent: 0, failed: 0, retryable: 0 };
    running = true;
    const result = { sent: 0, failed: 0, retryable: 0 };
    try {
      let refreshedThisPass = false;
      for (;;) {
        const next = queue.peekNext();
        if (!next) break;

        let response = await transport(next);

        if (response.status === 401 && refresh && !refreshedThisPass) {
          refreshedThisPass = true;
          const ok = await refresh();
          if (!ok) { result.retryable += 1; break; }
          response = await transport(next);
        }

        if (response.status >= 200 && response.status < 300) {
          queue.markDone(next.id);
          result.sent += 1;
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          queue.markFailed(next.id, detailOf(response) ?? `HTTP ${response.status}`);
          result.failed += 1;
          continue;
        }

        // 5xx or transport error: retryable. Stop this pass, keep order.
        if (next.attempts + 1 >= maxAttempts) {
          queue.markFailed(next.id, `HTTP ${response.status} after ${maxAttempts} attempts`);
          result.failed += 1;
        } else {
          queue.bumpAttempts(next.id);
          result.retryable += 1;
        }
        break;
      }
    } finally {
      running = false;
    }
    return result;
  }

  return { drain };
}
```

Le `detail` extrait du Problem Details RFC 7807 (doc 06) est stocké tel quel : c'est le message que verra l'éleveur.

Le garde `running` empêche deux drains concurrents (retour réseau + passage au premier plan peuvent se déclencher à la même seconde).

Ajouter `bumpAttempts(id: number): void` à la file (Tâche 5) et son test.

- [ ] **Step 4: Vérifier**

Run: `cd mobile && npm test -- engine`
Expected: 6 tests verts.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/sync/
git commit -m "feat(mobile): sync engine with terminal 4xx and retryable 5xx"
```

---

### Task 7: Déclencheurs et barre de statut

**Files:**
- Create: `mobile/src/sync/triggers.ts`, `mobile/src/sync/useSyncStatus.ts`
- Create: `mobile/src/components/SyncStatusBar.tsx`
- Modify: `mobile/app/(field)/_layout.tsx`
- Test: `mobile/src/components/__tests__/SyncStatusBar.test.tsx`

**Interfaces:**
- Consumes: `createEngine` (Tâche 6), `countPending` (Tâche 5).
- Produces: `useSyncStatus()` → `{ online: boolean; pending: number; failed: number; syncing: boolean }`.

- [ ] **Step 1: Écrire le test du composant**

```tsx
it('shows the pending count when offline', () => {
  render(<SyncStatusBar online={false} pending={5} failed={0} syncing={false} />);
  expect(screen.getByText('5 actions en attente de sync')).toBeTruthy();
});

it('singularises one pending action', () => {
  render(<SyncStatusBar online={false} pending={1} failed={0} syncing={false} />);
  expect(screen.getByText('1 action en attente de sync')).toBeTruthy();
});

it('confirms everything is synced when online and empty', () => {
  render(<SyncStatusBar online pending={0} failed={0} syncing={false} />);
  expect(screen.getByText('Tout est synchronisé')).toBeTruthy();
});

it('surfaces failures over the pending count', () => {
  render(<SyncStatusBar online pending={2} failed={1} syncing={false} />);
  expect(screen.getByText('1 saisie à corriger')).toBeTruthy();
});
```

Le dernier test encode une décision d'UX : un échec définitif exige une action de l'éleveur, il prime sur le simple compteur d'attente.

- [ ] **Step 2: Vérifier l'échec, puis implémenter**

Run: `cd mobile && npm test -- SyncStatusBar` → FAIL, puis écrire le composant selon la direction de design (Tâche 1, état visuel des 3 statuts).

- [ ] **Step 3: Câbler les déclencheurs**

`triggers.ts` : `NetInfo.addEventListener` sur transition `false → true` → `drain()`. `AppState` sur passage `active` → `drain()`. Les deux désabonnements retournés pour nettoyage.

- [ ] **Step 4: Monter la barre dans le layout terrain**

Placer `<SyncStatusBar />` dans `(field)/_layout.tsx` pour qu'elle soit visible sur tous les écrans terrain — critère d'acceptation de la roadmap.

- [ ] **Step 5: Vérifier et commiter**

Run: `cd mobile && npm test && npx tsc --noEmit`

```bash
git add mobile/
git commit -m "feat(mobile): sync triggers and always-visible status bar"
```

---

### Task 8: Sélecteur de ferme et liste des lots

**Files:**
- Create: `mobile/src/store/api/farmsApi.ts`, `productionUnitsApi.ts`
- Create: `mobile/app/(field)/index.tsx`, `mobile/app/(field)/lots/index.tsx`
- Create: `mobile/src/store/persist.ts`
- Test: `mobile/src/store/api/__tests__/productionUnitsApi.test.ts`

**Interfaces:**
- Consumes: `baseApi` (Tâche 4).
- Produces: `useListFarmsQuery()`, `useListProductionUnitsQuery(farmId)`.

Endpoints réels : `GET /api/v1/farms` et `GET /api/v1/farms/{farmId}/production-units`.

- [ ] **Step 1: Configurer la persistance restreinte**

`persist.ts` — whitelist limitée au slice `api` et purge au logout et au changement de ferme. Le cache est jetable : aucune donnée non resynchronisable n'y vit.

- [ ] **Step 2: Écrire le test de sélection**

Vérifier que le sélecteur de ferme filtre les lots sur `farmId` et que la liste reste rendue depuis le cache quand la requête échoue (mode hors ligne).

- [ ] **Step 3: Implémenter, vérifier, commiter**

```bash
git add mobile/
git commit -m "feat(mobile): farm selector and cached batch list"
```

---

### Task 9: Détail lot — les essentiels

**Files:**
- Create: `mobile/app/(field)/lots/[unitId]/index.tsx`
- Create: `mobile/src/components/UnitEssentials.tsx`
- Test: `mobile/src/components/__tests__/UnitEssentials.test.tsx`

Affiche effectif actuel, âge en jours, race, et les saisies du jour. C'est la décision M2 : l'éleveur doit voir l'effectif qu'il décrémente, sinon il travaille à l'aveugle.

- [ ] **Step 1: Écrire le test**

```tsx
it('shows the current head count from cache when offline', () => {
  render(<UnitEssentials unit={{ currentCount: 480, ageDays: 21, breedName: 'Cobb 500' }} stale />);
  expect(screen.getByText('480')).toBeTruthy();
  expect(screen.getByText(/21 jours/)).toBeTruthy();
});

it('flags the data as possibly stale when offline', () => {
  render(<UnitEssentials unit={{ currentCount: 480, ageDays: 21, breedName: 'Cobb 500' }} stale />);
  expect(screen.getByText(/dernière mise à jour/i)).toBeTruthy();
});
```

Le second test compte : afficher une donnée en cache sans dire qu'elle peut être périmée est un mensonge d'interface.

- [ ] **Step 2: Implémenter, vérifier, commiter**

```bash
git add mobile/
git commit -m "feat(mobile): batch essentials screen with staleness indicator"
```

---

### Task 10: Saisie journalier chair — cumul local

**Files:**
- Create: `mobile/app/(field)/lots/[unitId]/journalier.tsx`
- Create: `mobile/src/field/dailyAccumulator.ts`
- Test: `mobile/src/field/__tests__/dailyAccumulator.test.ts`

**Interfaces:**
- Consumes: `createQueue` (Tâche 5).
- Produces: `accumulateDaily(existing: DailyDraft | null, delta: Partial<DailyDraft>): DailyDraft`.

**Le piège (doc 08 §10) :** l'endpoint est un **upsert par jour**. Cinq appuis sur `+1 mort` ne sont pas cinq additions serveur — ce sont cinq réécritures. Le mobile tient le cumul et pousse le total.

- [ ] **Step 1: Écrire les tests du cumul**

```typescript
describe('daily accumulator', () => {
  it('starts from zero on the first entry', () => {
    expect(accumulateDaily(null, { mortalityCount: 1 }).mortalityCount).toBe(1);
  });

  it('adds successive mortalities into a running total', () => {
    let d = accumulateDaily(null, { mortalityCount: 1 });
    d = accumulateDaily(d, { mortalityCount: 1 });
    d = accumulateDaily(d, { mortalityCount: 1 });
    expect(d.mortalityCount).toBe(3);
  });

  it('replaces feed and water instead of adding them', () => {
    let d = accumulateDaily(null, { feedKg: 25 });
    d = accumulateDaily(d, { feedKg: 30 });
    expect(d.feedKg).toBe(30);
  });

  it('never goes below zero on a correction', () => {
    const d = accumulateDaily({ mortalityCount: 2, feedKg: 0, waterL: 0 }, { mortalityCount: -5 });
    expect(d.mortalityCount).toBe(0);
  });
});
```

Mortalité = cumul, aliment et eau = remplacement : ce sont des relevés du jour, pas des incréments. La distinction doit être explicite dans le code, elle n'est pas devinable.

- [ ] **Step 2: Vérifier l'échec, implémenter, vérifier**

Run: `cd mobile && npm test -- dailyAccumulator`

- [ ] **Step 3: Écrire l'écran**

Boutons `+1` / `−1` larges (taille issue de la Tâche 1), total du jour affiché en gros. À la validation : `enqueue` avec `kind: 'DAILY_RECORD'`, endpoint `/api/v1/farms/{farmId}/poultry-batches/{batchId}/daily-records`, payload `{ recordDate, mortalityCount, feedKg, waterL }`. Pas de `clientRef` nécessaire côté serveur, mais on en génère un pour l'unicité en file locale.

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): broiler daily entry with local running total"
```

---

### Task 11: Saisie mortalité ponte

**Files:**
- Create: `mobile/app/(field)/lots/[unitId]/mortalite.tsx`
- Test: `mobile/app/(field)/lots/[unitId]/__tests__/mortalite.test.tsx`

Pour un lot **ponte**, la mortalité passe par l'événement d'attrition, un append. Chaque saisie est une action distincte en file, porteuse de son `clientRef` (Tâche 2).

- [ ] **Step 1: Écrire le test**

```tsx
it('enqueues one mutation per submission, each with its own clientRef', async () => {
  const q = setupQueue();
  render(<MortalityScreen unitId={3} farmId={7} queue={q} />);
  fireEvent.press(screen.getByText('Enregistrer'));
  fireEvent.press(screen.getByText('Enregistrer'));
  const refs = q.listAll().map((m) => m.clientRef);
  expect(new Set(refs).size).toBe(2);
});
```

- [ ] **Step 2: Implémenter, vérifier, commiter**

Endpoint `/api/v1/farms/{farmId}/production-units/{unitId}/mortality`, payload `{ count, reason, clientRef }`.

```bash
git add mobile/
git commit -m "feat(mobile): layer mortality entry with idempotency key"
```

---

### Task 12: Saisie pesée

**Files:**
- Create: `mobile/app/(field)/lots/[unitId]/pesee.tsx`
- Test: correspondant

Saisie de N poids individuels en grammes. Endpoint `/api/v1/farms/{farmId}/poultry-batches/{batchId}/weighings`, payload `{ sampleDate, individualWeights, notes, clientRef }`.

- [ ] **Step 1: Test — la liste de poids survit à une mise en file et se recharge intacte**
- [ ] **Step 2: Implémenter (saisie rapide successive, suppression d'une valeur mal saisie, moyenne affichée en direct)**
- [ ] **Step 3: Commit** — `feat(mobile): weighing sample entry`

---

### Task 13: Saisie collecte d'œufs

**Files:**
- Create: `mobile/app/(field)/lots/[unitId]/oeufs.tsx`
- Test: correspondant

Endpoint `/api/v1/farms/{farmId}/egg-production/collections`, payload `{ unitId, collectionDate, timeslotKey, totalEggs, brokenEggs }`. Upsert sur `(unité, date, créneau)` — rejeu sûr, pas de `clientRef` serveur.

Le `timeslotKey` vient du paramétrage ferme (catalogue), pas d'une liste en dur — **Règle d'or n°0** du doc 00.

- [ ] **Step 1: Test — deux saisies sur le même créneau produisent une seule entrée en file (remplacement, pas empilement)**
- [ ] **Step 2: Implémenter**
- [ ] **Step 3: Commit** — `feat(mobile): egg collection entry`

---

### Task 14: Écran file d'attente

**Files:**
- Create: `mobile/app/(field)/file.tsx`
- Test: correspondant

Liste les mutations en attente et en échec. Pour chaque échec : le `detail` RFC 7807 tel que renvoyé par le serveur, plus deux actions — **Réessayer** (repasse en `PENDING`) et **Supprimer**.

- [ ] **Step 1: Test — un élément en échec affiche le message serveur, pas un texte générique**

```tsx
it('shows the server message on a failed mutation', () => {
  const q = setupQueue();
  q.enqueue(mutation);
  q.markFailed(q.peekNext()!.id, 'Le module Inventaire est inactif');
  render(<QueueScreen queue={q} />);
  expect(screen.getByText('Le module Inventaire est inactif')).toBeTruthy();
});
```

Afficher « Erreur de synchronisation » à la place serait une régression : l'éleveur ne saurait pas quoi corriger.

- [ ] **Step 2: Implémenter, vérifier, commiter** — `feat(mobile): pending and failed mutation queue screen`

---

### Task 15: Recette mode avion

**Files:**
- Create: `docs/superpowers/plans/2026-07-20-b7-acceptance-log.md`

Le scénario d'acceptation de `01-roadmap-v1.md` § B7, exécuté à la main sur un appareil réel.

- [ ] **Step 1:** Installer l'app, se connecter, sélectionner ferme puis lot. ✅ attendu : les essentiels du lot s'affichent.
- [ ] **Step 2:** Activer le mode avion.
- [ ] **Step 3:** Saisir 5 mortalités sur un lot chair. ✅ attendu : le compteur du jour affiche 5, la barre indique « 1 action en attente de sync » (un upsert, pas cinq).
- [ ] **Step 4:** Saisir une pesée et une collecte d'œufs. ✅ attendu : « 3 actions en attente de sync ».
- [ ] **Step 5:** Tuer l'app, la relancer, toujours en mode avion. ✅ attendu : les 3 actions sont toujours en file — c'est le test de durabilité SQLite.
- [ ] **Step 6:** Désactiver le mode avion. ✅ attendu : la file se vide seule, la barre passe à « Tout est synchronisé ».
- [ ] **Step 7:** Vérifier côté web que l'effectif du lot a bien baissé de 5, **exactement une fois**.
- [ ] **Step 8:** Couper le réseau au milieu d'un drain, le rétablir. ✅ attendu : aucun doublon (c'est la clé `client_ref` de la Tâche 2 qui est éprouvée ici).
- [ ] **Step 9:** Consigner les résultats et commiter le journal de recette.

---

## Self-Review

**Couverture de la spec (doc 08) :** §1 périmètre → Tâches 1-14. §2 stack → Tâche 3. §3 structure → Tâche 3. §4 navigation → Tâches 3, 4, 8. §5 auth → Tâche 4. §6 persistance → Tâches 5, 8. §7 moteur → Tâches 6, 7. §8 idempotence → Tâche 2. §9 backend → Tâche 2. §10 mortalité → Tâches 10, 11. §11 conflits → couvert par les upserts, éprouvé en Tâche 15 étape 7. §12 tests → chaque tâche + Tâche 15. §13 conventions → Global Constraints.

**Écarts assumés :** les Tâches 12 et 13 sont décrites plus brièvement que les autres — elles reprennent exactement le motif établi en Tâches 10 et 11 (formulaire → `enqueue` → drain), avec un endpoint et un payload différents, tous deux donnés explicitement. Les Tâches 8 et 9 dépendent visuellement de la sortie de la Tâche 1, qui ne peut pas être pré-écrite : c'est la nature d'une tâche de design.

**Cohérence des types :** `QueuedMutation.clientRef` est un `string` côté mobile et un `UUID` côté Java — la conversion se fait au niveau du payload JSON. `markFailed(id, message)` et `bumpAttempts(id)` sont utilisés en Tâche 6 et définis en Tâche 5.

---

## Références

- `docs/08-mobile-react-native.md` — spec d'architecture, décisions M1→M10
- `docs/10-design-system.md` — tokens, contrastes mesurés, mobile §9
- `docs/01-roadmap-v1.md` § Sprint B7 — critères d'acceptation
- `docs/06-cross-cutting.md` — Problem Details RFC 7807
