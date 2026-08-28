# Design — Assistant IA du partenaire

> Statut : **design, non développé** (2026-08-28).
> Étend `docs/12-assistant-ia-strategie.md` à une audience qui n'était pas prévue : le partenaire.

---

## 1. Pourquoi

L'assistant existe et sert l'éleveur : chat conversationnel (`/assistant/chat`), 12 outils de
lecture, 11 outils d'écriture en dry-run, quotas, audit, mémoire de conversation. Le partenaire,
lui, n'a rien.

Or c'est l'audience pour laquelle un LLM rend le plus : un provendier avec quarante fermes ne
lira jamais quarante lignes de tableau, mais il posera *« lesquelles vont recommander cette
semaine ? »*. La valeur d'un réseau croît avec sa taille, la lisibilité d'un tableau décroît — le
langage naturel est ce qui réconcilie les deux.

## 2. L'obstacle réel

L'assistant éleveur n'est pas réutilisable tel quel. Son contrat de lecture est :

```java
String read(Long farmId, Map<String, Object> args, Long contextUnitId);
String requiredPermission();   // ex. "poultry:read"
```

Deux hypothèses y sont câblées, et aucune ne tient pour un partenaire :

- **une ferme unique** — un partenaire raisonne sur un portefeuille ;
- **une permission de membre** — un partenaire n'est membre d'aucune ferme ; son droit vient des
  **curseurs de partage** que chaque éleveur a consentis, ferme par ferme.

La transposition est donc structurelle. Ce qui se réutilise sans modification : `LlmClient`,
`AnthropicLlmClient`, la boucle agentique, `AssistantQuotaService`, `AssistantAuditService`,
`AssistantMemory`.

## 3. Décisions

| # | Sujet | Choix |
|---|---|---|
| 1 | Surface | `POST /api/v1/partner/assistant/chat`, `partnerId` issu du token, jamais du chemin |
| 2 | Outils | **Un registre distinct** `PartnerReadTool`, gardé par scope et non par permission |
| 3 | Écriture | **Aucune, en v1** — l'assistant partenaire est en lecture seule (cf. §5) |
| 4 | Spécialisation | Prompt système et outils offerts **selon le type** (provendier ≠ vétérinaire) |
| 5 | Quota | Compteur propre au `partner_user`, séparé de celui des éleveurs |
| 6 | Audit | Chaque question tracée, avec les fermes consultées (cf. §6) |

## 4. Le contrat des outils

```java
public interface PartnerReadTool {
  ToolSpec spec();
  /** Le scope de partage requis : activity, flock_health, feed_consumption, sales_volume,
   *  finances, restock_forecast. Null = ne dépend d'aucune donnée d'exploitation. */
  String requiredScope();
  /** Exécute sur le réseau du partenaire. L'implémentation N'ITÈRE QUE sur les fermes qui
   *  partagent `requiredScope()` — le masquage vit ici, jamais dans le prompt. */
  String read(Long partnerId, Map<String, Object> args);
}
```

**Le point qui compte : le masquage est dans le code de l'outil, pas dans les instructions données
au modèle.** Un prompt qui dirait « ne parle pas des fermes qui ne partagent pas X » est une prière,
pas un contrôle. Un outil qui ne lit que les fermes consentantes est une garantie — le modèle ne
peut pas divulguer ce qu'on ne lui a jamais donné.

C'est la même frontière que `PartnerNetworkReadService` et `PartnerRestockForecastService`, et les
outils doivent s'appuyer sur ces services plutôt que de la réimplémenter.

## 5. Pourquoi aucune écriture en v1

L'assistant éleveur écrit (en dry-run + confirmation humaine) parce que l'éleveur agit sur **ses
propres** données. Un partenaire agirait sur celles d'un tiers.

Quand le portail deviendra transactionnel (confirmer une commande, écrire à un éleveur), la
question se rouvrira — avec le même patron dry-run + confirmation, et un scope de consentement
dédié. Pas avant. Un assistant qui peut envoyer un WhatsApp à quarante éleveurs sur une phrase mal
comprise est un incident, pas une fonctionnalité.

