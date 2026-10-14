#!/usr/bin/env python3
"""Compose les captures d'écran App Store de Jawdi.

Les visuels de la fiche App Store sont des compositions : une capture réelle
prise sur iPhone, posée dans un cadre de téléphone sur un fond de marque, avec
le logo officiel et une accroche. Elles étaient montées à la main — donc
irreproductibles, et elles portaient un faux logo (un « J » dessiné à la main
suivi du mot JAWDI en texte) au lieu de la marque livrée par le designer. Ce
script les régénère depuis les sources, logo officiel compris.

Le rendu passe par Chrome en mode headless plutôt que par une bibliothèque
d'images : le cadre est du CSS (dégradé, ombre portée, coins arrondis, texte
composé), et Chrome sait le peindre exactement comme un navigateur. Les polices
sont encodées en data URI depuis `landing/src/fonts/` : aucun appel réseau, donc
le même rendu dans six mois.

    scripts/build-app-store-screenshots.py            # toutes les tailles
    scripts/build-app-store-screenshots.py --size 6.3 # une seule

Tailles : App Store Connect exige depuis 2025 le gabarit « 6,3 pouces »
(1206×2622). Le 6,9 pouces (1320×2868) reste accepté et sert de second jeu. Les
anciennes compositions étaient en 1284×2778 (6,5 pouces), qui n'est plus qu'un
repli — c'est la raison principale de cette régénération.
"""

from __future__ import annotations

import argparse
import base64
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAPTURES = ROOT / "docs/brand/screen"
FONTS = ROOT / "landing/src/fonts"
LOGO = ROOT / "docs/brand/logo/logo-horizontal-compact-white.svg"
OUT = ROOT / "docs/mobile/app-store-screenshots"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Couleurs du kit de marque (docs/brand/logo/README.md).
DEEP = "#0C4434"
GREEN = "#3B8B3D"
SUN = "#F2A31A"

# Gabarits App Store Connect, en pixels.
SIZES = {
    "6.3": (1206, 2622),  # exigé depuis 2025 — « iPhone à Dynamic Island »
    "6.9": (1320, 2868),  # accepté, grand format
}

# L'ordre est celui de la fiche : il raconte une journée d'élevage, de la vue
# d'ensemble à l'encaissement. La capture est le fichier réel pris sur
# l'appareil ; l'accroche et le sous-titre sont ceux validés pour la fiche.
SCREENS = [
    (
        "IMG_6449.PNG",
        "Toute votre ferme, en un coup d'œil",
        "Cheptel, ventes, alertes : votre journée commence ici.",
    ),
    (
        "IMG_6453.PNG",
        "Chaque lot suivi jusqu'au dernier sujet",
        "Effectif, âge, mortalité — synchronisés automatiquement.",
    ),
    (
        "IMG_6454.PNG",
        "La croissance de vos volailles, sans calculette",
        "Poids réel vs cible, prévision de maturité en un clin d'œil.",
    ),
    (
        "IMG_6458.PNG",
        "Votre journée enregistrée en 30 secondes",
        "Mortalité, aliment, eau — même sans connexion.",
    ),
    (
        "IMG_6456.PNG",
        "Ne ratez plus jamais un vaccin",
        "Rappels automatiques, historique complet par lot.",
    ),
    (
        "IMG_6455.PNG",
        "Ponte, plateaux, pondeuses : tout compté",
        "Le suivi complet de votre production d'œufs.",
    ),
    (
        "IMG_6450.PNG",
        "Vos finances de ferme, claires et à jour",
        "Revenus, dépenses, marge — sans tableur.",
    ),
    (
        "IMG_6457.PNG",
        "Vendez directement depuis votre téléphone",
        "Espèces, Mobile Money, virement : tout est suivi.",
    ),
]


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def font_face(weight: int) -> str:
    """Outfit, encodée dans la page : le rendu ne dépend d'aucun réseau."""
    src = data_uri(FONTS / f"outfit-{weight}.woff2", "font/woff2")
    return (
        "@font-face{font-family:'Outfit';font-style:normal;"
        f"font-weight:{weight};font-display:block;src:url({src}) format('woff2')}}"
    )


def logo_svg() -> str:
    """Le logo officiel, inline — pour qu'il hérite de la taille du cadre."""
    svg = LOGO.read_text()
    # Les attributs de taille gênent la mise à l'échelle par CSS ; le viewBox suffit.
    svg = re.sub(r'\s(width|height)="[^"]*"', "", svg, count=2)
    return svg.replace("<svg ", '<svg class="logo" preserveAspectRatio="xMinYMid meet" ')


