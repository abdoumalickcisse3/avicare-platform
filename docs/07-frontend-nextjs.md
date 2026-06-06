# 07 — Frontend Next.js

> Architecture frontend AviCare Platform.
> Référence pour Sprint A6 (bootstrap frontend) et tous les sprints frontend Phase B+.
>
> **Pré-requis :** avoir lu `00-vision-strategique.md`, `06-cross-cutting.md`, `10-design-system.md`.

---

## Table des matières

1. [Stack & versions](#1-stack--versions)
2. [Structure du projet](#2-structure-du-projet)
3. [App Router & routing](#3-app-router--routing)
4. [State management (RTK Query)](#4-state-management-rtk-query)
5. [Authentification & sessions](#5-authentification--sessions)
6. [Patterns UI (MUI v7)](#6-patterns-ui-mui-v7)
7. [i18n](#7-i18n)
8. [Erreurs & loading states](#8-erreurs--loading-states)
9. [Tests](#9-tests)
10. [Performance & SEO](#10-performance--seo)
11. [Conventions code](#11-conventions-code)

---

## 1. Stack & versions

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Next.js 16** (App Router) | React 19, RSC, modern routing |
| Langage | **TypeScript 5.x** strict | Type safety obligatoire |
| UI library | **MUI v7 + Emotion** | Mature, themable, accessible |
| Theme | `avicareTheme` (custom doc 10) | Identité visuelle non-générique |
| State | **Redux Toolkit + RTK Query** | Cache + mutations + invalidation auto |
| Forms | **React Hook Form + Zod** | Validation typée + perf |
| Icons | **lucide-react** | Modernes, cohérentes |
| Charts | **Recharts** | React-natif, MUI-friendly |
| Date | **date-fns** | Léger, tree-shakeable |
| HTTP | **Axios via RTK Query baseQuery** | Interceptors auth |
| Tests | **Vitest + Testing Library** | Rapide, ESM-native |
| E2E | **Playwright** | Multi-browser, robuste |
| Linting | **ESLint + Prettier** | Standard projet |

---

## 2. Structure du projet

```
web/
├── public/
│   ├── icons/              # Icônes métier custom (poulet, œuf, lot…)
│   ├── images/             # Logo, illustrations
│   └── locales/            # Fichiers i18n (V2+)
│
├── src/
│   ├── app/                # App Router (Next.js 16)
│   │   ├── (auth)/         # Group: pages auth sans AppShell
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── layout.tsx  # Layout split-screen
│   │   │
│   │   ├── (dashboard)/    # Group: pages avec AppShell
│   │   │   ├── dashboard/
│   │   │   ├── elevage/
│   │   │   │   ├── lots/
│   │   │   │   ├── oeufs/
│   │   │   │   └── chair/
│   │   │   ├── commercial/
│   │   │   │   ├── commandes/
│   │   │   │   ├── ventes/
│   │   │   │   └── clients/
│   │   │   ├── stocks/
│   │   │   ├── finance/
│   │   │   ├── reglages/   # Hub paramétrage (Sprint A6-3)
│   │   │   ├── fermes/     # Liste + détail fermes
│   │   │   └── layout.tsx  # AppShell (header + sidebar)
│   │   │
│   │   ├── (onboarding)/   # Wizard premier user
│   │   ├── (terrain)/      # Mode kiosque tactile farmer
│   │   ├── portail/        # Buyer portal (read-only)
│   │   ├── layout.tsx      # Root (Providers)
│   │   ├── page.tsx        # Landing / redirect /dashboard
│   │   ├── 403.tsx
│   │   ├── 404.tsx
│   │   ├── 500.tsx
│   │   └── error.tsx       # Global error boundary
│   │
│   ├── components/
│   │   ├── layout/         # AppShell, Header, Sidebar
│   │   ├── shared/         # ConfirmDialog, FeatureGate, RequirePermission
│   │   ├── forms/          # Form fields wrappers
│   │   ├── charts/         # Chart wrappers Recharts
│   │   ├── dashboard/      # Widgets dashboard
│   │   └── [domain]/       # Composants par domaine (lots, ventes…)
│   │
│   ├── store/
│   │   ├── store.ts        # Configuration Redux
│   │   ├── hooks.ts        # useAppDispatch, useAppSelector typés
│   │   ├── api/            # Slices RTK Query (1 par ressource backend)
│   │   │   ├── baseApi.ts  # baseQuery + tags + 401 handling
│   │   │   ├── authApi.ts
│   │   │   ├── farmsApi.ts
│   │   │   ├── batchesApi.ts
│   │   │   └── ...
│   │   └── slices/
│   │       ├── authSlice.ts    # currentUser + tokens
│   │       └── uiSlice.ts      # selectedFarmId, sidebar collapsed
│   │
│   ├── hooks/
│   │   ├── useCurrentUser.ts
│   │   ├── useSelectedFarm.ts
│   │   ├── useFeatureGate.ts   # Vérifie module activé sur farm courante
│   │   ├── useFarmCapabilities.ts
│   │   ├── useNetworkStatus.ts
│   │   └── useDebounce.ts
│   │
│   ├── theme/
│   │   ├── index.ts            # avicareTheme (depuis doc 10)
│   │   ├── tokens.ts           # Tokens design (colors, spacing, etc.)
│   │   └── fonts.ts            # Setup next/font Inter + Geist Mono
│   │
│   ├── lib/
│   │   ├── apiError.ts         # Parse RFC 7807 errors
│   │   ├── auth.ts             # clearAuthData, getTokens
│   │   ├── storage.ts          # localStorage wrappers
│   │   ├── format.ts           # formatCurrency, formatDate, formatNumber
│   │   └── validation/         # Schemas Zod réutilisables
│   │
│   ├── types/                  # Types TS partagés (Member, Client, etc.)
│   │
│   ├── constants/
│   │   ├── sidebar.ts          # Config navigation
│   │   ├── modules.ts          # Module keys (subscription)
│   │   └── routes.ts           # Routes constantes
│   │
│   └── middleware.ts           # Next.js middleware (auth, redirect)
│
├── next.config.ts
├── tsconfig.json
├── package.json
├── eslint.config.mjs
├── vitest.config.ts
└── playwright.config.ts
```

---

## 3. App Router & routing

### Route groups (Next.js parenthèses)

Trois groups principaux, chacun avec son layout :

| Group | Layout | Pages |
|---|---|---|
| `(auth)` | Split-screen (form + brand) | login, signup, mot-de-passe-oublié |
| `(dashboard)` | AppShell (header + sidebar + main) | tout le métier |
| `(onboarding)` | Wizard plein écran | premier user après signup |
| `(terrain)` | Kiosque tactile fullscreen | saisie terrain mobile/tablette |

### Pattern de protection des routes

```typescript
// src/middleware.ts (Next.js middleware)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('avicare_access_token')?.value;
  const isPublic = PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p));

  // Pas de token + route protégée → redirect login
  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Token + sur page auth → redirect dashboard
  if (token && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
```

### Nesting strategy

- Layout `(dashboard)/layout.tsx` charge l'AppShell **une fois**
- Pages enfants ne re-rendent pas le header/sidebar (RSC + caching Next.js)
- Server Components par défaut, Client Components uniquement où nécessaire (`'use client'`)

### URL conventions

- Listes : `/elevage/lots`
- Détail : `/elevage/lots/[id]`
- Création : `/elevage/lots/nouveau`
- Édition : `/elevage/lots/[id]/edition`
- URL en français (cohérent avec voix UX FR-first)

---

## 4. State management (RTK Query)

### Configuration baseApi

```typescript
// src/store/api/baseApi.ts
import { createApi, fetchBaseQuery, BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { clearAuthData } from '@/lib/auth';

const baseQuery = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL,
  credentials: 'include',  // cookies httpOnly pour refresh token
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    
    // Inject selectedFarmId comme query param implicite
    const selectedFarmId = (getState() as RootState).ui.selectedFarmId;
    if (selectedFarmId) headers.set('X-Farm-Id', String(selectedFarmId));
    
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);
  
  // 401 → tenter refresh, sinon logout
  if (result.error?.status === 401) {
    const refreshResult = await baseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);
    if (refreshResult.data) {
      // Refresh OK → retry original
      result = await baseQuery(args, api, extraOptions);
    } else {
      // Refresh fail → logout
      clearAuthData();
      window.location.href = '/login';
    }
  }
  
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Auth', 'Farm', 'User', 'Batch', 'Sale', 'Subscription', 'Catalog', /*…*/],
  endpoints: () => ({}),  // injecté par les slices
});
```

### Convention slices RTK Query

**1 slice = 1 ressource backend**. Exemple :

```typescript
// src/store/api/farmsApi.ts
import { baseApi } from './baseApi';
import type { Farm, FarmCreate } from '@/types';

export const farmsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMyFarms: build.query<Farm[], void>({
      query: () => '/me/farms',
      providesTags: ['Farm'],
    }),
    
    createFarm: build.mutation<Farm, FarmCreate>({
      query: (body) => ({ url: '/farms', method: 'POST', body }),
      invalidatesTags: ['Farm'],
    }),
    
    updateFarm: build.mutation<Farm, { id: number; body: Partial<Farm> }>({
      query: ({ id, body }) => ({ url: `/farms/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Farm'],
    }),
  }),
});

export const { useGetMyFarmsQuery, useCreateFarmMutation, useUpdateFarmMutation } = farmsApi;
```

### Patterns d'usage dans les composants

```typescript
// Liste
function FarmsListPage() {
  const { data: farms, isLoading, error } = useGetMyFarmsQuery();
  
  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorAlert error={error} />;
  
  return <FarmsList items={farms} />;
}

// Mutation
function CreateFarmDialog({ onClose }: Props) {
  const [createFarm, { isLoading }] = useCreateFarmMutation();
  
  const onSubmit = async (data: FarmCreate) => {
    try {
      await createFarm(data).unwrap();
      onClose();
    } catch (e) {
      // Erreur déjà gérée via toast global (voir section 8)
    }
  };
  // ...
}
```

### Tags d'invalidation

Toute mutation invalide les tags concernés → les queries qui les `provide` se rechargent automatiquement.

```typescript
// Création de lot invalide Batch + Stock + Dashboard stats
createBatch: build.mutation<Batch, BatchCreate>({
  query: (body) => ({ url: '/batches', method: 'POST', body }),
  invalidatesTags: ['Batch', 'Stock', 'Dashboard'],
}),
```

---

## 5. Authentification & sessions

### Flow login

```
1. User remplit form /login (identifier + password)
2. POST /api/v1/auth/login
3. Backend renvoie : { accessToken, refreshToken, user }
   - accessToken stocké en mémoire (Redux state)
   - refreshToken stocké en cookie httpOnly côté serveur (Set-Cookie)
4. Redirect /dashboard
```

### Stockage tokens

| Token | Stockage | Pourquoi |
|---|---|---|
| Access (15 min TTL) | Redux state (mémoire) | Pas exposé au JS via cookie, XSS-resistant |
| Refresh (7j TTL) | Cookie httpOnly SameSite=Lax | Inaccessible JS, CSRF-resistant |

**Jamais de tokens dans localStorage** (XSS = compromission immédiate).

### Refresh automatique

Géré dans `baseQueryWithReauth` (voir section 4) : si une requête renvoie 401, le système tente un refresh transparent. Si refresh fail, logout.

### Logout

```typescript
async function logout() {
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
  clearAuthData();
  store.dispatch(authSlice.actions.clearAuth());
  router.push('/login');
}
```

### Protection des composants par permission

```typescript
// src/components/shared/RequirePermission.tsx
import { useFarmCapabilities } from '@/hooks/useFarmCapabilities';

interface Props {
  permission: string;  // ex: 'commercial:write'
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({ permission, children, fallback = null }: Props) {
  const { hasPermission } = useFarmCapabilities();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}

// Usage
<RequirePermission permission="commercial:write">
  <Button onClick={openCreateSale}>Nouvelle vente</Button>
</RequirePermission>
```

### Feature gating (Sprint A4)

```typescript
// src/components/shared/FeatureGate.tsx
export function FeatureGate({ feature, children, fallback }: Props) {
  const { isEnabled } = useFeatureGate(feature);
  
  if (!isEnabled) {
    return fallback ?? <UpgradePrompt feature={feature} />;
  }
  return <>{children}</>;
}

// Usage
<FeatureGate feature="module.qr_codes">
  <QrCodeGenerator />
</FeatureGate>
```

---

## 6. Patterns UI (MUI v7)

### Theme provider

```typescript
// src/app/layout.tsx
import { ThemeProvider } from '@mui/material/styles';
import { avicareTheme } from '@/theme';
import { Providers } from '@/components/Providers';

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <Providers>
          <ThemeProvider theme={avicareTheme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
```

### Pattern composant standard

```typescript
'use client';

import { Card, CardContent, Typography, Stack, Button } from '@mui/material';
import { Plus } from 'lucide-react';

interface FarmCardProps {
  farm: Farm;
  onEdit: (id: number) => void;
}

export function FarmCard({ farm, onEdit }: FarmCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack>
            <Typography variant="h5">{farm.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {farm.location}
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            startIcon={<Plus size={18} />}
            onClick={() => onEdit(farm.id)}
          >
            Modifier
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
```

### `sx` prop vs styled components

- **`sx={{}}`** : pour overrides ponctuels (style local au composant)
- **`styled(Component)`** : pour composants réutilisables avec variants
- **Theme tokens** : toujours via `theme.palette`, `theme.spacing`, `theme.shape`

```typescript
// Bon
<Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>

// Mauvais — hardcoded colors
<Box sx={{ p: 3, bgcolor: '#FFFFFF', borderRadius: '8px' }}>
```

### Composants forms (React Hook Form + MUI)

```typescript
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextField, Button, Stack } from '@mui/material';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
});

type FormData = z.infer<typeof schema>;

export function LoginForm({ onSubmit }: Props) {
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <Stack component="form" onSubmit={handleSubmit(onSubmit)} spacing={3}>
      <Controller
        name="email"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            label="Email"
            error={!!errors.email}
            helperText={errors.email?.message}
            fullWidth
          />
        )}
      />
      <Controller
        name="password"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            type="password"
            label="Mot de passe"
            error={!!errors.password}
            helperText={errors.password?.message}
            fullWidth
          />
        )}
      />
      <Button type="submit" variant="contained" disabled={isSubmitting} fullWidth>
        Se connecter
      </Button>
    </Stack>
  );
}
```

---

## 7. i18n

### V1 : FR uniquement

Texts en dur en français dans les composants. **Mais structure prête** pour V2+ :

```typescript
// src/lib/i18n.ts (V1 : pass-through)
export const t = (key: string, fallback: string) => fallback;

// V2+ : remplacé par next-intl ou react-intl
```

Le pattern :

```typescript
<Typography>{t('login.title', 'Connexion à AviCare')}</Typography>
```

### V2+ : next-intl

Pour Sprint V2 multilangue (FR + WO + EN), migration vers `next-intl` :

```
public/locales/
├── fr/
│   ├── common.json
│   ├── auth.json
│   └── elevage.json
├── wo/
└── en/
```

### Formats locaux (dès V1)

```typescript
// src/lib/format.ts
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const formatCurrency = (amount: number, currency = 'XOF') =>
  new Intl.NumberFormat('fr-SN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);

export const formatDate = (date: Date | string) =>
  format(new Date(date), 'dd MMM yyyy', { locale: fr });

export const formatNumber = (n: number) =>
  new Intl.NumberFormat('fr-SN').format(n);
```

---

## 8. Erreurs & loading states

### Parsing RFC 7807

Le backend renvoie tous les erreurs en RFC 7807 (voir doc 06 §1) :

```typescript
// src/lib/apiError.ts
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  traceId?: string;
}

export function parseApiError(error: unknown): ApiError {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as any).data;
    if (data?.type && data?.title) return data as ApiError;
  }
  return { type: 'unknown', title: 'Erreur inconnue', status: 500 };
}
```

### Toast global pour erreurs API

```typescript
// src/components/Providers.tsx
import { SnackbarProvider } from 'notistack';

<SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
  {children}
</SnackbarProvider>
```

```typescript
// Usage dans une mutation
const [createSale] = useCreateSaleMutation();
const { enqueueSnackbar } = useSnackbar();

const onSubmit = async (data) => {
  try {
    await createSale(data).unwrap();
    enqueueSnackbar('Vente enregistrée', { variant: 'success' });
  } catch (e) {
    const apiError = parseApiError(e);
    enqueueSnackbar(apiError.title, { variant: 'error' });
  }
};
```

### Loading skeletons

Toujours préférer des skeletons MUI aux spinners pleins écran :

```typescript
import { Skeleton, Stack } from '@mui/material';

function FarmsListSkeleton() {
  return (
    <Stack spacing={2}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
      ))}
    </Stack>
  );
}
```

### Error boundaries

```typescript
// src/app/error.tsx (Next.js global error boundary)
'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html>
      <body>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4">Une erreur est survenue</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ my: 2 }}>
            {error.message}
          </Typography>
          <Button variant="contained" onClick={reset}>
            Réessayer
          </Button>
        </Box>
      </body>
    </html>
  );
}
```

---

## 9. Tests

### Unit tests (Vitest + Testing Library)

```typescript
// src/components/FarmCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FarmCard } from './FarmCard';

describe('FarmCard', () => {
  it('renders farm name and location', () => {
    const farm = { id: 1, name: 'Ferme A', location: 'Dakar' };
    render(<FarmCard farm={farm} onEdit={vi.fn()} />);
    
    expect(screen.getByText('Ferme A')).toBeInTheDocument();
    expect(screen.getByText('Dakar')).toBeInTheDocument();
  });

  it('calls onEdit when button clicked', async () => {
    const onEdit = vi.fn();
    const farm = { id: 1, name: 'Ferme A', location: 'Dakar' };
    render(<FarmCard farm={farm} onEdit={onEdit} />);
    
    await userEvent.click(screen.getByRole('button', { name: /modifier/i }));
    expect(onEdit).toHaveBeenCalledWith(1);
  });
});
```

### E2E tests (Playwright)

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can login and reach dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="identifier"]', 'admin@avicare.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByText('Bienvenue')).toBeVisible();
});
```

