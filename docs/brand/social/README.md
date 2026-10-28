# Réseaux sociaux — photos de profil et bannières

Tout ce qui est ici est **généré** depuis le kit officiel (`../logo/`) par
`scripts/build-social-assets.py` : on ne retouche aucun fichier à la main, on
relance le script.

```bash
scripts/build-brand-assets.py      # le kit, si les sources du designer ont bougé
scripts/build-social-assets.py     # les déclinaisons sociales
scripts/build-social-assets.py --guides   # + les calques de zone sûre (bannieres/reperes/)
```

## Photos de profil

Un seul dessin — l'icône de la marque — posé sur une plaque. Le jeu par défaut
(`avatars/`) est sur **vert profond**, marque en blanc. Le jeu `avatars/blanc/`
est sur plaque blanche : à ne prendre que si le réseau impose un fond sombre,
car sur le fil blanc de Facebook ou LinkedIn un avatar blanc n'a plus de
silhouette — il se dissout dans la page.

| Réseau | Fichier | Export | Affiché par le réseau | Forme |
|---|---|---|---|---|
| LinkedIn — page entreprise | `avatars/linkedin-page.png` | 400×400 | 300×300 | carré arrondi |
| LinkedIn — profil perso | `avatars/linkedin-profil.png` | 800×800 | 400×400 | rond |
| Facebook — page | `avatars/facebook.png` | 1080×1080 | 170×170 | rond |
| Instagram | `avatars/instagram.png` | 1080×1080 | 320×320 | rond |
| X | `avatars/x.png` | 400×400 | 400×400 | rond |
| YouTube | `avatars/youtube.png` | 800×800 | 98×98 | rond |
| TikTok | `avatars/tiktok.png` | 1080×1080 | 200×200 | rond |
| WhatsApp Business | `avatars/whatsapp-business.png` | 640×640 | 192×192 | rond |

On exporte **au-dessus** de la taille d'affichage parce que les réseaux
ré-encodent à la volée : une source généreuse encaisse mieux leur compression
qu'un fichier calé au pixel près.

LinkedIn est le seul à garder un carré (à coins arrondis) pour le logo d'une
page : son avatar peut donc être plus rempli. Partout ailleurs le rognage est
circulaire, et les quatre coins du carré disparaissent — c'est pourquoi la
marge est plus large sur tous les autres fichiers.

## Filigrane de chaîne (YouTube)

| Fichier | Export | Quand le prendre |
|---|---|---|
| `filigranes/youtube.png` | 150×150 PNG transparent | **par défaut** |
| `filigranes/youtube-sans-plaque.png` | 150×150 PNG transparent | chaîne dont tous les plans sont sombres |

C'est le petit logo posé en bas à droite du lecteur, qui sert de bouton
d'abonnement — YouTube Studio → Personnalisation → Branding. Ce n'est pas une
miniature : c'est de l'identité, au même titre que l'avatar, et c'est pourquoi
il est ici. YouTube conseille 150×150 et accepte PNG, GIF non animé, BMP ou
JPEG, dans la limite d'un mégaoctet ; nos deux fichiers pèsent 5 Ko.

**Téléverser `youtube.png`.** Le filigrane est le seul fichier du kit qui n'a
aucun fond à nous : il se pose sur l'image, et l'image n'est pas la nôtre. Une
marque blanche nue tient sur un plan sombre et s'efface dès que le plan est
clair — or nos vidéos seront tournées en plein soleil, sur de la litière claire.
La plaque verte lui rend la silhouette qui lui manque.

Elle est à 72 % et non pleine : la vidéo transparaît juste assez pour que la
marque se pose **sur** le plan au lieu d'y être collée. Sous 70 %, en revanche,
le vert se délave en sauge grisé dès que le fond est clair — la marque reste
lisible et cesse d'être la nôtre.

Le lecteur affiche ce filigrane bien plus petit que 150 px : de l'ordre de 40 à
90 px selon l'écran. À 40 px le détail de l'icône se referme — ce sont la
silhouette et le vert qui portent la reconnaissance, pas le dessin. Rien à y
faire sans redessiner la marque, ce que ce kit ne fait jamais.

## Bannières

| Réseau | Fichier | Taille | Ce qui est vraiment vu |
|---|---|---|---|
| LinkedIn — page entreprise | `bannieres/linkedin-page.png` | 1128×191 | tout, sauf le coin bas-gauche pris par le logo de la page |
| LinkedIn — profil perso | `bannieres/linkedin-profil.png` | 1584×396 | idem, la photo ronde déborde en bas à gauche |
| Facebook — page | `bannieres/facebook.png` | 1640×856 | le bureau rogne en hauteur, le mobile sur les côtés |
| YouTube — chaîne | `bannieres/youtube.png` | 2560×1440 | **1546×423 au centre** sur téléphone ; la pleine image n'existe que sur téléviseur |
| X — en-tête | `bannieres/x.png` | 1500×500 | tout, sauf le coin bas-gauche pris par l'avatar |

Instagram, TikTok et WhatsApp Business **n'ont pas de bannière** : leur en-tête
est composé par l'application elle-même. Pour eux, la photo de profil et la bio
font tout le travail.

### Les zones sûres

C'est toute la difficulté du format : chaque réseau rogne différemment selon
l'écran, et pose la photo de profil par-dessus. Chaque bannière est donc
composée dans une **zone sûre**, déclarée dans le script, qui est l'intersection
de tous les recadrages possibles ; le reste de l'image n'est que du décor qui
peut disparaître sans rien coûter.

`--guides` produit `bannieres/reperes/` : la même image avec la zone sûre en
pointillés orange et l'emplacement de la photo de profil en rouge. C'est l'outil
pour vérifier à l'œil qu'aucun mot ne passe sous l'avatar. Ces calques ne sont
pas versionnés — ils se regénèrent en une commande.

Le cas extrême est YouTube : on téléverse 2560×1440 pour les téléviseurs, mais
un téléphone n'affiche que la bande centrale de 1546×423. Une bannière composée
sur toute la hauteur n'y montrerait qu'un aplat vert. Le paysage est donc remonté
pour vivre dans cette bande.

## Le dessin

Le fond reprend exactement celui du hero de la landing — mêmes halos, même
dégradé vert profond — pour que les comptes et le site se lisent comme une seule
marque.

Par-dessus, un seul geste : **la ligne d'horizon est le graphique**. L'icône de
Jawdi dit déjà cela — des barres qui montent posées sur des collines — et les
bannières étirent ce même motif sur leur largeur. Il reste une texture, jamais
une seconde marque : le lockup doit rester le seul objet qu'on lit comme un logo.

L'orange n'apparaît qu'à un endroit, et comme un fait plutôt qu'une décoration :
la crête la plus proche prend le soleil.

Les textes viennent de la landing (`landing/src/components/Hero.astro`,
`landing/src/pages/index.astro`) — aucun n'a été réécrit pour l'occasion. Si le
discours du site change, c'est là qu'il faut le changer, puis relancer le script.

## Ce qui n'est pas ici

- **Les visuels de publication** (posts carrés 1080×1080, stories 1080×1920,
  miniatures YouTube 1280×720) : ce sont des gabarits de contenu, pas d'identité.
  À produire quand il y aura un calendrier éditorial.
- **Les captures produit** : voir `../screen/` et les captures de la landing.
