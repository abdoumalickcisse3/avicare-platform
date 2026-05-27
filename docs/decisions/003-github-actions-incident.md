# ADR 003 — Incident GitHub Actions du 26 mai 2026 & workflow de validation locale

**Date** : 2026-05-26
**Statut** : Résolu — Incident GitHub Actions terminé le 2026-05-27, workflows fonctionnels depuis PR #5 et PR #6
**Auteur** : Abdou Malick Cisse

## Contexte

Pendant le Sprint A2 Session 1 (implémentation `common-i18n`, PR #1), aucune CI ne se déclenche après 06:38 UTC, alors qu'auparavant les workflows tournaient sans souci :

- Pas de run sur le `push` de la branche `sprint-a2/common-i18n`
- Pas de run sur l'événement `pull_request` (PR #1 ouverte sur `main`)
- Pas de run après `gh pr close` + `gh pr reopen`
- `gh workflow run --ref ...` répond `HTTP 500`
- Pas de run après le merge de la PR (push event sur `main` également silencieux)

Diagnostic effectué côté repo :
- `gh api repos/.../actions/permissions` → `{"enabled":true,"allowed_actions":"all"}`
- Workflows listés `active` (Backend / Web / Mobile)
- YAML triggers rendus explicites (`branches: [main, develop]` + `types: [opened, synchronize, reopened]`) sans changer le comportement
- Derniers runs verts : commit `6829de8` à 06:38 UTC, juste avant l'incident

## Cause identifiée

Trois URLs vérifiées manuellement :

1. **https://www.githubstatus.com** — GitHub Actions en incident officiel (pastille rouge)
2. **https://github.com/settings/billing** — quota non épuisé (utilisation marginale)
3. **https://github.com/abdoumalickcisse3/avicare-platform/actions** — workflows en place, dernier run vert il y a ~5h juste avant le démarrage de l'incident

**Conclusion** : ce n'est ni un problème de quota, ni une limitation tier free, ni un bug dans nos workflows. C'est un **incident GitHub Actions officiel** côté infrastructure GitHub.

C'est une cause différente — et indépendante — de [`002-branch-protection-deferred.md`](002-branch-protection-deferred.md) (limitation tier free permanente). Cet incident-ci est ponctuel et externe.

## Décision adoptée

1. **Continuer Sprint A2** en s'appuyant sur la **validation locale stricte** plutôt que d'attendre la résolution de l'incident.
2. **Reprendre la routine PR + CI normale** dès que GitHub résout l'incident (status page revenue au vert).
3. **Workflow temporaire** : avant chaque merge sur `main`, exécuter localement la checklist `Local validation` documentée dans [`CONTRIBUTING.md`](../../CONTRIBUTING.md) (en résumé : `./mvnw clean verify` obligatoire + démarrage app + smoke `/actuator/health`).
4. **Surveiller https://www.githubstatus.com** une fois par jour, au début de chaque session.

## Conséquences

### Positives

- Sprint A2 non bloqué par une cause externe que nous ne contrôlons pas
- La discipline locale (build + tests + smoke) reste plus rigoureuse qu'une CI minimaliste
- Une fois Jacoco en place (cf. PR `chore/add-jacoco`), on aura une mesure objective de couverture en local

### Négatives

- Pas de garantie serveur que les builds passent — si la machine du dev casse silencieusement quelque chose, on le découvre seulement au merge suivant
- Pas de mesure de durée CI réelle (intéressant pour optimiser plus tard)
- Risque d'oubli de la checklist locale → un commit casse `main`

### Mitigations

- Lancer `./mvnw clean verify` **en début ET fin** de chaque sprint pour borner le risque
- Une fois l'incident résolu, re-pousser un commit vide (`git commit --allow-empty -m "ci: poke after GH Actions incident"`) pour reconfirmer que les workflows triggent à nouveau, et fermer cet ADR comme "résolu et workflow restauré"

## Résolution

**Date de résolution** : 2026-05-27.

**Validation** : 3 CI vertes consécutives sur deux PRs successives :

- PR #5 (`docs: add CLAUDE.md with mandatory context rules`) — Backend CI 56s, Web CI 46s, Mobile CI 24s
- PR #6 (`feat(common-api): RFC 7807 error handler + correlation ID filter`) — Backend build 1m16s, Web build 42s, lint-and-test 21s

**Actions appliquées dans la PR de clôture** :

- Retour au workflow normal "CI verte avant merge" (la branche feature s'attend à `gh pr checks <n>` tous verts avant `gh pr merge`)
- Renommage de la section "Local validation checklist (pendant l'incident GitHub Actions)" dans [`CONTRIBUTING.md`](../../CONTRIBUTING.md) en "Pre-PR local validation (recommandée)" — elle reste utile comme bon réflexe avant push, mais cesse d'être un gate de merge
- Ajout d'une section **Pitfalls connus** dans [`CONTRIBUTING.md`](../../CONTRIBUTING.md) documentant le piège M2 stale (cf. action items ci-dessous)
- Patch du `Makefile` : `make backend-run` exécute désormais `./mvnw install -DskipTests -pl avicare-app -am` en amont, ce qui pousse les JARs `common-*` frais vers `~/.m2` avant `spring-boot:run` et élimine le bug silencieux découvert en Session 2b

**En cas de récidive** : retomber sur la checklist locale comme gate temporaire (l'ADR reste lisible dans l'historique), ouvrir un ADR-004 si la cause diffère.

## Action items pour plus tard

- [ ] **Upgrade `actions/checkout@v4` → `v5`** dans les 3 workflows. `v4` génère un warning "Node.js 20 deprecated" qui finira par devenir bloquant.
- [ ] **Investiguer le warning** `"No files found with path backend/**/target/surefire-reports/"` dans `backend.yml` (upload des surefire reports). Soit on n'a pas de tests générant des reports, soit le path est faux. À regarder dans un prochain passage CI.
- [ ] **Évaluer un upgrade GitHub Pro** ($4/mois) si l'incident se reproduit régulièrement OU si on veut profiter d'avantages connexes (branch protection sans dépendre du status public/private — cf. ADR-002).
- [x] **Piège M2 stale documenté** : `make backend-run` résolvait `common-*` depuis `~/.m2` au lieu du reactor. Découvert en Session 2b (Filter @Component jamais instancié au runtime alors que les tests passaient). Fix appliqué dans la PR de clôture (Makefile + section Pitfalls dans CONTRIBUTING.md).

## Référence

- Status page GitHub : https://www.githubstatus.com (pastille rouge constatée le 2026-05-26)
- PR #1 (merge manuel sans CI) : https://github.com/abdoumalickcisse3/avicare-platform/pull/1
- ADR connexe : [`002-branch-protection-deferred.md`](002-branch-protection-deferred.md)
- Memory note (auto-memory Claude Code) : `github_actions_pr_silent.md`
