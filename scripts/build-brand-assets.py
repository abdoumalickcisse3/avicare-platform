#!/usr/bin/env python3
"""Génère tous les dérivés du logo officiel Jawdi depuis les sources Illustrator.

Les .ai du designer (docs/brand/logo/source/) sont des PDF 1.6 en vectoriel pur :
zéro image embarquée, zéro police — les textes sont déjà vectorisés. On relit donc
la géométrie tracé par tracé, on la reclasse en trois zones (icône / wordmark /
baseline) et on réémet du SVG propre. On ne recopie PAS le dump SVG brut de
MuPDF : il traîne des clip-paths et des transformations qui n'apportent rien et
rendent le fichier inutilisable pour en extraire l'icône seule.

Chaque viewBox est recalée sur les pixels réellement opaques (rendu haute
résolution puis bbox du canal alpha), pour que les variantes s'alignent au pixel
près quelle que soit la découpe.

    scripts/build-brand-assets.py             # tout
    scripts/build-brand-assets.py --svg       # SVG seulement, pas de raster

PyMuPDF est un outil de build local (pip install pymupdf), pas une dépendance
applicative : rien de tout ça ne tourne au runtime.
"""

from __future__ import annotations

import base64
import struct
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/brand/logo/source"
KIT = ROOT / "docs/brand/logo"

# Couleurs exactes relevées dans les sources du designer. Elles font foi : aucun
# dérivé ne doit recolorer le logo en dehors des variantes mono/blanche.
DEEP = "#0C4434"  # vert profond — le « J » et le wordmark
GREEN = "#3B8B3D"  # vert moyen — collines, barres, baseline
EARTH = "#926234"  # brun terre — le champ labouré
SUN = "#F2A31A"  # orange — le soleil
WHITE = "#FFFFFF"
# Fond des icônes d'application : le « J » du logo est déjà vert profond, il
# disparaîtrait sur un fond vert. iOS refusant la transparence, c'est le blanc
# qui laisse l'icône complète lisible — exactement le rendu voulu par le
# designer dans son export favicon.
PLATE = "#FFFFFF"

# Découpage des zones. Les seuils sont en coordonnées relatives à l'ArtBox, et
# le nombre de tracés attendu par zone est vérifié : si le designer renvoie une
# version retouchée dont la mise en page bouge, le script casse ici plutôt que de
# produire silencieusement un logo amputé.
LOCKUPS = {
    "horizontal": {
        "file": "lockup-horizontal.ai",
        # L'icône est la colonne de gauche ; la baseline, la bande basse à droite.
        "zone": lambda r: "icon" if r["x1"] < 200 else ("baseline" if r["y0"] > 150 else "wordmark"),
    },
    "vertical": {
        "file": "lockup-vertical.ai",
        # Empilement : icône en haut, wordmark au milieu, baseline en bas. On
        # classe sur le bord HAUT : la courbe du « J » de l'icône plonge jusqu'à
        # y=311, soit plus bas que le sommet du wordmark (y=301).
        "zone": lambda r: "icon" if r["y0"] < 286 else ("baseline" if r["y0"] > 460 else "wordmark"),
    },
}
EXPECTED = {"icon": 14, "wordmark": 6, "baseline": 51}


# --------------------------------------------------------------------------- #
# Lecture des sources
# --------------------------------------------------------------------------- #


def hexcolor(rgb) -> str:
    return "#%02X%02X%02X" % tuple(int(round(c * 255)) for c in rgb)


