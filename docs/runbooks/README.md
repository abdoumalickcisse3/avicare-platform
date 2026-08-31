# 🧯 Runbooks opérationnels

> À quoi ça sert : qu'une panne se résolve en moins de 30 minutes **par quelqu'un d'autre que
> l'auteur du code** — un futur toi qui a oublié, ou la personne d'astreinte pendant ton absence.

## Comment s'en servir

1. **Pars du symptôme**, pas de la cause. Les runbooks sont rangés par ce que le client rapporte.
2. **Suis les étapes dans l'ordre.** Elles vont du diagnostic le moins coûteux au plus coûteux.
3. **Ne saute pas le diagnostic.** La moitié des incidents ne sont pas ce qu'ils semblent être.
4. **Après l'incident, mets le runbook à jour.** Un runbook qui ne bouge jamais est un runbook que
   personne n'utilise.

## Ce qui existe

| Symptôme rapporté | Runbook | Sévérité |
|---|---|---|
| « Je n'arrive plus à me connecter », « accès refusé » | [Un éleveur est bloqué](incidents/eleveur-bloque-connexion.md) | HIGH |
| « J'ai eu une erreur ce matin », « ça n'a pas marché » | [Retrouver la requête d'un client](incidents/client-erreur-a-retrouver.md) | MEDIUM |
| « Mon stock ne correspond pas », anomalie CRITICAL | [Stock ou solde incohérent](incidents/donnee-incoherente.md) | HIGH |
| Pas de sauvegarde récente | [Sauvegarde manquée](ops/sauvegarde-manquee.md) | HIGH |
| Base corrompue, données perdues | [Restaurer une sauvegarde](ops/restaurer-une-sauvegarde.md) | CRITICAL |

Les autres scénarios du plan (WhatsApp, assistant IA, DDoS, fuite de données, panne totale) sont
volontairement **différés après le premier client** : un runbook écrit pour un incident qu'on n'a
jamais vu décrit surtout l'imagination de son auteur.

## Ce que les runbooks ne remplacent pas

- **`infra/DEPLOY.md`** : déploiement, rollback (`./deploy.sh <sha>`), sauvegardes, provisionnement.
  Les runbooks y renvoient, ils ne le recopient pas — deux vérités divergent toujours.
- **`docs/decisions/`** : le *pourquoi* du comportement de la plateforme.

## Convention

Chaque runbook porte une ligne **« Vérifié »** disant quand ses étapes ont été exécutées et **dans
quel environnement**. Un runbook rejoué en local n'est pas un runbook rejoué en production, et
prétendre le contraire est pire que ne rien écrire — c'est une confiance qu'on n'a pas gagnée.

Modèle : voir n'importe lequel des cinq. Symptômes → Diagnostic → Résolution → Après.
