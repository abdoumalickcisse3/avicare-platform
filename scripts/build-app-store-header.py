#!/usr/bin/env python3
"""Compose la ressource d'en-tête de la page produit App Store.

App Store Connect réclame une « ressource d'en-tête » (le bandeau en haut de la
fiche, nouveau depuis 2025) en 5244×2950 ou 3840×1646. Elle n'existait pas :
la fiche affichait un emplacement vide.

Même fabrique que `build-app-store-screenshots.py` — CSS peint par Chrome
headless, logo officiel de `docs/brand/logo/`, police Outfit encodée en data URI,
aucun appel réseau. Le rendu passe par un facteur d'échelle 2 : la page est
décrite à la moitié des dimensions finales, ce qui garde des valeurs CSS lisibles
tout en sortant les pixels exigés.

    scripts/build-app-store-header.py                  # la variante retenue, 2 tailles
    scripts/build-app-store-header.py --variant fan --size 16:9
    scripts/build-app-store-header.py --all-variants   # planche de comparaison

Deux réserves de composition, tenues dans toutes les variantes :
  - Apple superpose l'icône, le nom de l'app et le bouton par-dessus le BAS du
    bandeau → le quart inférieur reste calme, aucun texte utile n'y descend.
  - Les deux gabarits n'ont pas le même rapport (1,78 contre 2,33) : tout est
    dimensionné en `vh`, si bien que le format large respire horizontalement au
    lieu d'être un recadrage écrasé.
"""

from __future__ import annotations

import argparse
import base64
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAPTURES = ROOT / "docs/brand/screen"
FONTS = ROOT / "landing/src/fonts"
LOGO = ROOT / "docs/brand/logo/logo-horizontal-compact-white.svg"
OUT = ROOT / "docs/mobile/app-store-header"

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

DEEP = "#0C4434"
GREEN = "#3B8B3D"
SUN = "#F2A31A"

# Gabarits acceptés par App Store Connect pour la ressource d'en-tête.
SIZES = {
    "16:9": (5244, 2950),
    "21:9": (3840, 1646),
}

HEADLINE = "Tout votre élevage<br>dans votre poche"
SUBLINE = "Volailles, stocks, soins, ventes — du poussin à la facture."

# Les écrans montrés. L'ordre va du plus parlant au plus technique : l'accueil
# porte la promesse, les deux autres prouvent la profondeur.
FRONT = "IMG_6449.PNG"   # accueil
LEFT = "IMG_6453.PNG"    # lots
RIGHT = "IMG_6450.PNG"   # finance


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def font_face(weight: int) -> str:
    src = data_uri(FONTS / f"outfit-{weight}.woff2", "font/woff2")
    return (
        "@font-face{font-family:'Outfit';font-style:normal;"
        f"font-weight:{weight};font-display:block;src:url({src}) format('woff2')}}"
    )


def logo_svg(cls: str = "logo") -> str:
    svg = LOGO.read_text()
    svg = re.sub(r'\s(width|height)="[^"]*"', "", svg, count=2)
    return svg.replace("<svg ", f'<svg class="{cls}" preserveAspectRatio="xMinYMid meet" ')


def shot(name: str) -> str:
    return data_uri(CAPTURES / name, "image/png")