def fmt(v: float) -> str:
    """Coordonnée compacte : 2 décimales suffisent sur un canevas de ~600 unités."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def path_data(items, dx: float, dy: float) -> str:
    """Convertit les primitives MuPDF en attribut `d`, en gérant les sous-tracés.

    Un nouveau sous-tracé démarre dès qu'une primitive ne repart pas du point
    courant — c'est ce qui dessine les découpes (la vache, la poule, les contre-
    formes des lettres), qui sont des trous et non des formes blanches.
    """
    out: list[str] = []
    cur = None

    def pt(p):
        return f"{fmt(p.x - dx)},{fmt(p.y - dy)}"

    for it in items:
        kind = it[0]
        if kind == "re":
            r = it[1]
            x0, y0, x1, y1 = r.x0 - dx, r.y0 - dy, r.x1 - dx, r.y1 - dy
            if out:
                out.append("Z")
            out.append(f"M{fmt(x0)},{fmt(y0)}H{fmt(x1)}V{fmt(y1)}H{fmt(x0)}Z")
            cur = None
            continue
        start = it[1]
        if cur is None or abs(start.x - cur.x) > 1e-6 or abs(start.y - cur.y) > 1e-6:
            if out:
                out.append("Z")
            out.append(f"M{pt(start)}")
        if kind == "l":
            out.append(f"L{pt(it[2])}")
            cur = it[2]
        elif kind == "c":
            out.append(f"C{pt(it[2])} {pt(it[3])} {pt(it[4])}")
            cur = it[4]
        elif kind == "qu":
            q = it[1]
            for p in (q.ul, q.ur, q.lr, q.ll):
                out.append(f"L{pt(p)}")
            cur = q.ll
    if out:
        out.append("Z")
    return "".join(out)


def sits_on_ink(paths: list[tuple[str, str]], x: float, y: float) -> bool:
    """Un point donné est-il couvert par l'une de ces formes ?

    Sert à trancher le sort des rehauts blancs : le designer a glissé un petit
    oiseau en réserve dans la hampe du « J ». Dans le lockup horizontal il se
    pose sur le vert profond et fait partie du dessin ; dans le vertical il
    flotte sur le vide, donc blanc sur blanc — invisible à l'usage prévu, mais
    il ressortirait en tache sur un fond sombre. On teste le pixel plutôt que de
    se fier aux boîtes englobantes, qui débordent sur les courbes de Bézier.
    """
    svg = svg_document(paths, (x - 0.5, y - 0.5, 1.0, 1.0), "test")
    doc = pymupdf.open(stream=svg.encode(), filetype="svg")
    pm = doc[0].get_pixmap(alpha=True, matrix=pymupdf.Matrix(8, 8))
    covered = max(pm.samples[pm.n - 1 :: pm.n]) > 0
    doc.close()
    return covered


def read_lockup(name: str) -> dict[str, list[tuple[str, str]]]:
    """Retourne {zone: [(couleur, d), ...]} dans l'ordre de peinture d'origine."""
    conf = LOCKUPS[name]
    doc = pymupdf.open(SOURCE / conf["file"])
    page = doc[0]
    art = page.artbox
    zones: dict[str, list[tuple[str, str]]] = {"icon": [], "wordmark": [], "baseline": []}
    highlights: list[tuple[str, str, float, float]] = []

    for dr in page.get_drawings():
        if dr["type"] != "f" or not dr.get("fill"):
            raise SystemExit(f"{conf['file']} : tracé non plein inattendu (type={dr['type']})")
        r = dr["rect"]
        color = hexcolor(dr["fill"])
        d = path_data(dr["items"], art.x0, art.y0)
        if color == WHITE:
            highlights.append((color, d, (r.x0 + r.x1) / 2 - art.x0, (r.y0 + r.y1) / 2 - art.y0))
            continue
        rel = {"x0": r.x0 - art.x0, "x1": r.x1 - art.x0, "y0": r.y0 - art.y0, "y1": r.y1 - art.y0}
        zones[conf["zone"](rel)].append((color, d))

    for zone, paths in zones.items():
        if len(paths) != EXPECTED[zone]:
            raise SystemExit(
                f"{conf['file']} : zone « {zone} » = {len(paths)} tracés, {EXPECTED[zone]} attendus. "
                "Les seuils de découpe ne collent plus à la source — revoir LOCKUPS."
            )

    kept = dropped = 0
    for color, d, cx, cy in highlights:
        host = next((z for z, paths in zones.items() if sits_on_ink(paths, cx, cy)), None)
        if host:
            zones[host].append((color, d))
            kept += 1
        else:
            dropped += 1
    print(f"  {conf['file']:24} rehauts blancs : {kept} conservés, {dropped} écartés (posés sur le vide)")
    doc.close()
    return zones


# --------------------------------------------------------------------------- #
# Émission SVG
# --------------------------------------------------------------------------- #


def svg_document(paths: list[tuple[str, str]], box: tuple[float, float, float, float], title: str) -> str:
    x, y, w, h = box
    body = "\n".join(
        f'  <path fill="{c}" d="{d}"/>' for c, d in paths if d
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(x)} {fmt(y)} {fmt(w)} {fmt(h)}" '
        f'role="img" aria-label="{title}">\n'
        f"  <title>{title}</title>\n{body}\n</svg>\n"
    )


def recolor(paths: list[tuple[str, str]], color: str) -> list[tuple[str, str]]:
    """Variante monochrome : les rehauts blancs disparaissent (ils ne servent que
    sur la version couleur), les découpes restent des trous — c'est le fond qui
    redessine la vache et la poule."""
    return [(color, d) for c, d in paths if c.upper() != WHITE]


def alpha_box(svg: str, scale: float = 4.0) -> tuple[float, float, float, float]:
    """Bbox des pixels opaques, en unités du viewBox d'origine."""
    doc = pymupdf.open(stream=svg.encode(), filetype="svg")
    page = doc[0]
    pm = page.get_pixmap(alpha=True, matrix=pymupdf.Matrix(scale, scale))
    w, h, n = pm.width, pm.height, pm.n
    alpha = pm.samples[n - 1 :: n]
    rows = [y for y in range(h) if max(alpha[y * w : (y + 1) * w]) > 0]
    cols = [x for x in range(w) if max(alpha[x::w]) > 0]
    doc.close()
    if not rows or not cols:
        raise SystemExit("rendu vide — le SVG ne contient aucun pixel opaque")
    vb = [float(v) for v in svg.split('viewBox="')[1].split('"')[0].split()]
    sx, sy = vb[2] / w, vb[3] / h
    return (
        vb[0] + cols[0] * sx,
        vb[1] + rows[0] * sy,
        (cols[-1] - cols[0] + 1) * sx,
        (rows[-1] - rows[0] + 1) * sy,
    )


