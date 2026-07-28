# Assistant IA — Phase 2 : STT natif + intention LLM hybride, multi-actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).
> **Design de référence :** `docs/12-assistant-ia-strategie.md`. **Suit :** `2026-07-28-assistant-phase1-voice-mortalite.md`.

**Goal :** Faire de Jawdi un vrai compagnon vocal de terrain : **micro in-app natif (FR)** + un moteur d'intention **hybride** (règles on-device d'abord, **LLM cloud en secours** derrière un bounded context `assistant` backend) couvrant **les actions de terrain** (mortalité, saisie journalière, pesée, collecte d'œufs). Toujours : l'IA **extrait** → le backend **valide (dry-run)** → **carte de confirmation** → **file offline** ; l'humain confirme.

**Décisions (tranchées) :** hybride (règles + LLM cloud) ; STT **natif on-device FR** d'abord ; élargir à plusieurs actions. **LLM = Anthropic Claude** derrière une interface `LlmClient` (swappable), clé via secret backend.

**Architecture :**
- **Backend `assistant` bounded context** : `POST /assistant/interpret` reçoit `{text, unitId?}` → appelle le LLM avec des **définitions d'outils** (une par action, schéma des champs) → le LLM renvoie un **tool-call structuré** → le backend **valide en dry-run** (services existants : unité, stock, cohérence) → renvoie un **brouillon** (action + champs + résumé) **ou** une question de clarification. **Il n'exécute rien** : l'exécution reste le *confirm* mobile → endpoints existants via la **file offline**. Clés/coût/sécurité côté serveur.
- **Mobile** : STT natif alimente le `AssistantSheet` ; un `IntentParser` **LLM** (async, appelle `/assistant/interpret`) sert de **fallback** quand le parseur à règles rend `null` (hybride) ; registre + brouillons étendus aux 4 actions.
- **Ordre d'exécution :** tout est codable/testable avec un **`MockLlmClient`** ; le vrai `AnthropicLlmClient` se branche en dernier (clé requise).

**Tech Stack :** Backend Spring Boot 3.4 / Java 21 (JUnit5 + Mockito + AssertJ) ; client HTTP pour l'API Anthropic ; secrets via `application.yml`/env. Mobile Expo SDK 56 / RN / RTK Query ; module STT natif (dev build).

## Global Constraints

- **L'IA propose, le système garantit.** Le LLM ne produit **jamais** un montant/solde exécuté sans dry-run déterministe + confirmation humaine. Argent/santé = confirmation obligatoire.
- **Offline-first.** Règles on-device d'abord ; le LLM n'est appelé **que** en ligne et **que** si les règles échouent. Hors ligne, l'assistant reste utilisable sur les actions couvertes par les règles (mortalité + phrases simples).
- **Confidentialité.** Seul le **texte** transcrit part au backend (jamais l'audio). Le backend n'envoie au LLM que le nécessaire (texte + schémas d'action + contexte minimal : noms de lots). Documenter ce qui sort.
- **RBAC/tenancy inchangés.** `/assistant/interpret` gété par accès ferme ; le **confirm** réel reste gété par la permission d'écriture de l'action (`poultry:write`/`health:write`) au POST — comme aujourd'hui. Le micro reste masqué sans droit d'écriture.
- **File offline & endpoints métier inchangés.** L'assistant reste un *client*.
- **`IntentParser` interface stable** (Phase 1) : on ajoute une implémentation LLM et des règles pour les autres actions, sans changer le flow.
- **Coût maîtrisé** : cache/court-circuit par les règles ; pas d'appel LLM sur le trivial.
- Backend avant commit : `./mvnw -q spotless:apply` ; `*IT` = CI only. Mobile : `npx tsc --noEmit` + `npm test` verts ; `npm ci` en sync après tout ajout de dépendance.
- Commits Conventional, scope `feat(assistant)` / `feat(mobile:assistant)`. **Aucune signature Claude/AI.** Branche → PR → merge `--rebase --delete-branch`.

## File Structure

**Backend — nouveau bounded context `com.avicare.assistant`**
- `assistant/llm/LlmClient.java` — interface (`interpret(prompt, tools) -> ToolCall|Clarification`).
- `assistant/llm/AnthropicLlmClient.java` — impl HTTP Anthropic (clé `avicare.assistant.anthropic.api-key`). **Brancher en dernier.**
- `assistant/llm/MockLlmClient.java` (+ profil test) — renvoie des tool-calls déterministes pour tester toute la chaîne sans clé.
- `assistant/tools/ActionTools.java` — définitions d'outils (schéma par action : MORTALITY, DAILY_RECORD, WEIGHING, EGG_COLLECTION).
- `assistant/service/InterpretService.java` — orchestre LLM → mapping tool-call → **dry-run** via façades (`LivestockFacade`, egg/daily services) → `DraftResponse|ClarificationResponse`.
- `assistant/controller/AssistantController.java` — `POST /api/v1/farms/{farmId}/assistant/interpret`.
- `assistant/dto/…` — `InterpretRequest`, `DraftResponse`, `ClarificationResponse`.
- Tests : `InterpretServiceTest` (Mock LLM), `AssistantControllerIT` (dry-run + RBAC).

**Mobile**
- `src/assistant/speech/useSpeechInput.ts` — **remplacer le fallback** par le STT natif FR (module dev-build), garder `supported`/repli texte.
- `src/assistant/parsers/` — ajouter des parseurs à règles simples pour daily/weighing/collection quand évident ; sinon fallback LLM.
- `src/assistant/llm/interpretParser.ts` — `IntentParser` **async** qui appelle `/assistant/interpret` (via `assistantApi`).
- `src/store/api/assistantApi.ts` — endpoint `interpret`.
- `src/assistant/types.ts` — étendre `AssistantIntent` (union 4 actions) + `intentRegistry` (chaque action → son endpoint offline).
- `src/assistant/useAssistant.ts` — rendre le pipeline **async** (règles → si null & online → LLM), gérer les clarifications renvoyées par le backend.
- `AssistantSheet` — état d'écoute réel + « en réflexion… » pendant l'appel LLM.

**Docs**
- Ce plan (**cocher**). `docs/12` §13 : marquer les décisions comme tranchées.

---

## Task 1: Mobile — STT natif FR (le vrai micro)
**Files:** `src/assistant/speech/useSpeechInput.ts` (+ config plugin app.json)
- [ ] Intégrer un module STT natif (FR), micro in-app : `start/stop/listening/transcript/supported`.
- [ ] Permissions micro propres ; **repli texte** si `!supported`. Dev build requis (déjà en place).
- [ ] `AssistantSheet` : bouton micro déclenche l'écoute réelle ; transcription en direct.

## Task 2: Mobile — modèle multi-actions (types + registre + brouillons)
**Files:** `src/assistant/types.ts`, `intentRegistry.ts`, `useAssistant.ts`
- [ ] `AssistantIntent` = union `MORTALITY | DAILY_RECORD | WEIGHING | EGG_COLLECTION` (champs par action).
- [ ] `intentRegistry.toMutation` couvre les 4 (endpoints + kinds offline existants).
- [ ] Constructeurs de `ConfirmationDraft` par action (résumé + phrase TTS), calcul offline.
- [ ] Tests unitaires du registre/brouillons.

## Task 3: Mobile — parseurs à règles complémentaires (offline)
**Files:** `src/assistant/parsers/*`
- [ ] Règles simples pour les cas évidents (« saisie journalière : 10 morts, 25 kg d'aliment » ; « pesée 1850, 1920 » ; « collecte 30 œufs matin ») quand extractibles sans LLM.
- [ ] Tests. Ce qui n'est pas couvert → fallback LLM (Task 6).

## Task 4: Backend — bounded context `assistant` + `MockLlmClient`
**Files:** `assistant/llm/*`, `assistant/tools/ActionTools.java`, `assistant/service/InterpretService.java`, `assistant/controller/AssistantController.java`, DTOs
- [ ] `LlmClient` interface + `MockLlmClient` (tool-calls déterministes par mots-clés) pour dev/test.
- [ ] `ActionTools` : schéma d'outil par action (champs + types).
- [ ] `InterpretService` : LLM → tool-call → **dry-run** via façades (unité existe, effectif, stock…) → `DraftResponse` (action, champs, résumé) ou `ClarificationResponse`.
- [ ] `AssistantController` `POST /assistant/interpret`, gété **accès ferme** ; `@features` du module concerné.
- [ ] Tests : `InterpretServiceTest` (mock), `AssistantControllerIT` (dry-run + RBAC + module gating).

## Task 5: Mobile — brancher l'interprétation backend (hybride)
**Files:** `src/store/api/assistantApi.ts`, `src/assistant/llm/interpretParser.ts`, `useAssistant.ts`
- [ ] `assistantApi.interpret({farmId, text, unitId?})`.
- [ ] `useAssistant` async : règles d'abord ; si `null` **et** en ligne → `interpret` → brouillon/clarification ; hors ligne → message « connexion requise pour cette phrase ».
- [ ] `AssistantSheet` : état « en réflexion… », gestion clarification renvoyée par le backend.
- [ ] Validation `tsc` + `npm test`.

## Task 6: Backend — `AnthropicLlmClient` réel (dernier, clé requise)
**Files:** `assistant/llm/AnthropicLlmClient.java`, config secrets
- [ ] Impl HTTP Anthropic (function-calling), timeouts, dégradation propre (échec LLM → clarification générique, jamais de crash).
- [ ] Clé via `avicare.assistant.anthropic.api-key` (env/secret ; **jamais commitée**). Profil `test`/dev = `MockLlmClient`.
- [ ] Journaliser coût/latence (métriques doc 12 §12). Ne pas logger le contenu sensible.

## Definition of Done (Phase 2)
- Un ouvrier **parle** (vrai micro in-app FR) et enregistre **mortalité / journalier / pesée / collecte** par la voix → carte lue à voix haute → **un tap** → file offline.
- Cas simples traités **on-device offline** (règles) ; cas complexes/ambigus → **LLM cloud** en ligne, derrière le backend, **avec dry-run déterministe** avant toute confirmation.
- Argent/santé : confirmation humaine obligatoire. RBAC & file offline inchangés.
- `tsc`/`npm test` verts ; ITs backend verts (Mock LLM en CI) ; essai device consigné.

## Prérequis côté produit
- **Clé API LLM** (Anthropic) pour Task 6 — le reste (Tasks 1–5) se code/teste avec le `MockLlmClient`.
- Choix du **module STT natif** confirmé à la Task 1 (impact dev build/config).
- Politique **confidentialité** : validée (seul le texte sort, pas l'audio ; contexte minimal).
