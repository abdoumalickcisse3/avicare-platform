# ADR 002 — Branch protection différée (free + private)

**Date** : 2026-05-25
**Statut** : Accepté (temporaire)
**Auteur** : Abdou Malick Cisse

## Contexte

À la clôture du Sprint A1, on souhaitait protéger la branche `main` côté serveur :
- Interdiction de push direct (forcer le passage par PR)
- Statuts CI obligatoires verts avant merge (`Backend build`, `Web build`, `lint-and-test`)
- Mode strict (branche à jour avec `main` avant merge)
- Pas de force-push, pas de delete
- Résolution de toutes les conversations PR avant merge

Deux endpoints GitHub permettent cela :
- `PUT /repos/{owner}/{repo}/branches/{branch}/protection` (legacy branch protection)
- `POST /repos/{owner}/{repo}/rulesets` (rulesets, mécanisme moderne)

**Les deux retournent HTTP 403** sur ce repo :

```
{
  "message": "Upgrade to GitHub Pro or make this repository public to enable this feature.",
  "status": "403"
}
```

Cause : le repo est privé et le compte GitHub (`abdoumalickcisse3`) est en plan **free**. Sur ce tier, GitHub réserve la protection de branche (classique ET rulesets) aux repos publics ou aux comptes payants (Pro / Team / Enterprise).

## Décision

Différer la mise en place de la branch protection. Sprint A1 se clôture **sans garde-fou serveur sur `main`**.

La discipline repose pendant ce temps sur :
- Le solo dev (auteur unique du repo)
- Les CI GitHub Actions qui restent obligatoires en pratique (on attend leur résultat avant merge manuel)
- La présente ADR comme rappel de la dette technique à résorber

## Conséquences

### Positives

- Aucun blocage de la clôture Sprint A1
- Pas de coût ($4/mois GitHub Pro évité tant que la valeur n'est pas démontrée)
- Le code Avicare reste privé (IP, futurs secrets, business model protégés)

### Négatives

- Un `git push origin main` direct est possible techniquement (rien ne l'empêche côté serveur)
- Un `git push --force` sur `main` est possible (réécriture d'historique non bloquée)
- Si un autre contributeur rejoint plus tard, aucune garantie qu'il passe par un PR
- Le tag `v0.1.0-setup` lui-même peut être réécrit/supprimé

### Mitigations

- Discipline manuelle : passer systématiquement par un PR même en solo
- Optionnel : hook `pre-push` local pour refuser les push directs sur `main` (non installé pour l'instant — décision : ne pas s'embêter en solo)
- Le tag annoté `v0.1.0-setup` sert de point de référence stable même si `main` bouge

## Levée de la décision (à faire dès qu'une de ces conditions est remplie)

Quand l'une de ces conditions devient vraie, appliquer la branch protection planifiée :

1. **Upgrade GitHub Pro** ($4/mois) — solution la moins intrusive si le repo doit rester privé
2. **Passage du repo en public** — possible quand le projet est prêt à être ouvert (release V1, open source partiel, etc.)
3. **Migration vers une organisation GitHub Team** ($4/user/mois)

Commande à exécuter le moment venu (validée au Sprint A1 J7, prête à l'emploi) :

```bash
gh api -X PUT repos/abdoumalickcisse3/avicare-platform/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Backend build", "Web build", "lint-and-test"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Le `required_approving_review_count: 0` reste l'astuce solo dev (passage par PR forcé, mais auto-merge sans review autorisé). À réviser dès qu'un second contributeur rejoint.

## Alternatives écartées

- **Make repo public maintenant** : exposition prématurée du code et du business model AviCare. Décision business non justifiée en Sprint A1.
- **Upgrade Pro maintenant** : engagement $4/mois pour un seul bénéfice (branch protection) alors que le risque réel est très faible en solo dev. À reprendre dès qu'un second contributeur rejoint ou que le projet sort de la phase prototype.
- **Hook pre-push local strict** : protection illusoire (contournable depuis une autre machine sans le hook), complexifie le setup dev. Ne remplace pas une vraie règle serveur.

## Référence

- Tentative documentée dans le log de session Sprint A1 J7 (2026-05-25)
- GitHub docs : https://docs.github.com/rest/branches/branch-protection
- GitHub docs : https://docs.github.com/rest/repos/rules