def emit(paths: list[tuple[str, str]], title: str, dest: Path) -> str:
    """Écrit un SVG recalé au plus juste sur son contenu."""
    rough = svg_document(paths, (0, 0, 2000, 2000), title)
    svg = svg_document(paths, alpha_box(rough), title)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(svg)
    return svg


# --------------------------------------------------------------------------- #
# Raster
# --------------------------------------------------------------------------- #


def rgb(hex_color: str) -> tuple[int, int, int]:
    return tuple(int(hex_color[i : i + 2], 16) for i in (1, 3, 5))


def solid(color: str, size: int) -> pymupdf.Pixmap:
    """Aplat opaque — le fond de l'icône adaptative Android."""
    pm = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, size, size), False)
    pm.set_rect(pm.irect, rgb(color))
    return pm


def viewbox(svg: str) -> tuple[float, float, float, float]:
    return tuple(float(v) for v in svg.split('viewBox="')[1].split('"')[0].split())


def parse_paths(svg: str) -> list[tuple[str, str]]:
    """Relit les (couleur, d) d'un document produit par emit()."""
    out = []
    for line in svg.splitlines():
        if line.strip().startswith("<path "):
            out.append((line.split('fill="')[1].split('"')[0], line.split('d="')[1].split('"')[0]))
    return out


def inner_paths(svg: str) -> str:
    """Les <path> d'un document généré ici, sans son en-tête."""
    return svg.split("</title>", 1)[1].rsplit("</svg>", 1)[0]


