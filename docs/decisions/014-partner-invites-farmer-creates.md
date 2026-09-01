# ADR 014 — Le partenaire invite, l'éleveur crée son compte

**Date** : 2026-09-01
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

La thèse de monétisation primaire est le **canal B2B2C** (ADR-009) : un provendier, une coopérative
ou un vétérinaire porte Jawdi auprès des éleveurs qu'il sert déjà. Le partenaire est donc le canal
d'acquisition le moins cher d'un marché où l'éleveur individuel est difficile à atteindre et lent à
faire confiance à un logiciel.

D'où la question posée : **un partenaire doit-il pouvoir créer le compte d'un éleveur qui n'est pas
encore inscrit ?**

Elle se pose maintenant, alors qu'aucun partenaire n'est encore engagé commercialement (au
2026-08-31 : 3 organisations enregistrées, **1 seul compte actif**, 2 fermes rattachées). C'est le
bon moment : la règle est plus facile à tenir avant qu'un premier provendier ne demande une
exception.

### Ce que le code fait déjà

Tout le rattachement est **à l'initiative de l'éleveur**, et c'est cohérent de bout en bout :

| Endpoint | Qui agit |
|---|---|
| `GET /farms/{id}/partners/available` | l'éleveur parcourt les partenaires |
| `POST /farms/{id}/partners/declare` | l'éleveur déclare travailler avec X |
| `POST /farms/{id}/partners/join` | l'éleveur rejoint via un code d'invitation |
| `PUT /farms/{id}/partners/{membershipId}/scopes` | l'éleveur change ce qu'il partage |

Le partage lui-même est granulaire et révocable : `partner_farm_memberships` porte six
consentements (activité, santé du cheptel, consommation d'aliment, volume de ventes, finances,
prévision de recommande), un `confirmed_at` et un `left_at`.

Le partenaire, lui, ne peut que **générer un code** et voir qui l'a utilisé.

## Décision

**Un partenaire ne crée jamais le compte d'un éleveur. Il l'invite ; l'éleveur crée.**

L'invitation doit en revanche être rendue triviale, faute de quoi la règle se paie en acquisition :

1. Le partenaire génère une invitation depuis son portail (le mécanisme de code existe).
2. Elle part par **WhatsApp**, sur le rail Konekt déjà en place.
3. Le lien ouvre une inscription **pré-remplie** avec le nom que le partenaire a saisi.
4. L'éleveur choisit **son** mot de passe et coche **lui-même** ses partages.

Le commercial peut être assis à côté de lui, et même taper à sa place. Ce qui compte est que le lien
arrive sur **le téléphone de l'éleveur** et que ce soit **son doigt** qui accepte.

Deux règles complémentaires :

- **Le partenaire voit qui a rejoint, jamais qui a refusé.** Un refus ne le regarde pas, et le lui
  montrer transformerait l'invitation en moyen de pression sur une relation commerciale existante.
- **Une invitation non acceptée expire.** Sinon on accumule des liens qui ouvriront un accès dans six
  mois, quand plus personne ne se rappellera pourquoi ils ont été émis.

## Pourquoi

1. **Sinon les consentements ne veulent plus rien dire.** Les six scopes sont la frontière de
   confiance de tout le B2B2C. Si le partenaire crée le compte, c'est lui qui coche les cases :
   l'éleveur n'a rien accordé, et on lui montrera plus tard un écran prétendant qu'il a choisi. Le
   mécanisme resterait, sa légitimité disparaîtrait.

2. **Sinon on fabrique une captivité.** Le jour où l'éleveur change de provendier — et il changera —
   à qui appartient sa ferme dans Jawdi ? C'est le piège classique du B2B2C : l'utilisateur final
   devient l'otage de l'intermédiaire. Pour que l'éleveur devienne un jour client en propre, son
   compte doit être le sien dès la première seconde.

3. **Sinon on détruit le seul signal utile.** Des comptes créés pour quelqu'un sont des comptes que
   personne n'ouvre. On gonflerait le nombre de fermes en écrasant tous les taux d'usage — et très
   concrètement les contrôles d'intégrité (ADR-012) se mettraient à signaler des lots silencieux en
   masse. On perdrait la seule information qui répond à « ce canal fonctionne-t-il ? ».

4. **Sinon on joue la réputation sur un marché où tout le monde se connaît.** Un provendier
   consultant les finances d'un éleveur sur un compte que celui-ci n'a jamais ouvert n'est pas un
   incident technique : c'est l'histoire qui ferme le canal.

5. **Et ce serait la seule inversion du modèle.** Tout le reste du rattachement part de l'éleveur
   (tableau ci-dessus). Laisser le partenaire créer des comptes introduirait une exception au seul
   endroit où elle coûte le plus cher.

## L'objection, et ce qu'on en fait

Elle est réelle : un éleveur rural ne s'inscrit pas spontanément sur un SaaS, et attendre qu'il le
fasse revient à ne pas avoir de canal.

La réponse n'est pas de créer le compte à sa place, c'est de **réduire son premier geste à trois
touches**. On garde l'essentiel du bénéfice d'acquisition et la totalité de la légitimité.

C'est le même principe que le moteur de recalcul d'ADR-012 : *la plateforme reconstruit ce qu'elle a
dérivé, elle n'écrase jamais ce qu'un humain a déclaré.* Ici : le partenaire propose une relation, il
ne la déclare pas à la place de l'autre.

Le schéma l'encodait d'ailleurs déjà — `partner_farm_memberships.confirmed_at` dit « quelqu'un
propose, quelqu'un confirme ». Étendre ce patron à l'inscription prolonge une intention existante
plutôt que d'en inventer une.

## Conséquences

- L'invitation par WhatsApp avec inscription pré-remplie reste **à construire**. Rien n'est codé au
  titre de cet ADR : la décision est prise avant la pression, pas avant le besoin.
- Le portail partenaire devra afficher les invitations émises et acceptées — **jamais** les refus.
- Les codes d'invitation devront porter une expiration effective.
- Si un futur partenaire pose l'embarquement direct comme condition, c'est une **renégociation
  commerciale**, pas un ajustement technique : cet ADR dit pourquoi le prix en est élevé.

## Alternatives écartées

- **Le partenaire crée le compte** (embarquement direct) : traité ci-dessus. Le gain d'acquisition
  est réel, le coût en confiance et en lisibilité des métriques l'est davantage.
- **Ne rien faire et attendre que les éleveurs s'inscrivent seuls** : c'est renoncer au canal.
  L'invitation pré-remplie existe précisément pour ne pas avoir à choisir entre les deux.
- **Un compte « provisoire » créé par le partenaire, à confirmer par l'éleveur** : même inversion,
  avec en prime des comptes fantômes en attente et un état de plus à gérer. Un lien non cliqué qui
  expire est plus simple qu'un compte à demi né.
