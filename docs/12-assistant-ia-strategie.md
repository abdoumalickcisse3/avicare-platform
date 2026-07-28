# 12 — Assistant IA Jawdi — Stratégie produit & architecture

> Document fondateur. À lire avant toute conception de l'expérience « IA au centre ».
> Cible de ce document : **l'ouvrier de terrain** (persona primaire retenu).
> Statut : **Adopté comme direction**. Phasage et périmètre détaillés ci-dessous.

**Date** : 2026-07-28
**Auteur** : Abdou Malick Cisse
**Se lit avec** : `00-vision-strategique.md`, `05-securite-rbac.md`, `08-mobile-react-native.md`, `11-go-to-market.md`

---

## 1. Problème

Jawdi V1 est fonctionnellement riche : **5 modules** (élevage, sanitaire, stock, commercial, finance), chacun indispensable. Mais l'expérience est **centrée‑fonctionnalité** : l'utilisateur doit savoir *où aller*, *lire*, *saisir*. Or la cible réelle sur le terrain est un **ouvrier‑éleveur pressé, parfois illettré**, qui pense en **intentions**, pas en modules :

> « J'ai vendu 30 poulets à Modou pour 45 000 » · « 10 poussins sont morts » · « Combien Modou me doit ? »

Pour ce public, la complexité = **navigation + lecture + saisie**. C'est cela qu'il faut effondrer — pas les fonctionnalités.

**Repères externes** (documentés) : la **voix bat le texte** pour les faibles‑lecteurs (Farmerline, Kiazi Bora) ; les fermiers **se méfient** des outils qui présupposent littératie numérique + connexion stable ; la tendance UX 2025‑26 est de passer d'**app‑centric à intention‑centric** (l'IA devient l'interface, les menus rétrécissent) tout en gardant **l'humain aux commandes**. Repère local de simplicité et de confiance : **Wave / Orange Money** (une action, une confirmation, icônes).

## 2. Persona cible — l'ouvrier de terrain

| Attribut | Réalité |
|---|---|
| Littératie | Faible à nulle en lecture ; à l'aise à l'**oral** (Wolof/Pulaar, parfois français) |
| Contexte | Dans le poulailler, mains occupées, pressé, souvent **hors ligne** |
| Terminal | Smartphone d'entrée de gamme (partagé parfois) |
| Rôle Jawdi | `FARMER` — quelques actions de terrain (saisie journalière, mortalité, pesée, collecte, vente rapide) |
| Ce qu'il veut | **Faire vite, sans friction**, sans se tromper, sans « chercher » dans l'app |

> Le **propriétaire / gérant** (pilotage multi‑fermes, analytique) est une cible **secondaire** de l'IA, servie surtout par le volet **proactif** (§6). Ce document optimise pour l'ouvrier.

## 3. Vision (telle que portée par le fondateur)

1. **Inscription → onboarding guidé** : l'app accompagne la création (ferme, lot…).
2. **Home** : des **cartes d'action** en haut + un **assistant IA (« Jawdi »)** en bas.
3. **L'IA porte l'expérience** : elle a les données. Pour toute action (ajouter un lot, saisir…), l'ouvrier peut **parler à Jawdi**, qui **vérifie, planifie, et laisse la dernière action — valider — au fermier**.
4. **Résultat** : app **plus rapide sur le terrain, moins de friction**.
5. **Jawdi est aussi un assistant permanent** : interpellable à tout moment (actions, vérifications, conseils) **et proactif** (notifie : baisse des ventes, prévisions, stock bas…).

Cette direction est **adoptée**. Les sections suivantes la rendent exécutable et sûre.

## 4. Principes non‑négociables (les 5 disciplines)