def compose(
    svg: str,
    width: int,
    background: str | None,
    inset: float,
    height: int | None = None,
    alpha: bool | None = None,
) -> pymupdf.Pixmap:
    """Pose le SVG centré sur un fond, avec une marge relative (0.2 = 20 %).

    La composition se fait en SVG puis un seul rendu : assembler deux pixmaps
    ne marcherait pas, `Pixmap.copy` recopiant les octets sans fondu alpha — les
    zones transparentes repeindraient le fond en noir.
    """
    height = height or width
    x0, y0, vw, vh = viewbox(svg)
    scale = min(width * (1 - 2 * inset) / vw, height * (1 - 2 * inset) / vh)
    dx = (width - vw * scale) / 2 - x0 * scale
    dy = (height - vh * scale) / 2 - y0 * scale
    plate = f'<rect width="{width}" height="{height}" fill="{background}"/>' if background else ""
    wrapper = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">{plate}'
        f'<g transform="translate({fmt(dx)},{fmt(dy)}) scale({scale:.6f})">{inner_paths(svg)}</g></svg>'
    )
    doc = pymupdf.open(stream=wrapper.encode(), filetype="svg")
    keep = (background is None) if alpha is None else alpha
    pm = doc[0].get_pixmap(alpha=keep, matrix=pymupdf.Matrix(1, 1))
    doc.close()
    return pm


