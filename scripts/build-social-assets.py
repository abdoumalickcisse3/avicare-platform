#!/usr/bin/env python3
"""Génère les photos de profil et les bannières des réseaux sociaux Jawdi.

Rien n'est dessiné à la main : tout part du kit officiel (docs/brand/logo/),
lui-même regénéré depuis les sources Illustrator par build-brand-assets.py. Si
la marque bouge, on relance les deux scripts dans l'ordre et tous les comptes
sont à jour.

    scripts/build-brand-assets.py     # d'abord le kit
    scripts/build-social-assets.py    # puis les déclinaisons sociales
    scripts/build-social-assets.py --guides   # + les calques de zone sûre

Deux moteurs de rendu, parce que les deux familles n'ont pas les mêmes besoins :

- Les **avatars** et le **filigrane** sont du logo posé sur un fond — un aplat
  pour les uns, rien ou une plaque translucide pour l'autre. PyMuPDF suffit et
  donne un tracé net à toutes les tailles, sans dépendre d'un navigateur.
- Les **bannières** portent du texte dans la vraie typo de la marque (Outfit,
  auto-hébergée par la landing). On passe par Chrome sans interface : c'est le
  seul moteur ici qui sache composer une woff2 correctement. Chrome écrit une
  image valide tout en crachant des erreurs sans rapport sur stderr — on ne
  juge donc pas du succès au code de sortie mais au fichier produit.

Toute la difficulté du format social est le **recadrage** : chaque réseau
rogne la bannière différemment selon l'écran, et pose la photo de profil
par-dessus. Les gabarits ci-dessous déclarent donc, pour chaque réseau, la zone
réellement visible partout (`safe`) et le coin mangé par l'avatar (`avatar`).
`--guides` rend ces zones en surimpression pour pouvoir les vérifier à l'œil.
"""

from __future__ import annotations

import base64
import importlib.util
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "docs/brand/logo"
OUT = ROOT / "docs/brand/social"
FONTS = ROOT / "landing/src/fonts"

CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")