1. **La validation finale est triviale et *lisible sans lire*.** Pas de pavé « l'IA dit que… ». Une **carte structurée** (`Vendre · 30 poulets · Modou · 45 000 F`) + gros bouton **Confirmer** / **Annuler**, **lue à voix haute**. La confiance se gagne ou se perd ici.
2. **Voix d'abord, texte ensuite.** Le geste primaire est un **gros bouton micro**. Le chat texte est un *complément* pour le lettré, jamais le chemin obligé.
3. **L'IA *extrait l'intention* ; le backend *garantit*.** Trois couches : **LLM comprend** → **services déterministes valident** (survente 422, stock, encours — déjà en place) → **humain confirme**. Le LLM **ne décide jamais** d'un montant ou d'un solde de stock.
4. **Offline & coût = contraintes de conception.** Capture locale de l'intention (voix incluse), structuration à la reconnexion via la **file offline existante** ; petits modèles pour l'extraction courante ; **les cartes existent pour que le simple contourne le LLM**. L'IA = chemin *par défaut*, pas *unique*.
5. **Assistif d'abord, agentique ensuite.** Au départ l'IA **prépare**, l'humain valide **tout**. La confiance acquise, on auto‑exécute le **réversible** (journal d'aliment) ; **argent/santé restent en confirmation** — toujours.

> Désaccord de fond assumé avec « l'IA se charge de *tout* » : l'IA se charge de **comprendre et préparer** ; le **système** se charge de **garantir**. C'est la différence entre un assistant fiable et un gadget qui facture 500 000 F par erreur.

## 5. Architecture — l'IA est un *client* de l'API, pas un nouveau système

Le point qui rend la vision réalisable **sans casser le métier** : l'assistant **appelle les mêmes façades/endpoints que l'UI** (function‑calling / tool‑calling vers le REST existant). Donc **même RBAC, mêmes validations, même file offline, mêmes 5 modules — inchangés**.

```
Voix / texte
   │
   ▼
[Compréhension d'intention]  ── LLM (ou parseur léger pour les cas courants)
   │  intention + entités (action, quantités, client…)
   ▼
[Sélection d'outil]          ── mappe vers UN endpoint existant (façade module)
   │
   ▼
[Validation / dry-run]       ── services déterministes (stock, RBAC, encours, 422…)
   │  action vérifiée
   ▼
[CARTE de confirmation]      ── structurée + lue à voix haute
   │  l'ouvrier valide (1 tap)  ← DERNIÈRE ACTION HUMAINE
   ▼
[POST réel]                  ── via la file de synchro offline (idempotent, client_ref)
```

