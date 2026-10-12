# Logo Jawdi — kit de marque

Logo officiel livré par le designer le 2026-10-12. Tout ce qui est ici est
**généré** depuis `source/` par `scripts/build-brand-assets.py` : on ne modifie
jamais un SVG à la main, on relance le script.

```bash
pip install pymupdf          # outil de build local, pas une dépendance de l'app
scripts/build-brand-assets.py
```

Le script régénère aussi, d'un seul geste, les fichiers du web, de la landing et
du mobile. Il échoue bruyamment si la mise en page de la source change (il
vérifie le nombre de tracés par zone) plutôt que de produire un logo amputé.

## Quel fichier prendre

| Besoin | Fichier |
|---|---|
| Interface, en-tête, barre latérale (fond clair) | `logo-horizontal-compact.svg` |
| Idem sur fond sombre ou photo | `logo-horizontal-compact-white.svg` |
| Grand format, impression, affiche | `logo-horizontal.svg` / `logo-vertical.svg` |
| Carré, avatar, favicon, icône d'app | `icon.svg` |
| Même icône sur fond sombre | `icon-white.svg` |
| Le mot seul, sans l'icône | `wordmark.svg` |
| Partage social (OpenGraph, WhatsApp) | `og-card.png` (1200×630) |

**Compact ou complet ?** Le lockup complet porte la baseline « Plateforme de
gestion d'élevage pour l'Afrique de l'Ouest ». Sous ~80 px de haut, elle fait
moins de 4 px et devient une bavure : toutes les interfaces utilisent donc la
version compacte. Le complet est réservé aux grands formats et à l'impression.

## Couleurs

Relevées dans le fichier Illustrator, elles font foi.

| Rôle | Valeur | Token |
|---|---|---|
| Vert profond — le « J », le wordmark | `#0C4434` | `primary.800` |
| Vert moyen — collines, barres, baseline | `#3B8B3D` | `primary.500` |
| Brun terre — le champ labouré | `#926234` | — |
| Orange — le soleil | `#F2A31A` | `accent.400` |

La palette de l'application a été réalignée sur ces deux verts (cf.
`docs/10-design-system.md` §2). Les ratios de contraste documentés ont été
recalculés : ils tiennent tous.

## À savoir sur le dessin

- **La vache et la poule sont des découpes**, pas des formes blanches. Sur la
  variante blanche, c'est le fond qui les redessine — le logo ne « marche » donc
  que sur un fond suffisamment contrasté, jamais sur une photo claire.
- **Un petit oiseau est en réserve dans la hampe du « J »** du wordmark. Dans la
  source verticale il est posé sur le vide (blanc sur blanc, invisible) : le
  script l'écarte là, sinon il apparaîtrait en tache sur fond sombre.
- Le « J » de l'icône est déjà vert profond : il disparaîtrait sur un fond vert.
  Les icônes d'application sont donc posées sur une plaque blanche — ce qui est
  aussi le rendu de l'export favicon du designer.

## Sources

`source/` conserve les fichiers d'origine : les trois `.ai` (PDF 1.6, vectoriel
pur — zéro image, zéro police, textes vectorisés) et les six `.png` exportés par
le designer. Ils ne sont utilisés par aucune application ; ils sont là pour
pouvoir tout regénérer sans dépendre du designer.