### Couverture cible

- Components critiques (forms, auth) : ≥80%
- Pages : ≥60%
- Utils (format, validation) : ≥90%

---

## 10. Performance & SEO

### Next.js best practices

- **Server Components par défaut** (`'use client'` uniquement si nécessaire : forms, hooks, state)
- **`next/image`** pour toutes les images (lazy loading, optimization auto)
- **`next/font`** pour Inter + Geist Mono (zero CLS, preload)
- **`next/dynamic`** pour les composants lourds (charts, dialogs) :
  ```typescript
  const Charts = dynamic(() => import('@/components/charts/RevenueChart'), {
    loading: () => <Skeleton height={300} />,
  });
  ```

### Caching RTK Query

- `keepUnusedDataFor: 60` (default 60s) — augmenter pour données stables (catalogue : 3600s)
- `refetchOnMountOrArgChange: 30` — refetch si data > 30s

### Bundle size

Objectif : **< 200 KB First Load JS** par route critique.

Surveillance via :
```bash
npm run build
# Next.js affiche la taille de chaque route
```

### SEO (V1 minimal)

App principalement protégée par auth → SEO peu critique en V1. Mais :
- `<title>` et `<meta description>` sur landing page et /login (acquisition)
- `lang="fr"` sur `<html>`
- `robots.txt` : block tout sauf landing (V1)

