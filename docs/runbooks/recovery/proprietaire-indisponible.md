# Le propriétaire de la plateforme est injoignable

**Sévérité** : dépend de ce qui se passe en parallèle. Un silence sans incident n'est pas une urgence.
**Destinataire** : le contact de secours, pas Malick. Il ou elle est développeur — l'étape 4 en
tient compte.
**Vérifié** : 2026-08-31 — mécanisme d'alerte testé (8 cas). **L'exercice humain n'a pas été fait.**

## Comment tu arrives ici

Tu as reçu un WhatsApp du type :

> ⚠️ Jawdi — Malick n'a pas été vu sur la console depuis 74 h (dernière activité : 2026-08-28).
> Prends de ses nouvelles.

Ce message **ne dit pas** qu'il y a un problème sur la plateforme. Il dit qu'une personne n'a pas
donné signe depuis trois jours. Le plus souvent, ce sont des vacances.

## Étape 1 — Prendre de ses nouvelles (5 min)

WhatsApp, appel, puis le proche listé dans `docs/continuity/emergency-access.md`.

**S'il répond : tu as terminé.** L'alerte se taira d'elle-même dès qu'il se reconnectera.

## Étape 2 — Est-ce que quelque chose ne va pas ? (10 min)

Connecte-toi à `admin.jawdi.app` avec **ton** compte staff et regarde, dans cet ordre :

| Écran | Ce qui doit t'alerter |
|---|---|
| **Pilotage** | Sauvegarde de plus de 24 h · astreinte « absente » |
| **Intégrité** | Une anomalie **CRITICAL** ouverte |
| **Sécurité** | Intrusions, adresses bloquées en nombre |
| **Traces** | Filtre « erreurs seulement » : une rafale de 500 |

**Si tout est vert : ne fais rien.** Une plateforme qui tourne n'a pas besoin d'aide. Reprends
contact demain.

## Étape 3 — S'il y a un incident

Prends le runbook correspondant dans `docs/runbooks/` et suis-le. Ils sont rangés par symptôme.

Les trois gestes que tu as le droit de faire, par ordre de préférence :

1. **Débloquer un éleveur** (`/console/securite`) — sans risque, réversible.
2. **Prévenir les clients** (`/console/communication`) — dis la vérité : un incident technique est en
   cours, une personne s'en occupe, tu reviens vers eux. Un client informé attend ; un client dans le
   silence appelle la concurrence.
3. **Couper un module** (`/console/urgence`) — si quelque chose corrompt des données. La coupure se
   lève seule au bout de 30 minutes ; prolonge-la si besoin.

Couper un module **arrête cette fonctionnalité pour toutes les fermes**. C'est un geste fort, et
c'est parfois le bon : mieux vaut une fonctionnalité indisponible qu'une donnée fausse qu'on devra
démêler pendant des semaines.

## Étape 4 — Revenir à la version d'avant (si tu es développeur)

Une seule opération technique t'est ouverte, et c'est la plus sûre qui existe ici : **revenir à un
déploiement précédent**. Les images portent des tags immuables (le SHA du commit), donc redéployer
un ancien SHA remet exactement le code qui tournait avant.

```bash
ssh <user>@<vps>
cd /opt/avicare-platform/infra
git log --oneline -10          # repérer le dernier SHA connu comme bon
./deploy.sh <sha>
curl -s https://app.<domaine>/actuator/health
```

⚠️ **Un rollback ne défait pas une migration de base.** Flyway ne redescend pas : si la version
fautive a modifié le schéma, l'ancien code peut ne pas démarrer. Dans ce cas, arrête-toi et attends —
c'est exactement la situation où improviser coûte plus cher que la panne.

## Étape 5 — Ce que tu ne fais pas

- **Pas de code nouveau.** Corriger le bug est tentant, surtout quand on sait faire. Mais un
  correctif écrit sous pression dans un produit qu'on découvre est un second incident en préparation.
  Revenir en arrière, oui. Avancer, non.
- **Pas de recalcul de données** clients. Les règles métier (facturation, encours, effectifs) ont des
  subtilités qui ne se devinent pas — c'est le sujet de tout un chantier documenté dans
  `docs/decisions/012`.
- **Pas de modification de schéma.**
- **Pas de restauration de sauvegarde**, sauf si la base est manifestement détruite — et alors
  seulement en suivant [le runbook](../ops/restaurer-une-sauvegarde.md), après avoir pris une
  sauvegarde de l'état actuel.

## Étape 6 — Tenir un journal

Note **tout** ce que tu fais, avec l'heure. Un simple fichier texte suffit. À son retour, Malick doit
pouvoir reconstituer la séquence sans t'interroger.

La console garde déjà la trace de tes actions (journal d'audit), mais elle ne garde pas ton
raisonnement — et c'est lui qui compte.

## Quand ça s'arrête

Quand Malick se reconnecte. L'alerte cesse d'elle-même : elle regarde sa dernière activité, pas un
interrupteur qu'il faudrait penser à remettre.

## Références

- [Plan de continuité](../../continuity/README.md) · [Accès d'urgence](../../continuity/emergency-access.md)
- Tous les runbooks : `docs/runbooks/README.md`