def load_brand_module():
    """build-brand-assets.py porte un tiret : pas importable par son nom."""
    # Sans cela, l'import laisse un __pycache__ dans scripts/, que rien
    # n'ignore à la racine du dépôt.
    sys.dont_write_bytecode = True
    path = ROOT / "scripts/build-brand-assets.py"
    spec = importlib.util.spec_from_file_location("brand_assets", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


brand = load_brand_module()

# Couleurs de la source Illustrator (via le script du kit) et du hero de la
# landing. Aucune n'est inventée ici.
DEEP = brand.DEEP  # #0C4434 — vert profond
GREEN = brand.GREEN  # #3B8B3D — vert moyen
SUN = brand.SUN  # #F2A31A — orange
EARTH = "#083025"  # --earth, le fond le plus sombre du hero
MIST = "#EAF3E4"  # la couleur du texte sur le vert du hero


# --------------------------------------------------------------------------- #
# Photos de profil
# --------------------------------------------------------------------------- #

# Presque tous les réseaux rognent l'avatar en CERCLE. Le cercle inscrit dans
# un carré laisse tomber les quatre coins : une marge calculée pour un carré
# amputerait le logo. 0.19 garde le dessin dans le cercle utile, avec un peu
# d'air pour l'anneau de survol que certaines interfaces ajoutent.
ROUND = 0.19
# LinkedIn est l'exception : le logo d'une page y reste un carré à coins
# arrondis. On peut donc remplir davantage.
SQUARE = 0.14

# Taille d'export par réseau. On exporte systématiquement au-dessus de la
# taille d'affichage : les réseaux ré-encodent, et une source généreuse encaisse
# mieux leur compression qu'un fichier juste à la bonne dimension.
AVATARS = {
    "linkedin-page": (400, SQUARE),  # affiché 300×300, carré arrondi
    "linkedin-profil": (800, ROUND),  # affiché 400×400, rond
    "facebook": (1080, ROUND),  # affiché 170×170, rond
    "instagram": (1080, ROUND),  # affiché 320×320, rond
    "x": (400, ROUND),  # affiché 400×400, rond
    "youtube": (800, ROUND),  # affiché 98×98, rond
    "tiktok": (1080, ROUND),  # affiché 200×200, rond
    "whatsapp-business": (640, ROUND),  # affiché 192×192, rond
}


def build_avatars(verbose: bool = True) -> int:
    """Deux jeux : plaque verte (par défaut) et plaque blanche (de secours).

    Le vert est le choix par défaut parce qu'un avatar blanc se dissout dans le
    fil blanc de la plupart des réseaux : il n'a plus de silhouette. Le blanc
    reste fourni pour les contextes où un fond sombre est imposé.
    """
    count = 0
    for network, (size, inset) in AVATARS.items():
        jobs = [
            # Plaque verte, marque en blanc : l'inversion exacte de l'icône
            # claire, déjà produite par le kit sous le nom icon-dark.
            (OUT / f"avatars/{network}.png", "icon-dark", DEEP),
            (OUT / f"avatars/blanc/{network}.png", "icon", "#FFFFFF"),
        ]
        for dest, svg_name, plate in jobs:
            svg = (KIT / f"{svg_name}.svg").read_text()
            brand.write_png(brand.compose(svg, size, plate, inset), dest)
            count += 1
        if verbose:
            print(f"  avatar  {network:<20} {size}×{size}")
    return count


# --------------------------------------------------------------------------- #
# Filigrane de chaîne
# --------------------------------------------------------------------------- #

# Ce que YouTube demande : 150×150 conseillé, PNG / GIF non animé / BMP / JPEG,
# 1 Mo maximum. Il se pose en bas à droite du lecteur et sert de bouton
# d'abonnement. Ce n'est donc pas un visuel de publication comme une miniature :
# c'est de l'identité, au même titre que l'avatar, et sa place est dans ce kit.
WATERMARK = 150

# Toute la difficulté est là : contrairement à l'avatar et à la bannière, le
# filigrane n'a aucun fond à nous. Il se pose sur l'image, et l'image est un
# poulailler en plein soleil aussi bien qu'un plan sombre. Une marque blanche
# nue disparaît dès que le plan est clair — et les nôtres le seront. On lui
# donne donc une plaque verte, qui lui rend la silhouette qui lui manque.
#
# Elle n'est pas pleinement opaque : la vidéo transparaît assez pour que la
# marque se pose SUR le plan plutôt que d'y être collée. Mais sous ~70 % le
# vert se délave en sauge grisé dès que la litière est claire — la marque reste
# lisible et cesse d'être la nôtre. 72 % est le point où les deux tiennent.
PLATE_ALPHA = 0.72
PLATE_RADIUS = 0.235  # même galbe que l'icône d'application
PLATE_INSET = 0.17
# Sans plaque, on remplit le carré : YouTube met l'image à l'échelle, et chaque
# pixel de marge transparente est de la marque en moins à l'écran.
BARE_INSET = 0.05


def watermark(size: int, plate: bool) -> pymupdf.Pixmap:
    """L'icône blanche en PNG transparent, avec ou sans plaque.

    `brand.compose` ne sait poser qu'un aplat opaque et pleine page ; il faut
    ici un arrondi et une opacité partielle. On compose donc le SVG à la main
    avant un rendu unique : assembler deux pixmaps repeindrait les zones
    transparentes en noir, `Pixmap.copy` recopiant les octets sans fondu alpha.
    """
    svg = (KIT / "icon-white.svg").read_text()
    x0, y0, vw, vh = brand.viewbox(svg)
    inset = PLATE_INSET if plate else BARE_INSET
    scale = min(size * (1 - 2 * inset) / vw, size * (1 - 2 * inset) / vh)
    dx = (size - vw * scale) / 2 - x0 * scale
    dy = (size - vh * scale) / 2 - y0 * scale
    back = (
        f'<rect width="{size}" height="{size}" rx="{size * PLATE_RADIUS:.1f}" '
        f'fill="{DEEP}" opacity="{PLATE_ALPHA}"/>'
        if plate
        else ""
    )
    wrapper = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{back}'
        f'<g transform="translate({brand.fmt(dx)},{brand.fmt(dy)}) scale({scale:.6f})">'
        f"{brand.inner_paths(svg)}</g></svg>"
    )
    doc = pymupdf.open(stream=wrapper.encode(), filetype="svg")
    pm = doc[0].get_pixmap(alpha=True, matrix=pymupdf.Matrix(1, 1))
    doc.close()
    return pm


def build_watermarks(verbose: bool = True) -> int:
    """Le fichier à téléverser, et son repli pour une chaîne au plan sombre."""
    jobs = [
        (OUT / "filigranes/youtube.png", True),
        (OUT / "filigranes/youtube-sans-plaque.png", False),
    ]
    for dest, plate in jobs:
        brand.write_png(watermark(WATERMARK, plate), dest)
        weight = dest.stat().st_size
        # Un PNG de 150×150 est très loin du mégaoctet, mais la limite est celle
        # de YouTube et pas la nôtre : on la vérifie plutôt que de la supposer.
        if weight > 1_000_000:
            raise SystemExit(f"{dest.name} dépasse le mégaoctet admis par YouTube.")
        if verbose:
            print(f"  filigrane {dest.stem:<19} {WATERMARK}×{WATERMARK}  {weight / 1024:.0f} Ko")
    return len(jobs)