def page(width: int, height: int, capture: Path, headline: str, subtitle: str) -> str:
    """Une composition, entièrement dimensionnée en pourcentage de la hauteur.

    Les deux gabarits n'ont pas tout à fait le même rapport (0,460 contre 0,4603) :
    tout exprimer en `vh` plutôt qu'en pixels donne deux images identiques à l'œil
    plutôt que deux mises en page à régler séparément.
    """
    shot = data_uri(capture, "image/png")
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
{font_face(400)}{font_face(500)}{font_face(700)}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{width}px;height:{height}px;overflow:hidden}}
body{{
  background:
    radial-gradient(120% 70% at 78% 4%, rgba(59,139,61,.42) 0%, rgba(59,139,61,0) 62%),
    linear-gradient(168deg, #10533D 0%, {DEEP} 58%, #08301F 100%);
  font-family:'Outfit',system-ui,sans-serif;
  display:flex;flex-direction:column;align-items:center;
  position:relative;
}}
/* Grains de lumière : la même poussière que sur le fond de la landing, qui
   évite l'aplat mort sans jamais concurrencer le texte. */
.dust{{position:absolute;inset:0;opacity:.5;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 9%, rgba(255,255,255,.5), transparent),
    radial-gradient(1.5px 1.5px at 73% 6%, rgba(255,255,255,.35), transparent),
    radial-gradient(2px 2px at 88% 15%, rgba(242,163,26,.45), transparent),
    radial-gradient(1.5px 1.5px at 30% 19%, rgba(255,255,255,.28), transparent),
    radial-gradient(1.5px 1.5px at 57% 23%, rgba(255,255,255,.22), transparent);
}}
header{{width:100%;padding:2.6vh 0 0 5.0vh;z-index:2}}
/* La vache et la poule du logo sont des DÉCOUPES, pas des formes blanches :
   sous ~100 px de haut elles se referment et la scène devient une tache. D'où
   une hampe généreuse ici — c'est la taille minimale où le dessin se lit. */
.logo{{height:4.0vh;width:auto;display:block}}
.copy{{width:100%;padding:2.9vh 5.0vh 0;z-index:2}}
h1{{
  font-weight:700;font-size:3.28vh;line-height:1.1;color:#fff;
  letter-spacing:-.018em;text-wrap:balance;
}}
p{{font-weight:500;font-size:1.72vh;line-height:1.35;color:{SUN};margin-top:1.3vh;text-wrap:balance}}
/* Le téléphone déborde volontairement par le bas : l'écran continue hors cadre,
   ce qui donne l'impression d'un appareil posé devant soi plutôt que d'une
   vignette collée. */
.phone{{
  position:absolute;left:50%;transform:translateX(-50%);
  top:25.2vh;width:79%;aspect-ratio:1170/2532;
  background:#0B0B0C;border-radius:5.2vh;padding:.62vh;
  box-shadow:0 2.6vh 5.5vh rgba(0,0,0,.52), 0 .5vh 1.4vh rgba(0,0,0,.34);
  z-index:1;
}}
.phone img{{width:100%;height:100%;object-fit:cover;object-position:top center;
  border-radius:4.7vh;display:block}}
</style></head><body>
<div class="dust"></div>
<header>{logo_svg()}</header>
<div class="copy"><h1>{headline}</h1><p>{subtitle}</p></div>
<div class="phone"><img src="{shot}" alt=""></div>
</body></html>"""


def shoot(html: str, width: int, height: int, dest: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "frame.html"
        src.write_text(html)
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                CHROME,
                "--headless",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                f"--window-size={width},{height}",
                "--default-background-color=00000000",
                f"--screenshot={dest}",
                f"file://{src}",
            ],
            check=False,
            capture_output=True,
        )
    # Chrome sort en erreur sur macOS pour des broutilles d'affichage
    # (« CVDisplayLinkCreateWithCGDisplay failed ») tout en écrivant une image
    # parfaitement valide : c'est le fichier qui fait foi, pas le code de retour.
    if not dest.exists():
        raise SystemExit(f"Chrome n'a rien écrit pour {dest}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", choices=sorted(SIZES), help="ne produire qu'un gabarit")
    args = ap.parse_args()

    if not Path(CHROME).exists():
        raise SystemExit(f"Chrome introuvable : {CHROME}")
    for name, _, _ in SCREENS:
        if not (CAPTURES / name).exists():
            raise SystemExit(f"capture manquante : {CAPTURES / name}")

    wanted = [args.size] if args.size else sorted(SIZES)
    for size in wanted:
        width, height = SIZES[size]
        folder = OUT / f"iphone-{size}"
        if folder.exists():
            shutil.rmtree(folder)
        for i, (name, headline, subtitle) in enumerate(SCREENS, start=1):
            dest = folder / f"{i:02d}-{Path(name).stem.lower()}.png"
            shoot(page(width, height, CAPTURES / name, headline, subtitle), width, height, dest)
        print(f"{size}\"  → {folder.relative_to(ROOT)} ({len(SCREENS)} images {width}×{height})")


if __name__ == "__main__":
    main()