def write_png(pm: pymupdf.Pixmap, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    pm.save(dest)


def write_ico(svg: str, dest: Path, sizes=(16, 32, 48)) -> None:
    """ICO = un conteneur de PNG. Pas de dépendance, le format tient en 20 lignes.

    Les PNG embarqués doivent être RGBA : le décodeur d'icônes de Next refuse
    (« The PNG is not in RGBA format! ») un PNG RGB, même parfaitement opaque.
    """
    blobs = [compose(svg, s, PLATE, 0.08, alpha=True).tobytes("png") for s in sizes]
    header = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    entries, payload = b"", b""
    for size, blob in zip(sizes, blobs):
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
        payload += blob
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(header + entries + payload)


# --------------------------------------------------------------------------- #
# Construction
# --------------------------------------------------------------------------- #


def build() -> dict[str, str]:
    """Produit le kit de marque et retourne {nom: contenu SVG}."""
    kit: dict[str, str] = {}
    horizontal = read_lockup("horizontal")
    vertical = read_lockup("vertical")

    layouts = {
        "horizontal": horizontal,
        "vertical": vertical,
    }
    for name, zones in layouts.items():
        full = zones["icon"] + zones["wordmark"] + zones["baseline"]
        compact = zones["icon"] + zones["wordmark"]
        label = f"Jawdi — plateforme de gestion d'élevage"
        kit[f"logo-{name}"] = emit(full, label, KIT / f"logo-{name}.svg")
        kit[f"logo-{name}-compact"] = emit(compact, "Jawdi", KIT / f"logo-{name}-compact.svg")
        kit[f"logo-{name}-white"] = emit(recolor(full, WHITE), label, KIT / f"logo-{name}-white.svg")
        kit[f"logo-{name}-compact-white"] = emit(
            recolor(compact, WHITE), "Jawdi", KIT / f"logo-{name}-compact-white.svg"
        )

    icon = horizontal["icon"]
    kit["icon"] = emit(icon, "Jawdi", KIT / "icon.svg")
    kit["icon-white"] = emit(recolor(icon, WHITE), "Jawdi", KIT / "icon-white.svg")

    wordmark = horizontal["wordmark"]
    kit["wordmark"] = emit(wordmark, "Jawdi", KIT / "wordmark.svg")
    kit["wordmark-white"] = emit(recolor(wordmark, WHITE), "Jawdi", KIT / "wordmark-white.svg")

    return kit


def main() -> None:
    svg_only = "--svg" in sys.argv
    kit = build()
    print(f"kit SVG   → {KIT.relative_to(ROOT)} ({len(kit)} fichiers)")
    if svg_only:
        return


    # Le lockup complet porte la baseline, illisible sous ~80 px de haut : les
    # interfaces reçoivent donc aussi la variante compacte, qui est celle
    # réellement montée dans les en-têtes et les barres latérales.
    targets = {
        # web (Next.js)
        "web/public/logo/logo.svg": kit["logo-horizontal"],
        "web/public/logo/logo-compact.svg": kit["logo-horizontal-compact"],
        "web/public/logo/logo-compact-white.svg": kit["logo-horizontal-compact-white"],
        "web/public/logo/logo-vertical.svg": kit["logo-vertical"],
        "web/public/logo/icon.svg": kit["icon"],
        # landing (Astro)
        "landing/src/assets/logo.svg": kit["logo-horizontal"],
        "landing/src/assets/logo-compact.svg": kit["logo-horizontal-compact"],
        "landing/src/assets/logo-compact-white.svg": kit["logo-horizontal-compact-white"],
        "landing/public/favicon.svg": kit["icon"],
    }
    # Mobile : react-native-svg est déjà au projet, mais pas le transformer
    # Metro qui permettrait d'importer un .svg. On émet donc les tracés en TS,
    # que <JawdiLogo /> rend en vectoriel — net à toute densité, sans nouvelle
    # dépendance ni configuration de bundler.
    vb = viewbox(kit["logo-horizontal-compact"])
    rows = "\n".join(
        f"  {{ fill: '{c}', d: '{d}' }}," for c, d in parse_paths(kit["logo-horizontal-compact"])
    )
    (ROOT / "mobile/src/brand/logoPaths.ts").parent.mkdir(parents=True, exist_ok=True)
    (ROOT / "mobile/src/brand/logoPaths.ts").write_text(
        "/**\n"
        " * GÉNÉRÉ par scripts/build-brand-assets.py — ne pas éditer à la main.\n"
        " * Source : docs/brand/logo/source/lockup-horizontal.ai (lockup compact,\n"
        " * sans la baseline, illisible aux tailles où l'app affiche le logo).\n"
        " */\n\n"
        f"export const logoViewBox = '{fmt(vb[0])} {fmt(vb[1])} {fmt(vb[2])} {fmt(vb[3])}';\n"
        f"export const logoAspectRatio = {vb[2] / vb[3]:.4f};\n\n"
        "export const logoPaths: readonly { fill: string; d: string }[] = [\n"
        f"{rows}\n];\n"
    )
    print("mobile    → src/brand/logoPaths.ts (lockup compact vectoriel)")

    # Marque pour les documents imprimés (facture, bon de livraison). Trois
    # moteurs de rendu différents — react-pdf, expo-print, impression navigateur
    # — et aucun socle de code partagé entre web et mobile : on émet donc la même
    # image encodée en data URI dans chaque app, générée ici pour qu'elles ne
    # puissent pas diverger. Un PNG plutôt qu'un SVG : react-pdf et les moteurs
    # d'impression des téléphones ne traitent pas l'inline SVG de la même façon.
    mark_png = base64.b64encode(compose(kit["icon"], 128, None, 0.0).tobytes("png")).decode()
    icon_vb = viewbox(kit["icon"])
    icon_rows = "\n".join(f"  {{ fill: '{c}', d: '{d}' }}," for c, d in parse_paths(kit["icon"]))
    doc = (
        "/**\n"
        " * GÉNÉRÉ par scripts/build-brand-assets.py — ne pas éditer à la main.\n"
        " *\n"
        " * L'icône Jawdi pour les documents que l'éleveur imprime et remet à SON\n"
        " * client. Elle va en pied de page, jamais en en-tête : la facture\n"
        " * appartient à la ferme, pas à Jawdi.\n"
        " */\n\n"
    )
    png_export = f"export const BRAND_MARK_PNG = 'data:image/png;base64,{mark_png}';\n"
    (ROOT / "mobile/src/brand/brandMark.ts").parent.mkdir(parents=True, exist_ok=True)
    (ROOT / "mobile/src/brand/brandMark.ts").write_text(
        doc.replace("*/\n\n", "*\n * Le PNG sert au HTML d'expo-print, qui rend mal l'inline SVG sur iOS.\n */\n\n")
        + png_export
    )
    # Le web a deux moteurs : le DOM imprimé prend le PNG, react-pdf prend les
    # tracés. Pas un luxe — react-pdf fait passer un data URI décodé à pdfkit
    # comme un chemin de fichier et plante ; et le vectoriel est de toute façon
    # meilleur à l'impression qu'un PNG de 128 px.
    (ROOT / "web/src/theme/brandMark.ts").write_text(
        doc
        + png_export
        + f"\nexport const BRAND_MARK_VIEWBOX = '{fmt(icon_vb[0])} {fmt(icon_vb[1])} {fmt(icon_vb[2])} {fmt(icon_vb[3])}';\n"
        + f"export const BRAND_MARK_RATIO = {icon_vb[2] / icon_vb[3]:.4f};\n\n"
        + "export const BRAND_MARK_PATHS: readonly { fill: string; d: string }[] = [\n"
        + f"{icon_rows}\n];\n"
    )
    print(f"marque    → brandMark.ts (web + mobile, {len(mark_png) // 1024} Ko en data URI)")

    for rel, svg in targets.items():
        dest = ROOT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(svg)
    print(f"SVG app   → {len(targets)} fichiers (web, landing, mobile)")

    rasters = {
        # Next.js sert automatiquement icon/apple-icon posés dans app/.
        "web/src/app/icon.png": lambda: compose(kit["icon"], 64, PLATE, 0.10),
        "web/src/app/apple-icon.png": lambda: compose(kit["icon"], 180, PLATE, 0.14),
        # Icônes PWA du manifeste. La variante « maskable » garde une marge plus
        # large : Android peut rogner jusqu'aux 20 % extérieurs.
        "web/public/icons/192.png": lambda: compose(kit["icon"], 192, PLATE, 0.16),
        "web/public/icons/512.png": lambda: compose(kit["icon"], 512, PLATE, 0.16),
        "web/public/icons/maskable-512.png": lambda: compose(kit["icon"], 512, PLATE, 0.26),
        "landing/public/apple-touch-icon.png": lambda: compose(kit["icon"], 180, PLATE, 0.14),
        # Logo d'organisation du JSON-LD : les moteurs attendent un raster.
        "landing/src/assets/logo-mark.png": lambda: compose(kit["icon"], 512, PLATE, 0.10),
        # Expo / stores.
        "mobile/assets/icon.png": lambda: compose(kit["icon"], 1024, PLATE, 0.16),
        "mobile/assets/splash-icon.png": lambda: compose(kit["icon"], 1024, None, 0.22),
        "mobile/assets/favicon.png": lambda: compose(kit["icon"], 48, PLATE, 0.10),
        # Icône adaptative Android : avant-plan dans la zone sûre (66 % centraux),
        # fond en aplat, monochrome en silhouette pour les thèmes dynamiques.
        "mobile/assets/android-icon-foreground.png": lambda: compose(kit["icon"], 512, None, 0.30),
        "mobile/assets/android-icon-background.png": lambda: solid(PLATE, 512),
        "mobile/assets/android-icon-monochrome.png": lambda: compose(kit["icon-white"], 512, None, 0.30),
        # Carte de partage social, au format attendu par OpenGraph.
        "docs/brand/logo/og-card.png": lambda: compose(
            kit["logo-horizontal-white"], 1200, DEEP, 0.22, height=630
        ),
    }
    for rel, factory in rasters.items():
        write_png(factory(), ROOT / rel)

    write_ico(kit["icon"], ROOT / "landing/public/favicon.ico")
    write_ico(kit["icon"], ROOT / "web/src/app/favicon.ico")
    print(f"PNG/ICO   → {len(rasters) + 2} fichiers")


if __name__ == "__main__":
    main()