# --------------------------------------------------------------------------- #
# Bannières
# --------------------------------------------------------------------------- #


def font_face(weight: int) -> str:
    """Outfit en data URI : Chrome n'a aucune police web sans réseau."""
    blob = base64.b64encode((FONTS / f"outfit-{weight}.woff2").read_bytes()).decode()
    return (
        "@font-face{font-family:Outfit;font-style:normal;font-weight:%d;"
        "src:url(data:font/woff2;base64,%s) format('woff2')}" % (weight, blob)
    )


def logo(name: str) -> str:
    """Le lockup du kit, inliné tel quel — jamais retouché, jamais redessiné."""
    svg = (KIT / f"{name}.svg").read_text()
    return svg.split("?>", 1)[-1].strip()


def horizon(width: int, height: int, baseline: float, relief: float = 1.0) -> str:
    """Le motif de fond : la ligne d'horizon EST le graphique.

    L'icône de la marque dit déjà cela — des barres qui montent posées sur des
    collines. On étire ce même geste sur la largeur de la bannière. Il reste une
    texture (opacités très basses) et non une seconde marque : le lockup doit
    rester le seul objet qu'on lit comme un logo.

    `baseline` est la hauteur du sol, en fraction de la hauteur totale, et
    `relief` l'amplitude du dessin. Les deux servent à loger le paysage dans la
    zone réellement vue : sur YouTube, une bannière composée sur ses 1440 px de
    haut n'a plus rien à montrer dans la bande de 423 px que voit un téléphone.
    """
    ground = height * baseline
    # Les barres montent de gauche à droite, mais pas linéairement : une courbe
    # qui s'aplatit en haut, comme une croissance qui se stabilise. Elles
    # restent basses et étroites — c'est du relief, pas un diagramme à lire.
    bars = []
    n = 24
    for i in range(n):
        t = i / (n - 1)
        bar_h = height * (0.03 + 0.17 * (t**0.8)) * relief
        bw = width / (n * 2.3)
        x = width * 0.03 + t * (width * 0.94 - bw)
        bars.append(
            f'<rect x="{x:.1f}" y="{ground - bar_h:.1f}" width="{bw:.1f}" '
            f'height="{bar_h:.1f}" rx="{bw * 0.36:.1f}" fill="{GREEN}" opacity="0.14"/>'
        )

    # Deux collines décalées passent devant les barres et les ancrent au sol.
    hill_a = height * 0.13 * relief
    hill_b = height * 0.08 * relief
    crest = (
        f"M0 {ground + hill_b * 0.6:.0f} "
        f"Q {width * 0.4:.0f} {ground - hill_b * 0.3:.0f} {width} {ground + hill_b:.0f}"
    )
    # L'orange n'apparaît qu'ici, et sous la forme d'un fait : la crête la plus
    # proche prend le soleil. Un filet de lumière sur le paysage, pas un trait
    # décoratif posé à côté du texte.
    return f"""<svg class="horizon" viewBox="0 0 {width} {height}" preserveAspectRatio="none">
      {''.join(bars)}
      <path d="M0 {ground:.0f} Q {width * 0.28:.0f} {ground - hill_a:.0f} {width * 0.56:.0f} {ground - hill_a * 0.35:.0f}
               T {width} {ground - hill_a * 0.9:.0f} V {height} H0 Z" fill="{GREEN}" opacity="0.20"/>
      <path d="{crest} V {height} H0 Z" fill="{EARTH}" opacity="0.72"/>
      <path d="{crest}" fill="none" stroke="{SUN}" stroke-width="{max(2, height * 0.0045):.1f}"
            opacity="0.5" vector-effect="non-scaling-stroke"/>
    </svg>"""


