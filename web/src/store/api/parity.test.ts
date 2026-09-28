import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "Ce qui part sur le web part aussi sur le mobile" is a standing rule of this project, and it was
 * being kept from memory. It slipped: the mobile forgotten-password screen collected an address and
 * called nothing at all, because the web had a reset flow and nobody checked the phone had one too.
 * A farmer who lost their password on mobile was stranded, believing an e-mail was on its way.
 *
 * So the rule is checked rather than remembered. Both apps are read for the API calls they actually
 * make — the URL, not the hook name, since the two apps name the same endpoint differently
 * (`getBreeds` against `listBreeds`) without that meaning anything.
 *
 * A surface that is deliberately web-only is listed in DESKTOP_ONLY, with the reason. Adding a line
 * there is a decision; forgetting one is now a failing test.
 *
 * The URL comparison alone has a blind spot, and it cost us: an endpoint *declared* in a slice
 * but called from no screen still publishes its URL, so both apps looked to be at parity while
 * eight capabilities — cancelling a delivery, cancelling an invoice, recording a supplier debt,
 * removing a ledger line, retiring a supplier, deleting an observation, deleting an egg
 * collection — existed on the phone only as dead code. Worse, three of those mutations shipped
 * with cache tags no query provides; nothing revealed it because nothing ever ran them.
 *
 * So the last test below compares *mounted* hooks: every hook a slice exports must be used by
 * something outside `store/api`. A hook nobody calls is either a screen still to build or a
 * binding to delete — both are decisions, and both belong in HOOKS_WITH_NO_SCREEN with a reason.
 */

// Whole source trees, not just the RTK Query slices: the mobile app posts its field writes
// through the offline sync queue (`endpoint: \`/api/v1/...\`` inside a screen), so reading only
// `store/api` would report mortality and weighings as missing from the phone.
const WEB_ROOTS = [join(process.cwd(), "src")];
const MOBILE_ROOTS = [join(process.cwd(), "../mobile/src"), join(process.cwd(), "../mobile/app")];

/**
 * Whole surfaces that exist on one side only, by design.
 */
const DESKTOP_ONLY: { prefix: string; why: string }[] = [
  {
    prefix: "/api/v1/admin/",
    why: "Console super-admin : back-office plateforme, poste de bureau (docs/…/super-admin).",
  },
  {
    prefix: "/api/v1/partner/",
    why: "Portail partenaire : provendier/vétérinaire au bureau. À trancher par ADR si un agent terrain doit l'avoir.",
  },
  {
    prefix: "/api/v1/subscription/",
    why: "Abonnement retiré du produit (ADR-009) ; le binding subsiste, dormant.",
  },
  {
    prefix: "/api/v1/account/settings",
    why: "Réglages de compte génériques : aucun écran mobile ne les expose encore.",
  },
];

/**
 * Hooks a slice exports that no screen calls, on either app, with why. Same register discipline
 * as KNOWN_DIVERGENCES: the assertion checks the real set *equals* this list, so mounting one
 * without deleting its line fails as loudly as leaving a new one unmounted.
 */
/**
 * Hooks a slice exports that no screen calls, with why.
 *
 * This started as a snapshot of what was already unmounted the day the check was written — it is
 * a baseline to work down, not a set of endorsed decisions. Several lines say "à trier": that is
 * honest, and better than inventing a justification.
 *
 * The discipline is the same as KNOWN_DIVERGENCES: the assertion checks the real set *equals*
 * this list, so mounting one without deleting its line fails as loudly as leaving a new one
 * unmounted. What the check buys is the ratchet — the list can only shrink by accident.
 */
