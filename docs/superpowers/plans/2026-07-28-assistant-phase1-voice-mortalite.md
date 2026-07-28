# Assistant IA — Phase 1 : tranche verticale voix → mortalité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design de référence :** `docs/12-assistant-ia-strategie.md` (cible = ouvrier de terrain).

**Goal :** Prouver, sur **une seule action** (enregistrer une mortalité), toute la chaîne de l'assistant :
**voix → intention → prévisualisation → carte de confirmation lue à voix haute → validation 1 tap → file offline**. Plus une amorce de **home tâche‑first** (cartes d'action + gros bouton micro). À faible risque, **100 % mobile**, **sans LLM cloud**, **offline‑capable**.

**Architecture :** L'assistant est une **couche de capture** côté app, au‑dessus de l'endpoint mortalité existant (`/production-units/{id}/mortality`) et de la **file de synchro offline déjà en place** (`enqueueFieldMutation`). Le cœur est un **`IntentParser` abstrait** : Phase 1 fournit un parseur **à règles** pour l'intention « mortalité » (extraction d'un entier depuis le français, y.c. nombres en lettres + motif optionnel). L'UI/flow **ignore** si l'intention vient de règles ou (plus tard) d'un LLM → on pourra brancher un LLM en Phase 2 **sans toucher au flow**. Rien du métier ni du backend ne change.

**Tech Stack :** Expo SDK 56 / React Native / expo-router / TypeScript strict ; Redux Toolkit + RTK Query ; `expo-speech` (TTS, déjà compatible Expo) pour lire la carte ; reconnaissance vocale via un wrapper **pluggable** (`SpeechInput`) — implémentation par dictée native, repli **saisie texte** si indisponible. Tests : Jest (le parseur est **pur → testé à fond**).

## Global Constraints

- **Mobile uniquement.** Aucun changement backend, aucune migration, aucun endpoint nouveau. La validation « réelle » reste le POST existant (survente/garde‑fous inchangés).
- **Offline‑first.** L'extraction d'intention (Phase 1 = règles) tourne **on‑device** ; la confirmation valide via `enqueueFieldMutation` (idempotent, `client_ref`). Aucune dépendance réseau pour le cœur du flow.
- **RBAC respecté.** Le bouton micro / l'action mortalité ne s'affiche que si `can('poultry:write')` (cohérent avec le gating déjà en place).
- **`IntentParser` = interface stable.** Phase 1 : une implémentation à règles pour la seule intention `MORTALITY`. Le contrat ne doit **rien** présumer sur la source (règles vs LLM). Zéro couplage UI↔implémentation.
- **La carte de confirmation est *lisible sans lire*.** Structurée (`Mortalité · 10 sujets · Lot B‑12 · effectif après : 470`), icônes, **lue à voix haute** (`expo-speech`), boutons **Confirmer** (vert) / **Annuler**. Jamais un pavé de texte IA.
- **Pas de LLM, pas de cloud, pas de WhatsApp/IVR, pas de Wolof/Pulaar** en Phase 1 (voir doc 12 §13 — décisions ouvertes, tranchées avant Phase 2).
- **Ajout de dépendance** : si un module de reconnaissance vocale natif est retenu, il faut un **dev build** (déjà le cas du projet) ; sinon repli sur la dictée du clavier + `TextInput`. Toute dépendance passe par `npx expo install`.
- Validation avant commit : `npx tsc --noEmit` **clean** + `npm test` **vert** (dont les tests du parseur). Pas de script de lint mobile.
- Commit : Conventional Commits, scope `feat(mobile:assistant)`. **AUCUNE signature Claude/AI**, pas de « Co-Authored-By », pas d'emoji robot, aucune mention AI/Claude/Anthropic. Branche → PR → merge `--rebase --delete-branch`.
- Docs Expo : lire la doc versionnée v56 avant d'écrire du code Expo (cf. `mobile/AGENTS.md`).

## File Structure

