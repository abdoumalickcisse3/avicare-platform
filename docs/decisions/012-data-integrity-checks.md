# ADR 012 — Contrôles d'intégrité et moteur de recalcul (chantier P2)

**Date** : 2026-08-31
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

La cascade D18 et les workflows commande → livraison → facture → paiement finiront par produire des
incohérences. Sans détection automatique, on les découvre par un client furieux. Mais un détecteur
qui crie au loup est pire que pas de détecteur : il apprend à ignorer l'écran.

Cf. `docs/roadmap-pre-first-client.md` §P2.

## Décisions

1. **Chaque invariant est dérivé de son écrivain, jamais recopié du plan.** Le brouillon de la
   roadmap contenait quatre formules fausses, vérifiées contre le schéma réel :

   | Formule du plan | Réalité | Effet si on l'avait gardée |
   |---|---|---|
   | `stock = SUM(mouvements signés)` | `quantity > 0` toujours, `ADJUSTMENT` porte une **cible absolue** | Toute ferme ayant fait un inventaire physique signalée |
   | `SUM(paiements)` | `payments.status` peut valoir `CANCELLED` | Faux positif à chaque annulation |
   | `solde = Σfactures − Σpaiements` | Annuler une facture ne rembourse que le **reste dû** | −400 F là où 0 est juste |
   | `effectif = initial − mortalité` | Le ledger `lifecycle_events` contient déjà un `CREATED` de `+initial` | **24 lots sur 24** signalés à tort |

   La dernière n'a été trouvée qu'en exécutant les contrôles sur des données réelles : la formule
   « initial + ledger » comptait l'effectif initial deux fois. C'est le ledger seul qui est vrai, et
   il colle à 100 % des lots.

2. **Contexte racine `com.avicare.integrity`, lecture en SQL natif.** 26 entités portent
   `@SQLRestriction` : une lecture par l'ORM hériterait des filtres qui masquent précisément les
   lignes cassées. Le SQL natif évite aussi d'épaissir six façades — ce qui casserait les slices
   `@DataJpaTest` (piège connu). Le `NamedParameterJdbcTemplate` est injecté en `ObjectProvider`,
   comme `AdminMetricsService` : les contextes de test sans `DataSource` doivent continuer à démarrer.

3. **Les orphelines du plan n'existent pas.** `deliveries.order_id` et `payments.invoice_id` sont
   NOT NULL derrière une FK : la base refuse déjà l'orphelin. Le créneau est remplacé par un contrôle
   qui, lui, peut se déclencher : **la cohérence de `farm_id` entre enfant et parent** — la forme
   qu'aurait un défaut d'isolation multi-tenant, et que rien d'autre n'attraperait.

4. **Fenêtre de grâce de 15 minutes.** Le balayage tourne à 3h, mais une ferme peut écrire à cet
   instant. Tout ce qui a été touché récemment est hors périmètre. Vérifié malgré moi en conditions
   réelles : une tentative de corruption manuelle n'a pas été détectée parce que le trigger
   `updated_at` avait rafraîchi la ligne — la fenêtre a fait exactement son travail.

5. **Une ligne par anomalie, close quand elle disparaît.** Index unique partiel sur
   `(check_key, entity_type, entity_id) WHERE resolved_at IS NULL` : le balayage suivant met à jour
   `last_seen_at` au lieu d'empiler. Une anomalie redevenue saine se clôt en `auto_resolved`.

6. **Ce que `apply` a le droit de réécrire : les agrégats dérivés, rien d'autre.** Quantité de stock,
   montant payé d'une facture, encours client. Jamais une valeur saisie par un humain — un total de
   commande qui diverge de ses lignes est une conversation avec le client, pas un bouton. La console
   n'affiche l'action que lorsque le recalcul est légitime, et l'API refuse le reste en 422.

7. **Dry-run d'abord, raison écrite ensuite, audit toujours.** Les trois manières de clore une
   anomalie (recalcul, correction manuelle, écart accepté) exigent une phrase. Dans six mois, la
   différence entre un défaut corrigé et un défaut assumé est la note que quelqu'un a laissée.

8. **Alerte CRITICAL une seule fois** (`notified_at`), par le rail WhatsApp de P3. Une nuit calme
   n'envoie rien : le silence doit continuer à vouloir dire « rien ne cloche ».

9. **Un contrôle qui plante n'arrête pas les autres.** Une requête cassée est un bug du détecteur,
   pas une raison de sauter les invariants qui fonctionnent ; le compteur `failed` le dit.

## Conséquences

- Sur les données de production actuelles : **0 CRITICAL, 0 WARNING**, 38 INFO authentiques
  (22 lots sans saisie depuis un mois, 16 saisies sanitaires à dose nulle laissées passer par le
  formulaire). Le premier client n'héritera pas d'un écran qui hurle.
- `IntegrityFindingRepository` est un nouveau repo JPA : `@MockitoBean` obligatoire dans les six
  contextes DB-less.
- Deux permissions distinctes : `integrity:read` (voir) et `integrity:recompute` (réécrire).
- Rien ne force le contrôle et le recalcul à partager la même formule : c'est `IntegrityFlowIT` qui
  l'impose, en enchaînant détection → recalcul → nouvelle détection sur la même ligne cassée.

## Alternatives écartées

- **Réparation automatique sans humain** : la moitié des écarts ne sont pas des erreurs
  d'arithmétique, et une correction silencieuse rendrait le diagnostic impossible.
- **Lecture par les repositories JPA** : filtres soft-delete, et six cross-imports.
- **Table d'historique des recalculs** : `admin_audit_log` la contient déjà.