const HOOKS_WITH_NO_SCREEN: { hook: string; side: "web" | "mobile"; why: string }[] = [
  /* ── Écarts web réels : plus aucun. Les trois derniers (régler le seuil d'alerte, archiver
     un article, lister les vaccinations d'un lot) ont été comblés. Trois autres candidats
     avaient été écartés après vérification — voir « redondances » juste en dessous. */

  /* ── Redondances : la capacité EST rendue, par un autre endpoint ──────────────────────── */
  {
    hook: "useGetLowStockItemsQuery",
    side: "web",
    why: "Pas un manque : `stocks/page.tsx` rend le stock bas via `alerts.lowStockItems`, et le tableau de bord via `lowStockCount`. Deux endpoints pour le même chiffre — en garder un.",
  },
  {
    hook: "useGetClientCreditQuery",
    side: "web",
    why: "Pas un manque : `ClientDetailView` affiche l'encours et son ratio à la limite, lus sur l'objet Client (`currentBalanceXof`). Endpoint redondant.",
  },
  {
    hook: "useGetFeedFormulaQuery",
    side: "web",
    why: "Pas un manque : le web édite une formule depuis l'objet déjà chargé par `getAvailableFormulas`. Lire une formule seule ne sert qu'au mobile.",
  },

  /* ── Sur aucun des deux : endpoints livrés sans surface ──────────────────────────────── */
  {
    hook: "useGetActiveWithdrawalsQuery",
    side: "web",
    why: "Les délais d'attente actifs arrivent par l'agrégat `getHealthAlerts`, qui alimente l'écran Sanitaire des deux côtés — et qui appelle EXACTEMENT la même méthode de service (`treatmentService.getActiveWithdrawals`). Un seul calcul, deux routes : rien à monter, rien à supprimer non plus.",
  },
  { hook: "useGetActiveWithdrawalsQuery", side: "mobile", why: "Idem côté mobile." },
  {
    hook: "useGetUpcomingFollowUpsQuery",
    side: "web",
    why: "Même chose : `getHealthAlerts` appelle `vetVisitService.listUpcomingFollowUps`, la méthode même de l'endpoint dédié.",
  },
  { hook: "useGetUpcomingFollowUpsQuery", side: "mobile", why: "Idem côté mobile." },
  {
    hook: "useGetOverdueInvoicesQuery",
    side: "web",
    why: "Les impayés sont dérivés côté client (`isInvoiceOverdue`), ce qui évite un aller-retour réseau pour un filtre d'onglet. Les deux définitions divergeaient d'un jour ; elles concordent depuis `commercial.overdue.test.ts`. L'endpoint reste, inutilisé mais cohérent.",
  },
  { hook: "useGetOverdueInvoicesQuery", side: "mobile", why: "Idem côté mobile." },
  {
    hook: "useGetClientsOverCreditLimitQuery",
    side: "web",
    why: "Pas un manque : la page Clients porte un onglet « Encours dépassé », dérivé côté client des champs que la liste transporte déjà (`creditLimitXof`, `currentBalanceXof`) — comme l'onglet « Débiteurs » à côté. Endpoint redondant.",
  },
  { hook: "useGetClientsOverCreditLimitQuery", side: "mobile", why: "Idem côté mobile." },
  {
    hook: "useGetProgramsByBreedQuery",
    side: "web",
    why: "Pas un manque : `VaccinationSection` filtre déjà par race côté client (`suggested`), AVEC un repli sur le catalogue complet quand aucun programme ne correspond — que l'endpoint serveur ne saurait pas faire. La version client est meilleure.",
  },
  { hook: "useGetProgramsByBreedQuery", side: "mobile", why: "Idem côté mobile." },
  {
    hook: "useGetMovementsByLotQuery",
    side: "web",
    why: "Pas un manque : la fiche article porte un onglet « Consommation par lot », filtré côté client sur `productionUnitId`. Endpoint redondant.",
  },
  { hook: "useGetMovementsByLotQuery", side: "mobile", why: "Idem côté mobile." },
  {
    hook: "useUpdateStockNotesMutation",
    side: "web",
    why: "LE SEUL VRAI RESTE : des notes libres sur une ligne de stock, qu'aucun écran n'affiche ni ne saisit, sur aucune des deux apps. Champ mort — à exposer ou à retirer du modèle, c'est une décision produit, pas un oubli d'écran.",
  },
  { hook: "useUpdateStockNotesMutation", side: "mobile", why: "Idem côté mobile." },
  {
    hook: "useGetSaleQuery",
    side: "web",
    why: "Pas un manque : la liste des ventes rend déjà les lignes de chaque vente (« 500× Maïs +2 ») — l'endpoint de liste renvoie les ventes complètes. Une page de détail montrerait la même donnée.",
  },
  { hook: "useGetSaleQuery", side: "mobile", why: "Idem côté mobile." },

  /* ── Web seulement ───────────────────────────────────────────────────────────────────── */
  {
    hook: "useGetAccountSettingsQuery",
    side: "web",
    why: "Réglages de compte génériques : jamais montés (cf. la même URL dans DESKTOP_ONLY).",
  },
  { hook: "useLazyGetAccountSettingsQuery", side: "web", why: "Variante lazy du précédent." },
  { hook: "useUpsertSettingMutation", side: "web", why: "Écriture du précédent." },
  {
    hook: "useGetIntegrityChecksQuery",
    side: "web",
    why: "Console super-admin : les contrôles d'intégrité nocturnes (ADR-012) n'ont pas encore d'écran. Cf. DESKTOP_ONLY /api/v1/admin/.",
  },
  {
    hook: "useGetPurgePreviewQuery",
    side: "web",
    why: "Console super-admin : aperçu de purge RGPD sans écran. Cf. DESKTOP_ONLY /api/v1/admin/.",
  },

  /* ── Mobile seulement ────────────────────────────────────────────────────────────────── */
  {
    hook: "useGetDeliveryQuery",
    side: "mobile",
    why: "Le web s'en sert pour le bon de livraison imprimable ; imprimer est un geste de bureau, et le mobile lit sa livraison depuis la liste, sur la fiche commande.",
  },
  {
    hook: "useRecordVaccinationMutation",
    side: "mobile",
    why: "Pas un manque : la saisie terrain passe par la file hors-ligne (`enqueueFieldMutation`), qui poste l'URL directement. Le hook RTK reste pour un futur appel en ligne.",
  },
  {
    hook: "useRecordObservationMutation",
    side: "mobile",
    why: "Même chose : l'observation part par la file hors-ligne.",
  },
];