**Nouveau module assistant (`mobile/src/assistant/`)**
- `types.ts` — **créer** : `AssistantIntent` (union ; Phase 1 = `MortalityIntent`), `ParsedIntent`, `IntentParser` (interface), `ConfirmationDraft`.
- `parsers/mortalityParser.ts` — **créer** : parseur à règles FR (entiers + nombres en lettres 0–99, motif optionnel). Pur, sans I/O.
- `parsers/__tests__/mortalityParser.test.ts` — **créer** : couverture ("dix sont morts", "j'ai perdu 3 poules", "5", "rien" → null, casse/accents…).
- `intentRegistry.ts` — **créer** : mappe une intention validée → un `enqueueFieldMutation` (endpoint + payload). Phase 1 : `MORTALITY`.
- `useAssistant.ts` — **créer** : hook orchestrateur (texte reconnu → parseur → `ConfirmationDraft` avec prévisualisation → expose `confirm()` / `cancel()`).
- `speech/useSpeechInput.ts` — **créer** : wrapper reconnaissance vocale (démarrer/arrêter, callback texte) + capacité/repli.
- `speech/tts.ts` — **créer** : `speak(text)` via `expo-speech` (fr-FR), coupé si voix indisponible.

**UI**
- `mobile/src/components/assistant/MicButton.tsx` — **créer** : gros bouton micro (états idle/écoute), a11y label.
- `mobile/src/components/assistant/ConfirmationCard.tsx` — **créer** : carte structurée + TTS + Confirmer/Annuler.
- `mobile/src/components/assistant/AssistantSheet.tsx` — **créer** : feuille basse qui héberge micro + transcription + carte.

**Intégrations**
- `mobile/app/(field)/(tabs)/home.tsx` — **modifier** : amorce tâche‑first (cartes d'action existantes + **FAB micro** ouvrant l'`AssistantSheet`).
- `mobile/app/(field)/lots/[unitId]/index.tsx` — **modifier** : bouton micro dans le détail lot (unitId connu → chemin le plus court à prouver), gété par `poultry:write`.
- `mobile/src/constants/navigation.ts` — **modifier** si une route/sheet dédiée est nécessaire (sinon sheet in‑place).

