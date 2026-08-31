# ADR 013 — Détection de menaces et limitation de débit (chantier P4)

**Date** : 2026-08-31
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Jusqu'ici : rien. Un script pouvait forcer un mot de passe indéfiniment, créer des comptes en série,
ou marteler les endpoints publics sans laisser de trace ni rencontrer de résistance. Avant un premier
client payant, c'est autant une question de réputation et de coût d'infra que de sécurité.

Cf. `docs/roadmap-pre-first-client.md` §P4.

## Décisions

1. **Compteurs de débit en mémoire, blocages en base.** La roadmap prévoyait `bucket4j-postgresql`
   (compteurs distribués). Il n'y a **qu'une seule instance backend** : un compteur distribué
   signifierait une écriture en base par requête pour se coordonner avec personne. Les seaux vivent
   donc en mémoire (`bucket4j_jdk17-core`, la variante Java 17+), et la carte est vidée toutes les
   heures — un seau se remplit tout seul, en oublier un pardonne au pire quelques requêtes. Les
   **blocages d'IP**, eux, sont en base : ils doivent survivre à un redémarrage, contrairement à une
   fenêtre glissante. Le jour où une seconde instance apparaît, c'est le magasin de seaux qu'on
   remplace, pas les règles.

2. **Limitation par adresse, pas par utilisateur.** Le filtre tourne **avant** l'authentification —
   délibérément, pour qu'un flot non authentifié ne coûte rien — donc il n'y a pas encore
   d'utilisateur sur qui compter. La protection par compte est le travail du détecteur de force
   brute, un cran plus bas : lui voit l'email qui a été tenté.

3. **Ordre des filtres** : corrélation (HIGHEST) → traces (+10) → **blocage d'IP (+20)** →
   **débit (+30)** → Spring Security. Une requête refusée est donc **tracée** et porte un
   `X-Correlation-Id` — « je n'arrive plus à me connecter » est un appel au support, et la réponse
   doit être retrouvable — mais elle n'atteint jamais le hachage du mot de passe ni la base.
   `/actuator` est exempté : une adresse bloquée ne doit pas pouvoir faire croire à notre propre
   monitoring que la plateforme est tombée.

4. **L'enregistrement tourne dans sa propre transaction** (`REQUIRES_NEW`). Découvert en conditions
   réelles : `recordFailedLogin` est appelé depuis `AuthService.login`, qui lève ensuite
   `UnauthorizedException` — l'événement rejoignait cette transaction et **était annulé avec elle**.
   Zéro échec enregistré, un détecteur qui compte jusqu'à zéro pour toujours. Même raisonnement que
   `AdminAuditService` : les tentatives qui valent la peine d'être retenues sont précisément celles
   qui se terminent mal.

5. **Les blocages sont toujours bornés.** Au Sénégal une ville entière peut partager un NAT
   d'opérateur : un blocage automatique définitif finirait par exclure un vrai éleveur sans que
   personne ne sache pourquoi. Une heure par défaut, une semaine au maximum même à la main. Le
   blocage achète du temps contre un script, ce n'est pas un verdict.

6. **Lecture cachée, défaillance en position ouverte.** `isBlocked` tourne à chaque requête : la
   réponse vient d'un instantané rafraîchi toutes les 30 s, et une table illisible vaut « non
   bloqué ». Comme pour le kill switch : une défense qui fait tomber la plateforme quand sa propre
   table hoquette est pire que l'attaque qu'elle prévient.

7. **Les événements de débit sont limités en mémoire à un par adresse et par minute.** Sous un vrai
   flot, une ligne (et une requête) par requête rejetée est la façon dont l'incident en devient deux.

8. **Le loopback est exempté**, des deux filtres et de l'enregistrement. Derrière Caddy, un vrai
   appelant n'est jamais en loopback — son adresse vient de `X-Forwarded-For` — donc une requête qui
   semble venir de la machine elle-même est un test, une sonde de santé, ou quelque chose qui a déjà
   la machine. Découvert de la pire façon : la première version a fait tomber **douze classes d'IT**,
   qui parlent toutes depuis `127.0.0.1`. Le même raisonnement vaut en production, où la plateforme
   n'a aucune raison de se bloquer elle-même.

9. **Plafond d'inscription à 10/h, pas 3/h.** La roadmap disait 3, mais une coopérative qui inscrit
   ses membres depuis un même bureau partage une adresse d'opérateur : refuser le quatrième serait la
   plateforme se mettant en travers de sa propre adoption. La rafale est toujours **remarquée** à
   trois par heure (le détecteur avertit) ; le filtre ne **refuse** que bien au-delà. Détecter et
   refuser ne sont pas le même geste.

10. **`security:read` et `security:manage` séparées.** Lire le journal et débloquer une adresse ne
   sont pas la même autorité — et débloquer est justement le geste qui remet en ligne un éleveur
   attrapé à tort.

11. **`ip_address` en `VARCHAR(45)`, pas `INET`.** C'est le type déjà utilisé par `admin_audit_log.ip`
   et `request_traces.ip` ; une seule représentation de l'IP dans le schéma vaut mieux que le typage
   plus fin d'une troisième table isolée, et évite un convertisseur JPA pour rien.

12. **Helper `ClientIp` extrait** (`common-api`). L'adresse réelle est le premier saut de
    `X-Forwarded-For` derrière Caddy ; trois endroits en avaient besoin et trois copies des mêmes
    quatre lignes est la façon dont elles commencent à diverger. Sa fiabilité repose sur une
    **invariante de déploiement** : Caddy réécrit l'en-tête et rien d'autre ne peut joindre le
    backend. Si le backend devenait directement joignable, l'en-tête serait falsifiable et le
    blocage d'IP perdrait tout sens.

## Conséquences

- Cinq échecs de connexion en 15 minutes depuis une adresse la bloquent une heure, avec alerte
  WhatsApp à l'astreinte et entrée d'audit — vérifié de bout en bout en conditions réelles.
- Deux nouveaux repos JPA (`SecurityEventRepository`, `BlockedIpRepository`) : `@MockitoBean`
  obligatoire dans les six contextes DB-less.
- Tout est désarmable depuis `.env` (`RATE_LIMIT_ENABLED`, `IP_BLOCKING_ENABLED`) si un réglage se
  révélait trop strict pour un vrai éleveur.

## Alternatives écartées

- **Bucket4j sur Postgres** (roadmap) : une écriture par requête pour coordonner une seule instance.
- **Bucket4j sur Redis** : Redis est déjà déployé mais inutilisé ; ajouter une dépendance runtime
  pour un problème qui n'existe pas encore aurait été de la complexité prise d'avance.
- **Limiter par utilisateur** : impossible avant l'authentification, et authentifier avant de limiter
  revient à hacher un mot de passe pour chaque tentative — exactement ce qu'un attaquant veut.
