# ADR 017 — Rejouer une écriture hors-ligne sans la dupliquer (`Idempotency-Key`)

**Date** : 2026-10-01
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Le mobile met les écritures en file quand le réseau manque, puis les rejoue (doc 08). Si la
connexion tombe **après** que le serveur a écrit mais **avant** que la réponse arrive, le téléphone
ne peut pas le savoir et rejoue : un ajustement de stock, une dépense ou un client serait créé deux
fois. Seules la mortalité et la pesée avaient une défense (`client_ref`, V30), propre à chacune.

## Décision

Un mécanisme générique côté serveur, plutôt qu'une colonne `client_ref` par table :

- le mobile envoie l'identifiant de l'entrée de file (déjà un UUID) dans l'en-tête `Idempotency-Key` ;
- `IdempotencyFilter` (POST/PUT/PATCH/DELETE avec l'en-tête, juste après Spring Security) réserve la
  clé `(utilisateur, clé)` dans `idempotency_keys` (V62), exécute la requête, et mémorise la réponse ;
  un rejeu reçoit la première réponse (`Idempotency-Replayed: true`) sans réexécution ;
- une réponse 5xx ou une exception libère la clé : l'échec ne dit pas si l'écriture a eu lieu, le
  rejeu doit vraiment s'exécuter ; les 4xx sont mémorisées ;
- deuxième requête pendant que la première tourne : 503 + `Retry-After` (le mobile le rejoue) ;
  une réservation sans réponse depuis plus de 60 s est reprise (requête morte) ;
- même clé sur une autre route : 422 `IDEMPOTENCY_KEY_REUSED` ;
- purge quotidienne des lignes de plus de 7 jours.

Les endpoints qui ont déjà `client_ref` (mortalité, pesée) gardent leur défense propre : les deux
couches ne se gênent pas.

## Conséquences

- Les écrans en ligne (web, mobile) n'envoient pas l'en-tête : aucun changement pour eux.
- Le web pourra adopter l'en-tête plus tard (double-clic, onglet qui rejoue) sans toucher au serveur.
- Une table de plus et une écriture SQL par requête rejouable ; négligeable à l'échelle du pilote.
