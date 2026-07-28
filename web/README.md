# Jawdi — Web (Next.js)

Frontend de la plateforme Jawdi. Next.js 16 (App Router) + MUI v7 + Redux
Toolkit / RTK Query. Voir `docs/07-frontend-nextjs.md` (architecture) et
`docs/10-design-system.md` (design tokens / thème).

## Démarrage

```bash
npm install
npm run dev   # http://localhost:3000
```

> Le port est fixé à **3000** : le backend n'autorise le CORS que depuis
> `http://localhost:3000` (cf. `common-security` `SecurityConfig`).

Configurer l'URL du backend dans `web/.env.local` (non versionné) :

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de dev (port 3000, aligné CORS backend) |
| `npm run build` | build de production (typecheck inclus) |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm test` | tests Vitest (forms auth) |

## Architecture

- `src/app` — routes App Router. Groupes : `(auth)` (login/signup, layout
  split-screen) et `(dashboard)` (AppShell + garde d'auth client).
- `src/theme` — `avicareTheme` (MUI), tokens design (doc 10), fonts, `ThemeRegistry`.
- `src/store` — store Redux, slices (`auth`, `ui`), `baseApi` RTK Query + `authApi`.
- `src/lib` — helpers (storage tokens, parsing erreurs RFC 7807, format XOF/dates).
- `src/components/layout` — `Header`, `Sidebar`, `AppShell`.

## Dette technique connue (V1)

- **Stockage des tokens en `localStorage`** (`src/lib/storage.ts`). Le doc 07 §5
  vise un access token en mémoire + refresh en cookie `httpOnly`. Tant que le
  backend renvoie les tokens dans le corps de la réponse (cookie `httpOnly`
  différé côté backend, cf. A3-2), on reste sur `localStorage`. La garde d'auth
  est donc **côté client** (`(dashboard)/layout.tsx`), pas en edge/proxy.
- **Pages reportées** : fermes / équipe / abonnement / paramètres (sessions
  A6-2 et A6-3). La sidebar les liste en désactivé.