BASE_CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden}
body{
  background:
    radial-gradient(90% 120% at 82% 10%, rgba(59,139,61,.45) 0%, rgba(59,139,61,0) 60%),
    radial-gradient(60% 90% at 8% 92%, rgba(242,163,26,.16) 0%, rgba(242,163,26,0) 70%),
    linear-gradient(150deg, #10533D 0%, __DEEP__ 55%, #072A1C 100%);
  font-family:'Outfit',system-ui,sans-serif;color:#fff;position:relative;
}
/* Même poussière lumineuse que les captures : évite l'aplat mort sans
   concurrencer le texte. */
.dust{position:absolute;inset:0;opacity:.55;
  background-image:
    radial-gradient(2px 2px at 14% 18%, rgba(255,255,255,.45), transparent),
    radial-gradient(2px 2px at 68% 11%, rgba(255,255,255,.3), transparent),
    radial-gradient(3px 3px at 88% 26%, rgba(242,163,26,.4), transparent),
    radial-gradient(2px 2px at 33% 74%, rgba(255,255,255,.22), transparent),
    radial-gradient(2px 2px at 54% 32%, rgba(255,255,255,.18), transparent),
    radial-gradient(2px 2px at 78% 68%, rgba(255,255,255,.16), transparent);
}
/* Le quart bas reste calme : Apple y pose l'icône, le nom et le bouton. */
.scrim{position:absolute;left:0;right:0;bottom:0;height:30%;
  background:linear-gradient(to top, rgba(4,26,17,.55), rgba(4,26,17,0))}
.logo{height:7.2vh;width:auto;display:block}
h1{font-weight:700;font-size:11.4vh;line-height:1.03;letter-spacing:-.025em}
p.sub{font-weight:500;font-size:4.1vh;line-height:1.3;color:__SUN__;margin-top:2.6vh;text-wrap:balance}
.phone{background:#0B0B0C;border-radius:4.4vh;padding:.55vh;
  box-shadow:0 5vh 11vh rgba(0,0,0,.55), 0 1vh 3vh rgba(0,0,0,.38)}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top center;
  border-radius:3.9vh;display:block}
""".replace("__DEEP__", DEEP).replace("__SUN__", SUN)


def variant_fan() -> str:
    """Trois téléphones en éventail, texte à gauche — la plus « produit »."""
    return f"""<style>
.wrap{{position:absolute;inset:0;display:flex;align-items:center;z-index:2}}
.copy{{width:46%;padding-left:7vh}}
.copy .logo{{margin-bottom:5.4vh}}
h1{{font-size:8.0vh}}
.stage{{position:absolute;right:6vh;top:0;bottom:0;width:46%}}
.stage .phone{{position:absolute;aspect-ratio:1170/2532}}
.p-left{{height:76vh;left:2%;top:21%;transform:rotate(-7deg);opacity:.92;z-index:1}}
.p-right{{height:76vh;right:2%;top:21%;transform:rotate(7deg);opacity:.92;z-index:1}}
.p-front{{height:90vh;left:50%;top:11%;transform:translateX(-50%);z-index:2}}
</style>
<div class="dust"></div>
<div class="wrap">
  <div class="copy">{logo_svg()}<h1>{HEADLINE}</h1><p class="sub">{SUBLINE}</p></div>
</div>
<div class="stage">
  <div class="phone p-left"><img src="{shot(LEFT)}" alt=""></div>
  <div class="phone p-right"><img src="{shot(RIGHT)}" alt=""></div>
  <div class="phone p-front"><img src="{shot(FRONT)}" alt=""></div>
</div>
<div class="scrim"></div>"""


def variant_centre() -> str:
    """Composition centrée — la plus robuste au recadrage d'Apple."""
    return f"""<style>
.wrap{{position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;padding-top:6vh;z-index:2;text-align:center}}
.wrap .logo{{height:8vh;margin-bottom:4.2vh}}
h1{{font-size:10.2vh}}
.stage{{position:absolute;left:0;right:0;top:58%;display:flex;
  justify-content:center;align-items:flex-start;gap:3vh;z-index:1}}
.stage .phone{{aspect-ratio:1170/2532;height:70vh}}
.stage .side{{height:58vh;margin-top:5vh;opacity:.88}}
</style>
<div class="dust"></div>
<div class="stage">
  <div class="phone side"><img src="{shot(LEFT)}" alt=""></div>
  <div class="phone"><img src="{shot(FRONT)}" alt=""></div>
  <div class="phone side"><img src="{shot(RIGHT)}" alt=""></div>
</div>
<div class="wrap">{logo_svg()}<h1>{HEADLINE}</h1><p class="sub">{SUBLINE}</p></div>
<div class="scrim"></div>"""