/** Replaces `${...}` interpolations (brace-aware) with a single placeholder. */
function stripTemplates(source: string): string {
  let out = "";
  for (let i = 0; i < source.length; ) {
    if (source.startsWith("${", i)) {
      let depth = 1;
      let j = i + 2;
      while (j < source.length && depth > 0) {
        if (source[j] === "{") depth += 1;
        else if (source[j] === "}") depth -= 1;
        j += 1;
      }
      out += ":x";
      i = j;
    } else {
      out += source[i];
      i += 1;
    }
  }
  return out;
}

function normalise(url: string): string {
  return (
    stripTemplates(url)
      .split("?")[0]
      .replace(/\/\d+/g, "/:x")
      // A placeholder glued to the end of a segment is a query string the app builds itself
      // (`salaries${qs}`), not a path segment — the two apps assemble those differently.
      .replace(/([^/]):x$/, "$1")
      .replace(/\/+$/, "")
  );
}

/** Comments quote endpoints too; only call sites count. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "__tests__") continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) {
        out.push(full);
      }
    }
  };
  walk(root);
  return out;
}

/** Every `/api/v1/...` URL an app actually builds. */
function urlsOf(roots: string[]): Map<string, string[]> {
  const found = new Map<string, string[]>();

  for (const path of roots.flatMap(sourceFiles)) {
    const file = path.split("/").slice(-2).join("/");
    const source = stripComments(readFileSync(path, "utf8"));

    // `const base = (farmId) => `/api/v1/farms/${farmId}/...`` helpers, inlined before matching.
    const helpers = new Map<string, string>();
    for (const m of source.matchAll(/const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*`([^`]+)`/g)) {
      helpers.set(m[1], m[2]);
    }

    for (const m of source.matchAll(/`([^`\n]*)`|["'](\/api\/v1\/[^"'\n]*)["']/g)) {
      let raw = m[1] ?? m[2];
      if (raw == null) continue;
      for (const [name, value] of helpers) {
        raw = raw.replace(new RegExp(`\\$\\{${name}\\([^)]*\\)\\}`, "g"), value);
      }
      const at = raw.indexOf("/api/v1/");
      if (at === -1) continue;

      const url = normalise(raw.slice(at));
      // `/api/v1/x` alone is a helper fragment, not a call site.
      if (url.split("/").length < 5) continue;
      const seen = found.get(url) ?? [];
      found.set(url, seen.includes(file) ? seen : [...seen, file]);
    }
  }
  return found;
}

/**
 * The divergences that exist today, each with why it has not been closed. This is a register, not
 * a rug: the assertions below check the real divergence set *equals* this list, so closing one
 * without deleting its line fails just as loudly as opening a new one.
 */
const KNOWN_DIVERGENCES: { url: string; side: "web" | "mobile"; why: string }[] = [
  {
    url: "/api/v1/farms/:x/assistant",
    side: "web",
    why: "Fragment de base (`${base(farmId)}/chat`), pas un appel : /chat et /confirm existent des deux côtés.",
  },
  {
    url: "/api/v1/farms/:x/finance",
    side: "mobile",
    why: "Même chose côté mobile.",
  },
  {
    url: "/api/v1/farms/:x/subscription",
    side: "web",
    why: "Abonnement retiré du produit (ADR-009) ; binding dormant, à supprimer avec le reste.",
  },
  {
    url: "/api/v1/farms/:x/assistant/interpret",
    side: "mobile",
    why: "Dictée vocale : fonction du terrain, elle n'a pas de sens sur un poste de bureau.",
  },
];