## 6. Audit, et une idée qui va plus loin

Chaque question est tracée : partenaire, utilisateur, texte, outils appelés, **fermes consultées**.

Cela ouvre une possibilité que je recommande de viser : **rendre ce journal visible à l'éleveur**.
« Provende du Sahel a consulté vos données de consommation le 12 mars. » Aucune plateforme du
secteur ne le fait, et c'est le prolongement exact de l'invariant de confiance déjà posé — l'éleveur
est propriétaire de ses données, il choisit ce qu'il partage ; qu'il voie aussi **quand on regarde**
est la suite logique.

À traiter dans son propre cycle, mais à concevoir dès maintenant dans le schéma d'audit.

## 7. Outils par type de partenaire

### Provendier (FEED_SUPPLIER)

| Outil | Scope requis | S'appuie sur |
|---|---|---|
| `NETWORK_SUMMARY` | activity | `PartnerNetworkReadService.dashboard` |
| `FARMS_AT_RISK` | activity | `riskLevel` (couche « Garder ») |
| `RESTOCK_FORECAST` | restock_forecast | `PartnerRestockForecastService` |
| `FEED_CONSUMPTION_BY_FARM` | feed_consumption | `LivestockFacade.livestockStats` |
| `FCR_BENCHMARK` | flock_health + feed_consumption | `growth_performance` — l'argument commercial |
| `FARM_DETAIL` | selon les curseurs | read model existant |

### Vétérinaire (VET)

| Outil | Scope requis | S'appuie sur |
|---|---|---|
| `NETWORK_SUMMARY` | activity | idem |
| `HEALTH_ALERTS` | flock_health | détecteurs C1 + `partner_alerts` |
| `VACCINATION_DUE` | flock_health | `vaccination_program_lots` |
| `MORTALITY_TREND` | flock_health | `LivestockStats.mortalitySeries` |
| `FARM_DETAIL` | selon les curseurs | read model existant |

Un outil dont **aucune ferme du réseau ne partage le scope** ne doit pas être offert au modèle :
inutile de lui donner un outil qui ne peut que répondre « rien ». Le registre filtre à la
construction de la requête.

## 8. Prompt système

Dérivé de `Prompts.java`, mais réécrit pour l'audience. Trois différences :

- **Le rôle** : conseiller commercial ou technique d'un portefeuille, pas d'une exploitation.
- **L'honnêteté sur les trous** : le modèle doit dire *« trois de vos fermes ne partagent pas leur
  consommation »* plutôt que de calculer une moyenne silencieusement biaisée. Une donnée absente
  par consentement doit être **nommée**, pas contournée.
- **Aucune identification indirecte** : sur un réseau de deux fermes, une « moyenne » désigne
  quelqu'un. En dessous d'un seuil (à fixer, 3 ou 5), les agrégats renvoient les fermes nommées ou
  rien — pas une moyenne faussement anonyme.

Le point sur les seuils vaut aussi pour le portail lui-même (§9).

## 9. Ce que ce design révèle sur l'existant

Le portail affiche déjà `avgMortalityRate` sur un réseau **d'une seule ferme** — donc une donnée
nominative présentée comme un agrégat. Sans conséquence aujourd'hui (le partenaire voit de toute
façon la ligne détaillée, avec le même consentement), mais le raisonnement « agrégat = anonyme »
est faux à petite échelle et mérite d'être tranché une fois pour les deux surfaces.

## 10. Hors périmètre

- Assistant vocal partenaire (le STT est un besoin de terrain, pas de bureau).
- Écriture / actions (cf. §5).
- Journal de consultation visible par l'éleveur (§6) — à concevoir, à livrer plus tard.

## 11. Prérequis

Ce chantier vient **après la console d'administration** (décision du 2026-08-28) : un assistant
partenaire ne sert à rien tant que créer un partenaire se fait au curl.