---

## 11. Conventions code

### Naming

| Type | Convention | Exemple |
|---|---|---|
| Composant | PascalCase | `FarmCard.tsx` |
| Hook custom | camelCase + `use` | `useCurrentUser.ts` |
| Page (App Router) | `page.tsx` | `app/dashboard/page.tsx` |
| Layout | `layout.tsx` | `app/(dashboard)/layout.tsx` |
| Slice RTK Query | `[resource]Api.ts` | `farmsApi.ts` |
| Type | PascalCase | `Farm`, `LoginRequest` |
| Constante | UPPER_SNAKE_CASE | `MAX_FARMS_PER_USER` |
| Util/lib | camelCase | `formatCurrency.ts` |

### Imports order (ESLint config)

```typescript
// 1. React + Next
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. External libs (MUI, etc.)
import { Card, Button } from '@mui/material';
import { Plus } from 'lucide-react';

// 3. Internal absolute imports (@/...)
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatDate } from '@/lib/format';

// 4. Relative imports (./...)
import { FarmCard } from './FarmCard';

// 5. Types
import type { Farm } from '@/types';
```

### TypeScript strict

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true
  }
}
```

### Server Components vs Client Components

**Server Component par défaut.** Add `'use client'` uniquement pour :
- Hooks (`useState`, `useEffect`, custom hooks)
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`window`, `localStorage`)
- MUI components (la plupart sont client)

```typescript
// Bad — 'use client' inutile
'use client';
export default function Page() {
  return <h1>Static content</h1>;
}

// Good — Server Component (default)
export default function Page() {
  return <h1>Static content</h1>;
}
```

### Folder co-location

Composant + tests + styles dans le même dossier :

```
components/FarmCard/
├── FarmCard.tsx
├── FarmCard.test.tsx
└── index.ts          # re-export propre
```

---

## 12. Documents associés

- `00-vision-strategique.md` — Stack frontend décidée (Next.js + MUI v7)
- `06-cross-cutting.md` — i18n, erreurs RFC 7807
- `10-design-system.md` — Tokens design, theme MUI avicareTheme
- `web/src/theme/index.ts` — Implémentation du theme
- `web/README.md` — Setup local

---

_Document créé pour Sprint A6 (bootstrap frontend). À enrichir au fur et à mesure des patterns rencontrés._