**Insertion dans le monolithe modulaire** : un nouveau *bounded context* **`assistant`** (gateway d'orchestration) qui **consomme les façades publiques** des 5 modules — jamais la DB directement, jamais de cross‑import. Cohérent avec ADR‑001 et les règles doc 00 (référencement par façade). **Rien dans les modules métier ne change.**

**Rôle du LLM (strictement borné)** :
- ✅ Comprendre la parole/le langage, extraire l'intention et les entités.
- ✅ Poser **une** question de clarification à la fois (voix) en cas d'ambiguïté.
- ✅ Rédiger conseils/explications (non‑critiques), lire les cartes à voix haute.
- ❌ **Jamais** produire seul un montant, un solde de stock, une décision financière/sanitaire exécutée sans validation humaine et sans contrôle déterministe.

## 6. Volet proactif (l'IA notifie)

Deux temps, pour rester **crédible** dès le départ :

1. **Phase A — règles déterministes** : `stock aliment < seuil`, `encours client > 15 j`, `taux de ponte −X %`, `mortalité anormale`, `bande prête à vendre`. Fiable, pas cher, explicable. → notification + **action en 1 tap**.
2. **Phase B — prévisions ML** : baisse de ventes anticipée, projection de trésorerie, date de maturité. Ajoutée **après** que les règles aient établi la confiance. On ne vend pas une « prédiction IA » qu'on ne peut pas encore tenir.

## 7. Langues & voix

- **Français d'abord** (ASR/TTS matures) — MVP.
- **Wolof / Pulaar en voix** = phase dédiée (risque technique #1 : ASR local limité). Toujours **garder la carte visuelle en repli** quand la voix échoue.
- Les libellés d'action et les confirmations sont **iconographiques + vocaux**, jamais dépendants de la lecture.

## 8. Sécurité & garde‑fous (réutilise l'existant)

- **RBAC inchangé** : l'assistant agit *au nom de l'utilisateur*, avec ses permissions (`poultry:write`, `health:write`, `inventory:consume`…). Il **ne peut rien** que l'utilisateur ne pourrait faire lui‑même.
- **Argent / santé** : confirmation humaine **obligatoire**, annulation possible, jamais d'auto‑exécution.
- **Traçabilité** : toute action passée par l'IA est journalisée comme une action utilisateur normale (mêmes tables, `client_ref`, audit).
- **Idempotence** : réutilise la file offline (une intention validée = une mutation, dédupliquée).

## 9. Phasage

| Phase | Contenu | Objectif |
|---|---|---|
| **1 — Tranche verticale** | **Une** action bout‑en‑bout à la voix (ex. *« enregistrer une mortalité »* → carte → file offline). Home tâche‑first (cartes + micro). | Prouver la chaîne voix→intention→validation→offline à **faible risque**. |
| **2 — Élargir la capture** | Les 4‑5 actions de terrain (saisie journalière, pesée, collecte, vente rapide, mortalité) via voix + cartes. Clarification conversationnelle. | Couvrir le quotidien de l'ouvrier. |
| **3 — Proactif (règles)** | Moteur d'alertes déterministes + résolution 1 tap. | L'app devient *proactive*, pas seulement réactive. |
| **4 — Assistant conversationnel** | Questions libres (« combien Modou me doit ? »), conseils, multi‑canal (in‑app puis WhatsApp). | Jawdi devient un vrai assistant permanent. |
| **5 — Agentique encadré + ML** | Auto‑exécution du réversible + prévisions. Wolof/Pulaar voix. | Automatisation mûre, sous garde‑fous. |

> On **ne rebâtit pas** le métier : à chaque phase, l'IA orchestre des endpoints existants.

## 10. Risques & mitigations

| Risque | Mitigation |
|---|---|
| **Hallucination sur les chiffres** | Le LLM n'extrait que l'intention ; les chiffres critiques sont **calculés/validés** par le backend ; confirmation humaine. |
| **Offline** | Capture locale (voix incluse), structuration à la reconnexion via la file offline ; parseur léger on‑device pour les cas courants. |
| **Coût LLM à l'échelle** | Cartes pour contourner le LLM sur le simple ; petits modèles ; cache ; appels seulement sur l'ambigu/complexe. |
| **ASR Wolof/Pulaar faible** | Français d'abord ; voix locale en phase ; **repli carte visuelle** systématique. |
| **Confiance / adoption** | Validation ultra‑simple, voix, repère « Wave » ; l'IA ne fait rien hors des droits de l'utilisateur ; transparence + annulation. |
| **Responsabilité (conseil santé/finance)** | Conseils formulés comme suggestions ; actions critiques toujours confirmées ; traçabilité complète. |

## 11. Ce qui NE change PAS

- Les **5 modules** et tout le métier (façades, validations, migrations).
- Le **RBAC**, la **file offline**, l'**idempotence**, le **monolithe modulaire**.
- Le modèle « **paramétrage 3 couches** » (règle d'or n°0) : l'IA lit/écrit *via* les mêmes paramètres, aucune valeur métier en dur.

## 12. Métriques de succès (à instrumenter)

- **Temps pour compléter une action de terrain** (avant/après IA).
- **Taux d'actions initiées par la voix** vs cartes vs navigation classique.
- **Taux de confirmation sans correction** (qualité d'extraction).
- **Rétention terrain** (usage hebdo par l'ouvrier).
- **Coût IA par action** (soutenabilité économique en pilote gratuit).

## 13. Décisions ouvertes (à trancher aux phases suivantes)

- Fournisseur LLM & modèle (coût/latence/offline), et découpage on‑device vs cloud.
- Canal après l'in‑app : **WhatsApp** (là où sont les gens) vs IVR/USSD (le plus inclusif).
- Provider ASR/TTS Wolof/Pulaar.
- Où vit le moteur d'intention (bounded context `assistant` backend vs edge mobile).

---

_Ce document fige la **direction** et les **garde‑fous**. La première tranche verticale (Phase 1) fera l'objet d'un plan d'exécution dédié dans `docs/superpowers/plans/`._