/**
 * Every hook a slice exports, and whether anything outside `store/api` calls it.
 *
 * The export block is `export const { useX, useY } = fooApi;` on both apps — the one place a
 * hook becomes public. A hook named there and nowhere else is unreachable UI.
 *
 * A React hook is not the only way to reach an endpoint: outside a component — in a thunk, a
 * route guard — the caller dispatches `fooApi.endpoints.bar.initiate(...)` instead, which is
 * correct and names the *endpoint*, not the hook. Reading hook names alone reported `logout` as
 * unmounted while `authActions` was calling it exactly that way, so the endpoint name behind
 * each hook counts as a call site too.
 */
function unmountedHooks(apiDir: string, roots: string[]): string[] {
  const callers = roots
    .flatMap(sourceFiles)
    .filter((f) => !f.startsWith(apiDir))
    .map((f) => stripComments(readFileSync(f, "utf8")))
    .join("\n");

  const out = new Set<string>();
  for (const file of readdirSync(apiDir)) {
    if (!file.endsWith(".ts") || file.includes(".test.")) continue;
    const source = readFileSync(join(apiDir, file), "utf8");
    // `[^}]` already spans newlines, so no /s flag (the tsconfig target rejects it).
    const block = /export const \{([^}]*)\} = \w+;/.exec(source);
    if (!block) continue;
    for (const hook of block[1].match(/\buse\w+/g) ?? []) {
      // useGetFooQuery / useLazyGetFooQuery / useFooMutation → the `getFoo` / `foo` endpoint.
      const endpoint = hook
        .replace(/^use(Lazy)?/, "")
        .replace(/(Query|Mutation)$/, "");
      const name = endpoint.charAt(0).toLowerCase() + endpoint.slice(1);
      const called =
        new RegExp(`\\b${hook}\\b`).test(callers) ||
        new RegExp(`endpoints\\.${name}\\b`).test(callers);
      if (!called) out.add(hook);
    }
  }
  return [...out].sort();
}

const exempt = (url: string) => DESKTOP_ONLY.some((s) => url.startsWith(s.prefix));
const declared = (side: "web" | "mobile") =>
  KNOWN_DIVERGENCES.filter((d) => d.side === side)
    .map((d) => d.url)
    .sort();
const declaredHooks = (side: "web" | "mobile") =>
  HOOKS_WITH_NO_SCREEN.filter((h) => h.side === side)
    .map((h) => h.hook)
    .sort();

describe("web ↔ mobile API parity", () => {
  const web = urlsOf(WEB_ROOTS);
  const mobile = urlsOf(MOBILE_ROOTS);

  it("reads both apps (a silent empty read would pass vacuously)", () => {
    expect(web.size).toBeGreaterThan(100);
    expect(mobile.size).toBeGreaterThan(100);
  });

  it("opens no new gap on the phone, and closes none silently", () => {
    const actual = [...web.keys()].filter((url) => !mobile.has(url) && !exempt(url)).sort();

    expect(
      actual,
      "Called by the web app and by no mobile screen. Wire it on the phone, or add it to " +
        "KNOWN_DIVERGENCES with the reason. If you have just closed one, delete its line there.",
    ).toEqual(declared("web"));
  });

  it("opens no new gap on the web, and closes none silently", () => {
    const actual = [...mobile.keys()].filter((url) => !web.has(url) && !exempt(url)).sort();

    expect(
      actual,
      "Called by a mobile screen and by nothing on the web — usually a screen that never got its " +
        "twin, or an endpoint renamed on one side only.",
    ).toEqual(declared("mobile"));
  });

  // The URL tests above see a slice's declaration; these see whether a screen ever calls it.
  // Eight capabilities lived on the phone as dead code while the URL tests were green.
  it("leaves no web hook unmounted, and mounts none silently", () => {
    const actual = unmountedHooks(join(process.cwd(), "src/store/api"), WEB_ROOTS);

    expect(
      actual,
      "Exported by a web slice and called by no screen: unreachable UI. Mount it, delete the " +
        "binding, or add it to HOOKS_WITH_NO_SCREEN with the reason. If you have just mounted " +
        "one, delete its line there.",
    ).toEqual(declaredHooks("web"));
  });

  it("leaves no mobile hook unmounted, and mounts none silently", () => {
    const actual = unmountedHooks(join(process.cwd(), "../mobile/src/store/api"), MOBILE_ROOTS);

    expect(
      actual,
      "Exported by a mobile slice and called by no screen. This is how the phone ends up able " +
        "to record something it cannot correct — mount it, or register it in " +
        "HOOKS_WITH_NO_SCREEN with the reason.",
    ).toEqual(declaredHooks("mobile"));
  });
});