def variant_horizon() -> str:
    """Un seul écran, beaucoup d'air — la plus « marque », la moins bavarde."""
    return f"""<style>
.wrap{{position:absolute;inset:0;display:flex;align-items:center;z-index:2}}
.copy{{width:58%;padding-left:9vh}}
.copy .logo{{height:8.4vh;margin-bottom:6vh}}
h1{{font-size:12.6vh}}
.stage{{position:absolute;right:9vh;top:0;bottom:0;display:flex;align-items:center;z-index:1}}
.stage .phone{{aspect-ratio:1170/2532;height:94vh;transform:rotate(-5deg)}}
/* Le halo chaud derrière l'appareil reprend le soleil du logo. */
.halo{{position:absolute;right:2vh;top:50%;transform:translateY(-50%);
  width:85vh;height:85vh;border-radius:50%;
  background:radial-gradient(circle, rgba(242,163,26,.22) 0%, rgba(242,163,26,0) 68%)}}
</style>
<div class="dust"></div>
<div class="halo"></div>
<div class="wrap">
  <div class="copy">{logo_svg()}<h1>{HEADLINE}</h1><p class="sub">{SUBLINE}</p></div>
</div>
<div class="stage"><div class="phone"><img src="{shot(FRONT)}" alt=""></div></div>
<div class="scrim"></div>"""


VARIANTS = {"fan": variant_fan, "centre": variant_centre, "horizon": variant_horizon}


def page(variant: str) -> str:
    return (
        "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><style>"
        + font_face(400)
        + font_face(500)
        + font_face(700)
        + BASE_CSS
        + "</style></head><body>"
        + VARIANTS[variant]()
        + "</body></html>"
    )


def render(html: str, width: int, height: int, dest: Path) -> None:
    """Chrome peint à la moitié des dimensions, avec un facteur d'échelle 2."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "header.html"
        src.write_text(html)
        dest.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                CHROME,
                "--headless",
                "--disable-gpu",
                "--hide-scrollbars",
                "--force-device-scale-factor=2",
                f"--window-size={width // 2},{height // 2}",
                f"--screenshot={dest}",
                f"file://{src}",
            ],
            check=False,
            capture_output=True,
        )
    # Chrome sort en erreur sur macOS pour des broutilles d'affichage tout en
    # écrivant une image valide : c'est le fichier qui fait foi.
    if not dest.exists():
        raise SystemExit(f"Chrome n'a rien écrit pour {dest}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", choices=sorted(VARIANTS), default="fan")
    ap.add_argument("--size", choices=sorted(SIZES), help="ne produire qu'un gabarit")
    ap.add_argument("--all-variants", action="store_true", help="les trois, en 16:9")
    ap.add_argument("--out", type=Path, help="dossier de sortie (défaut : docs/)")
    args = ap.parse_args()

    if not Path(CHROME).exists():
        raise SystemExit(f"Chrome introuvable : {CHROME}")
    for name in (FRONT, LEFT, RIGHT):
        if not (CAPTURES / name).exists():
            raise SystemExit(f"capture manquante : {CAPTURES / name}")

    out = args.out or OUT
    if args.all_variants:
        width, height = SIZES["16:9"]
        for name in sorted(VARIANTS):
            dest = out / f"variante-{name}.png"
            render(page(name), width, height, dest)
            print(f"{name:8} → {dest} ({width}×{height})")
        return

    for key in [args.size] if args.size else sorted(SIZES):
        width, height = SIZES[key]
        dest = out / f"en-tete-{width}x{height}.png"
        render(page(args.variant), width, height, dest)
        print(f"{key:5} → {dest} ({width}×{height}, variante « {args.variant} »)")


if __name__ == "__main__":
    main()
