import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Une garde d'écran ne doit jamais tester une permission que le backend ne regarde pas.
 *
 * Le 2026-10-11, cinq gardes mobiles demandaient `inventory:write`, `commercial:write` ou
 * `finance:write`. Ces trois permissions sont *attribuables* — le catalogue les propose — mais
 * **aucun endpoint ne les consulte** : les écritures correspondantes sont gardées par un RÔLE
 * (`hasRole(OWNER, MANAGER)`). Les deux questions ne coïncident que par chance, et elles
 * divergeaient dans les deux sens : un ouvrier à qui on accordait `inventory:write` voyait des
 * boutons que le serveur refusait, un gérant aux droits restreints perdait des boutons auxquels
 * il avait droit. Le plus visible : l'ouvrier ne pouvait pas enregistrer un mouvement de stock.
 *
 * `parity.test.ts`, à côté, compare les URL appelées et les hooks montés. Il était vert pendant
 * toute cette dérive, et il le serait encore : une garde n'est ni une URL ni un hook.
 *
 * Ce test lit donc le backend comme source de vérité — les littéraux réellement passés à
 * `hasPermission` et à `adminAccess.can` — et refuse toute garde front qui sorte de ces deux
 * vocabulaires. Il ne prétend pas vérifier qu'une garde est posée au bon endroit ; il vérifie
 * qu'elle pose une question à laquelle le serveur répond.
 */

const BACKEND = join(process.cwd(), "../backend");
const FRONT_ROOTS = [
  { side: "web", root: join(process.cwd(), "src") },
  { side: "mobile", root: join(process.cwd(), "../mobile/src") },
  { side: "mobile", root: join(process.cwd(), "../mobile/app") },
];

/**
 * Gardes qui testent légitimement autre chose que le vocabulaire serveur, avec la raison.
 * Même discipline que KNOWN_DIVERGENCES : l'assertion compare à l'ensemble EXACT, donc retirer
 * une garde sans retirer sa ligne échoue aussi bruyamment que d'en ajouter une non justifiée.
 */
const ALLOWED_EXCEPTIONS: { permission: string; why: string }[] = [];

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (["node_modules", ".git", "worktrees", "target", ".next"].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out = out.concat(sourceFiles(full));
    } else if ([".ts", ".tsx", ".java"].includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

/** Les fichiers de test mentent sur les permissions par construction : ils en inventent. */
const isTest = (f: string) =>
  /\.test\.tsx?$/.test(f) || f.includes("__tests__") || f.includes("/test/");

/**
 * Même raison que dans `parity.test.ts` : un commentaire qui *explique* une garde fautive la
 * ferait détecter comme fautive. Ce test a commencé par se signaler sa propre documentation.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(files: string[], pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const file of files) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const match of source.matchAll(pattern)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return found;
}

const backendFiles = sourceFiles(BACKEND).filter((f) => !isTest(f) && !f.includes("/target/"));

/** Ce que le serveur regarde vraiment, par ferme. */
const FARM_CHECKED = collect(backendFiles, /hasPermission\([^,]+,\s*'([a-z:]+)'\)/g);

/** Et pour la console : un autre checker, donc un autre vocabulaire. */
const STAFF_CHECKED = collect(backendFiles, /adminAccess\.can\('([a-z:]+)'\)/g);

describe("les gardes front posent une question à laquelle le serveur répond", () => {
  it("le backend consulte bien un vocabulaire par ferme et un vocabulaire staff", () => {
    // Garde-fou du garde-fou : si l'extraction casse, tout le reste passerait en silence.
    expect(FARM_CHECKED.size).toBeGreaterThan(5);
    expect(STAFF_CHECKED.size).toBeGreaterThan(5);
    expect(FARM_CHECKED).toContain("poultry:write");
    expect(STAFF_CHECKED).toContain("staff:manage");
  });

  for (const { side, root } of FRONT_ROOTS) {
    it(`${side} (${root.split("/").slice(-2).join("/")}) ne garde que sur des permissions consultées`, () => {
      const files = sourceFiles(root).filter((f) => !isTest(f));
      const gated = collect(files, /\bcan\(\s*['"]([a-z]+:[a-z]+)['"]\s*\)/g);

      const allowed = new Set([
        ...FARM_CHECKED,
        ...STAFF_CHECKED,
        ...ALLOWED_EXCEPTIONS.map((e) => e.permission),
      ]);
      const unchecked = [...gated].filter((p) => !allowed.has(p)).sort();

      expect(
        unchecked,
        `Ces permissions ne sont consultées par AUCUN endpoint : ${unchecked.join(", ")}.\n` +
          `L'écriture correspondante est probablement gardée par un RÔLE côté serveur ` +
          `(hasRole(OWNER, MANAGER)). Ouvre la constante *Access.java de l'endpoint visé :\n` +
          `  — si elle dit hasRole → utilise canManageFarm / canOperateFarm (mobile) ou ` +
          `canManageCatalog (web), jamais can('…').\n` +
          `  — si elle dit hasPermission → la garde est bonne, mais ce test ne voit pas ` +
          `l'endpoint : ajoute une ligne à ALLOWED_EXCEPTIONS avec la raison.`,
      ).toEqual([]);
    });
  }

  it("aucune exception n'est devenue inutile", () => {
    const stale = ALLOWED_EXCEPTIONS.filter(
      (e) => FARM_CHECKED.has(e.permission) || STAFF_CHECKED.has(e.permission),
    ).map((e) => e.permission);

    expect(
      stale,
      `Le backend consulte maintenant ${stale.join(", ")} : retire ces lignes d'ALLOWED_EXCEPTIONS.`,
    ).toEqual([]);
  });
});
