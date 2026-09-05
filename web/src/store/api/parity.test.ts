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
  {
    url: "/api/v1/farms/:x/finance/summary",
    side: "web",
    why: "MANQUE SUR MOBILE : le compte de résultat de la ferme n'est pas rendu sur le téléphone, qui ne lit que /finance/analytics.",
  },
  {
    url: "/api/v1/farms/:x/inventory/alerts",
    side: "web",
    why: "MANQUE SUR MOBILE : le fil d'alertes agrégées est web-only ; le téléphone n'affiche que /stock-items/low-stock.",
  },
  {
    url: "/api/v1/farms/:x/health/vet-visits/:x",
    side: "mobile",
    why: "MANQUE SUR WEB : le mobile sait supprimer une visite vétérinaire, le web non.",
  },
  {
    url: "/api/v1/farms/:x/settings",
    side: "mobile",
    why: "MANQUE SUR WEB : le mobile édite les réglages de ferme (taille et prix du plateau) ; le web les lit via /egg-production/config/tray-settings sans pouvoir les modifier.",
  },
  {
    url: "/api/v1/farms/:x/settings/:x",
    side: "mobile",
    why: "Idem — l'écriture d'un réglage de ferme.",
  },
];

const exempt = (url: string) => DESKTOP_ONLY.some((s) => url.startsWith(s.prefix));
const declared = (side: "web" | "mobile") =>
  KNOWN_DIVERGENCES.filter((d) => d.side === side)
    .map((d) => d.url)
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
});