# Gabarits. Pour chaque réseau :
#   size   : dimensions d'export, celles attendues par le réseau
#   safe   : zone visible sur TOUS les écrans (x, y, largeur, hauteur)
#   avatar : coin recouvert par la photo de profil, à laisser vide
#   align  : où poser le bloc de texte dans la zone sûre
BANNERS = {
    # Page entreprise. 1128×191 est une bande très basse : une seule ligne de
    # texte y tient. Le pavé du logo de la page se pose en bas à gauche — et
    # comme il porte déjà la marque, répéter le lockup complet juste à côté
    # ferait doublon. On ne met donc que le mot.
    "linkedin-page": {
        "size": (1128, 191),
        "safe": (268, 0, 836, 191),
        "avatar": (24, 36, 240, 155),
        "mark": ("wordmark-white", 58),
        "title": "Le logiciel de gestion d'élevage avicole",
        "sub": "Pensé au Sénégal, pour l'Afrique de l'Ouest.",
        "scale": {"title": 30, "sub": 19, "gap": 7},
        "layout": "row",
        "baseline": 0.80,
    },
    # Profil personnel. La photo ronde déborde en bas à gauche sur ~264 px.
    "linkedin-profil": {
        "size": (1584, 396),
        "safe": (470, 40, 1060, 316),
        "avatar": (100, 150, 310, 310),
        "mark": ("logo-horizontal-compact-white", 76),
        "title": "Votre élevage, enfin sous contrôle.",
        "sub": "De la bande à la marge : poulets, coûts et ventes sur une seule plateforme.",
        "scale": {"title": 50, "sub": 24, "gap": 16},
        "layout": "stack",
        "baseline": 0.84,
    },
    # Couverture de page. Le bureau rogne en hauteur, le mobile sur les côtés :
    # la zone sûre est l'intersection des deux. La photo de profil monte haut sur
    # une couverture de page — le bloc démarre donc à droite de sa colonne, et
    # pas au bord gauche, sinon elle recouvre le début de chaque ligne.
    "facebook": {
        "size": (1640, 856),
        "safe": (462, 118, 1090, 520),
        "avatar": (60, 520, 360, 336),
        "mark": ("logo-horizontal-compact-white", 112),
        "title": "Votre élevage,\nenfin sous contrôle.",
        "sub": "Suivez vos bandes, vos coûts et vos ventes sur une seule plateforme.\nGratuit pendant le pilote.",
        "scale": {"title": 68, "sub": 29, "gap": 24},
        "layout": "stack",
        "baseline": 0.86,
    },
    # Chaîne. On exporte en 2560×1440 pour les téléviseurs, mais tout ce qui
    # compte doit tenir dans la bande centrale de 1546×423 : c'est la seule
    # partie visible sur un téléphone.
    "youtube": {
        "size": (2560, 1440),
        "safe": (507, 508, 1546, 423),
        "avatar": None,
        "mark": ("logo-horizontal-compact-white", 104),
        "title": "Votre élevage, enfin sous contrôle.",
        "sub": "jawdi.app",
        "scale": {"title": 54, "sub": 30, "gap": 20},
        "layout": "center",
        # Sol remonté et relief aplati : composés sur toute la hauteur, collines
        # et barres seraient entièrement sous la bande vue au téléphone.
        "baseline": 0.62,
        "relief": 0.38,
    },
    # En-tête X. L'avatar déborde en bas à gauche ; le bandeau est bas, donc
    # une ligne de titre et une seule.
    "x": {
        "size": (1500, 500),
        "safe": (392, 44, 1046, 340),
        "avatar": (56, 290, 300, 210),
        "mark": ("logo-horizontal-compact-white", 72),
        "title": "Votre élevage, enfin sous contrôle.",
        "sub": "Gestion d'élevage avicole en Afrique de l'Ouest.",
        "scale": {"title": 46, "sub": 23, "gap": 14},
        "layout": "stack",
        "baseline": 0.84,
    },
}