**Docs**
- `docs/superpowers/plans/2026-07-28-assistant-phase1-voice-mortalite.md` — ce plan (**cocher** au fil de l'eau).

---

## Task 1: Contrats de l'assistant (`types.ts` + `intentRegistry.ts`)

**Files:** créer `mobile/src/assistant/types.ts`, `mobile/src/assistant/intentRegistry.ts`

- [ ] `IntentParser` : `parse(text: string, ctx: ParseContext): ParsedIntent | null` — `ctx` porte le `unitId` courant (si connu) et la liste des lots actifs (résolution/défaut).
- [ ] `MortalityIntent = { kind: 'MORTALITY'; count: number; reason?: string; unitId: number }`.
- [ ] `ConfirmationDraft = { intent: AssistantIntent; title: string; lines: {label,value}[]; speech: string }` — tout ce qu'il faut pour afficher **et** lire la carte, calculé sans réseau.
- [ ] `intentRegistry` : `toMutation(intent, farmId)` → `EnqueueFieldMutationInput` (Phase 1 : mortalité → endpoint `/production-units/{unitId}/mortality`, payload `{count, reason?, clientRef}` avec `clientRef` frais — même sémantique que l'écran mortalité actuel).
- [ ] **Contrat testable, zéro dépendance UI/LLM.**

## Task 2: Parseur mortalité à règles (+ tests)

**Files:** créer `mobile/src/assistant/parsers/mortalityParser.ts` (+ `__tests__/mortalityParser.test.ts`)

- [ ] Détecte l'intention mortalité (motifs : « mort/morts/perdu/décès/crevé… »).
- [ ] Extrait le **compte** : chiffres (`10`) **et** nombres en lettres FR 0–99 (`dix`, `vingt‑trois`). Ignore la ponctuation/accents/casse.
- [ ] Extrait un **motif** optionnel (texte après « à cause de / parce que / … », borné).
- [ ] Résout `unitId` : `ctx.unitId` si présent ; sinon `null` (le hook demandera le lot — Task 4).
- [ ] Retourne `null` si pas d'intention claire (→ le hook posera **une** question de clarification).
- [ ] Tests : ≥ 8 cas (positifs variés, nombre en lettres, motif, absence de nombre, texte hors‑sujet). **Pur, rapide, déterministe.**

## Task 3: Voix — entrée (`useSpeechInput`) et sortie (`tts`)

**Files:** créer `mobile/src/assistant/speech/useSpeechInput.ts`, `mobile/src/assistant/speech/tts.ts`

- [ ] `tts.speak(text)` via `expo-speech` en `fr-FR` ; no‑op si indisponible. `expo-speech` est compatible Expo (à installer via `npx expo install` si absent).
- [ ] `useSpeechInput()` : `{ listening, start(), stop(), transcript, supported }`. Implémentation reconnaissance vocale native FR ; **repli** : `supported=false` → l'UI bascule sur un `TextInput` (dictée clavier). Choix du module STT = **décision à confirmer** (voir doc 12 §13) ; garder l'interface stable quel que soit le module.
- [ ] Permissions micro gérées proprement (demande à la première utilisation, message clair si refus).

## Task 4: Hook orchestrateur (`useAssistant`)

**Files:** créer `mobile/src/assistant/useAssistant.ts`

- [ ] Entrée : `transcript` (voix ou texte) + `farmId` + `unitId?` + lots actifs (via `useListProductionUnitsQuery`).
- [ ] Pipeline : `parse()` → si `null`, exposer une **question de clarification** (« Combien de sujets ? » / « Quel lot ? ») ; si ok, construire le `ConfirmationDraft` (calcul **effectif après** = `currentCount - count`, sans réseau).
- [ ] Résolution du lot : `ctx.unitId` > lot unique actif par défaut > sinon demander (sélecteur dans la carte).
- [ ] `confirm()` : `intentRegistry.toMutation()` → `enqueueFieldMutation()` (réutilise la file offline existante) → reset. `cancel()` : reset.
- [ ] **Aucune écriture directe** : passe toujours par `enqueueFieldMutation` (idempotence + offline gratuits).

## Task 5: UI — MicButton, ConfirmationCard, AssistantSheet

**Files:** créer les 3 composants dans `mobile/src/components/assistant/`

- [ ] `MicButton` : grand, deux états (idle / écoute animée), `accessibilityLabel` clair.
- [ ] `ConfirmationCard` : titre + lignes structurées (icônes), **lue à voix haute à l'affichage** (`tts.speak(draft.speech)`), boutons **Confirmer** (primaire vert, `tokens.touch.primaryButton`) / **Annuler**. Aucune dépendance à la lecture pour comprendre l'action.
- [ ] `AssistantSheet` : feuille basse hébergeant micro + transcription (ou `TextInput` de repli) + `ConfirmationCard` ; se ferme après confirmation avec un retour vocal (« Enregistré »).
- [ ] Design system : tokens existants (couleurs, typo Outfit/JetBrains, touch targets). Repli texte si `!supported`.

## Task 6: Intégration home tâche‑first + détail lot, puis validation

**Files:** modifier `mobile/app/(field)/(tabs)/home.tsx`, `mobile/app/(field)/lots/[unitId]/index.tsx`

- [ ] **Détail lot** (chemin le plus court, `unitId` connu) : bouton micro (gété `poultry:write`) → `AssistantSheet` pré‑contextualisé sur ce lot → dis « dix sont morts » → carte → confirmer → file offline. **Cœur de la preuve.**
- [ ] **Home** : amorce tâche‑first — cartes d'action (Mortalité, Nourrir, Pesée, Collecte, Vendre) routant vers les écrans existants **+ FAB micro** ouvrant l'`AssistantSheet` (mortalité sans lot → sélecteur de lot dans la carte).
- [ ] Validation : `npx tsc --noEmit` clean ; `npm test` vert (parseur inclus) ; essai manuel device (dictée FR → carte → offline) noté dans le PR.
- [ ] **Hors périmètre Phase 1** (documenté, pas codé) : LLM/cloud, autres actions, notifications proactives, WhatsApp/IVR, Wolof/Pulaar.

---

## Décisions ouvertes tranchées avant Phase 2 (rappel doc 12 §13)

- Module de reconnaissance vocale (on‑device vs cloud ; FR d'abord).
- Passage à un **`IntentParser` LLM** (multi‑actions, ambiguïté) — l'interface de Task 1 le permet **sans toucher au flow**.
- Emplacement du moteur d'intention quand le LLM arrive (edge mobile vs bounded context `assistant` backend).

## Definition of Done (Phase 1)

- Depuis un lot, un ouvrier **dit** « dix sont morts » → une **carte** claire s'affiche et se **lit à voix haute** → **un tap** valide → la mortalité part par la **file offline** (marche sans réseau).
- Le `MortalityIntent` est extrait **on‑device**, testé unitairement.
- Le bouton micro respecte `poultry:write`. Repli texte si la voix est indisponible.
- `tsc` clean, `npm test` vert, essai device consigné. Aucun changement backend.