def banner_html(spec: dict, guides: bool) -> str:
    w, h = spec["size"]
    sx, sy, sw, sh = spec["safe"]
    mark_name, mark_h = spec["mark"]
    s = spec["scale"]
    layout = spec["layout"]

    title = spec["title"].replace("\n", "<br/>")
    sub = spec["sub"].replace("\n", "<br/>")

    overlay = ""
    if guides:
        ax = spec["avatar"]
        avatar_box = (
            f'<div class="g gavatar" style="left:{ax[0]}px;top:{ax[1]}px;'
            f'width:{ax[2]}px;height:{ax[3]}px"></div>' if ax else ""
        )
        overlay = f"""
        <div class="g gsafe" style="left:{sx}px;top:{sy}px;width:{sw}px;height:{sh}px">
          <span>zone sûre {sw}×{sh}</span>
        </div>{avatar_box}"""

    # Le hero de la landing : deux halos (vert en haut à droite, orange en bas à
    # gauche) sur une diagonale vert profond. Repris à l'identique pour que les
    # comptes et le site soient visiblement la même marque.
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{font_face(400)}{font_face(500)}{font_face(600)}{font_face(700)}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{w}px;height:{h}px;overflow:hidden}}
.frame{{position:relative;width:{w}px;height:{h}px;
  background:
    radial-gradient(140% 90% at 82% -10%, rgba(61,139,61,.50), transparent 55%),
    radial-gradient(120% 120% at 8% 120%, rgba(242,163,26,.14), transparent 50%),
    linear-gradient(165deg, {EARTH} 0%, {DEEP} 62%, #0e240e 100%);
  font-family:Outfit, system-ui, sans-serif;color:{MIST};overflow:hidden}}
.horizon{{position:absolute;inset:0;width:100%;height:100%}}
.safe{{position:absolute;left:{sx}px;top:{sy}px;width:{sw}px;height:{sh}px;
  display:flex;flex-direction:column;justify-content:center}}
.safe.row{{flex-direction:row;align-items:center;gap:{sw * 0.045:.0f}px}}
.safe.center{{align-items:center;text-align:center}}
.mark svg{{height:{mark_h}px;width:auto;display:block}}
.title{{font-weight:700;font-size:{s['title']}px;line-height:1.08;
  letter-spacing:-.022em;color:#fff;margin-top:{s['gap']}px}}
.sub{{font-weight:400;font-size:{s['sub']}px;line-height:1.42;
  color:rgba(234,243,228,.80);margin-top:{s['gap'] * 0.55:.0f}px;max-width:{sw * 0.9:.0f}px}}
.safe.row .title{{margin-top:0}}
.safe.row .sub{{margin-top:{s['gap'] * 0.3:.0f}px}}
.copy{{min-width:0}}
.g{{position:absolute;pointer-events:none}}
.gsafe{{outline:3px dashed rgba(242,163,26,.95)}}
.gsafe span{{position:absolute;left:0;top:-30px;font:600 20px Outfit;color:{SUN}}}
.gavatar{{outline:3px dashed rgba(255,90,90,.95);border-radius:50%;
  background:rgba(255,90,90,.16)}}
</style></head><body><div class="frame">
{horizon(w, h, spec['baseline'], spec.get('relief', 1.0))}
<div class="safe {layout}">
  <div class="mark">{logo(mark_name)}</div>
  <div class="copy">
    <div class="title">{title}</div>
    <div class="sub">{sub}</div>
  </div>
</div>{overlay}
</div></body></html>"""


def shoot(html: str, size: tuple[int, int], dest: Path) -> None:
    """Chrome sans interface. Il écrit une image valide ET râle sur stderr :
    on vérifie donc le fichier, pas le code de sortie."""
    w, h = size
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "page.html"
        page.write_text(html, encoding="utf-8")
        subprocess.run(
            [
                str(CHROME), "--headless", "--disable-gpu", "--no-sandbox",
                "--hide-scrollbars", "--force-device-scale-factor=1",
                f"--window-size={w},{h}", f"--screenshot={dest}",
                "--virtual-time-budget=4000", page.as_uri(),
            ],
            capture_output=True, timeout=120,
        )
    if not dest.exists() or dest.stat().st_size < 2000:
        raise SystemExit(f"Chrome n'a pas produit {dest.name} (ou l'a produit vide).")


def build_banners(guides: bool, verbose: bool = True) -> int:
    count = 0
    for network, spec in BANNERS.items():
        w, h = spec["size"]
        shoot(banner_html(spec, False), spec["size"], OUT / f"bannieres/{network}.png")
        count += 1
        if guides:
            shoot(banner_html(spec, True), spec["size"], OUT / f"bannieres/reperes/{network}.png")
            count += 1
        if verbose:
            print(f"  bannière {network:<20} {w}×{h}")
    return count


def main() -> None:
    if not CHROME.exists():
        raise SystemExit(f"Chrome introuvable : {CHROME}")
    if not (KIT / "icon-dark.svg").exists():
        raise SystemExit("Kit de marque absent — lancer d'abord build-brand-assets.py")

    guides = "--guides" in sys.argv
    if OUT.exists():
        shutil.rmtree(OUT / "avatars", ignore_errors=True)
        shutil.rmtree(OUT / "filigranes", ignore_errors=True)
        shutil.rmtree(OUT / "bannieres", ignore_errors=True)

    n_av = build_avatars()
    n_fg = build_watermarks()
    n_bn = build_banners(guides)
    print(f"\n{n_av} avatars + {n_fg} filigranes + {n_bn} bannières → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
