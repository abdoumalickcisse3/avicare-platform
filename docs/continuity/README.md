# 🩺 Plan de continuité opérationnelle

> **Le point unique de défaillance de cette plateforme, c'est une personne.** Pas le VPS, pas
> Postgres, pas Konekt. Une ferme qui paie 25 000 F/mois attend que ça marche même si Malick est à
> l'hôpital.

Ce dossier ne contient pas de solution technique à ça — il n'y en a pas. Il contient ce qui permet à
quelqu'un d'autre de tenir la plateforme quelques jours sans casser ce qu'il ne comprend pas.

## Les trois pièces

| Pièce | État | Qui la porte |
|---|---|---|
| **Alerte de silence** — prévient le contact de secours si Malick n'est pas vu depuis 72 h | ✅ livré (P6) | automatique |
| **[Accès d'urgence](emergency-access.md)** — qui appeler, à quoi il ou elle a accès | ⚠️ **contact identifié, compte et briefing à faire** | Malick |
| **[Runbook : propriétaire indisponible](../runbooks/recovery/proprietaire-indisponible.md)** — quoi faire, dans l'ordre | ✅ livré | le contact de secours |

## Comment fonctionne l'alerte de silence

Toutes les heures, la plateforme regarde la dernière trace d'activité de Malick dans le journal
d'audit — **une connexion, une action console, n'importe quoi**. Passé 72 h de silence, elle envoie
un WhatsApp au contact de secours, puis se tait 24 h avant de le redire.

Ce qu'elle **ne fait pas** : conclure quoi que ce soit. Trois jours sans se connecter, c'est peut-être
des vacances. Le message demande de prendre des nouvelles, pas de déclencher une procédure.

Réglages (`infra/.env`, aucun redéploiement de code nécessaire) :

```bash
ADMIN_EMERGENCY_PHONE=221XXXXXXXXX   # vide = l'alerte est journalisée et n'atteint personne
CONTINUITY_SILENCE_HOURS=72
CONTINUITY_ENABLED=true
```

Le démarrage de l'application **dit dans les logs** si le numéro manque. C'est volontaire : un
dispositif de secours silencieusement inactif est pire que pas de dispositif.

## Ce qui reste à faire, et que le code ne peut pas faire

1. ~~**Choisir la personne.**~~ ✅ Fait : un confrère développeur, qui a **accepté** le 2026-09-01.
   Son nom reste à inscrire dans [emergency-access.md](emergency-access.md).
2. **Lui montrer ce qu'il recevra.** Il a accepté le principe ; il n'a pas encore lu le message que
   la plateforme lui enverra. Une alerte de silence découverte un soir, sans contexte, inquiète pour
   rien — ou pire, se fait ignorer.
3. **Lui donner les accès** (voir [emergency-access.md](emergency-access.md)) et **vérifier qu'elle
   se connecte une fois**, tranquillement, avant d'en avoir besoin.
4. **Convenir d'une contrepartie**, même informelle. Un service qu'on n'a pas nommé est un service
   qu'on n'ose pas demander.
5. **Faire l'exercice une fois** : elle ouvre la console, coupe un module en préventif, le remet.
   Vingt minutes qui valent tout le reste de ce dossier.

## La clé de signature Android — à sauvegarder une fois

Depuis le 2026-10-29, l'application Android est distribuée en APK (`mobile-v1.0.0`). EAS a généré
sa **clé de signature** et la détient. C'est le seul élément de ce dossier dont la perte est
**irréversible** :

> Android n'installe une mise à jour par-dessus une application existante que si les deux sont
> signées par la **même** clé. Perdue ou régénérée, chaque éleveur devra désinstaller pour
> réinstaller — et une désinstallation efface la base locale **et la file de synchronisation
> hors-ligne** de l'ouvrier. Autrement dit : les saisies faites au poulailler et pas encore parties
> sont perdues, pour tout le monde, le même jour.

**À faire une fois**, cinq minutes, depuis `mobile/` :

```bash
eas credentials -p android     # Keystore → Download / Export
```

Ranger le fichier et son mot de passe dans le gestionnaire de mots de passe — **pas dans le
dépôt**, même privé. La commande est interactive : elle ne peut pas être faite à votre place.

**Vérifier que c'est bien la bonne clé.** Un export qui réussit en rapportant une *autre* clé ne
protège rien, et ne se voit pas : on l'apprend à la première mise à jour refusée, des mois plus
tard, quand il est trop tard. L'APK publié le 2026-10-29 est signé par ce certificat — lu dans son
bloc de signature, pas supposé :

| | |
|---|---|
| Empreinte SHA-256 | `A6:82:23:0D:DC:27:57:ED:B6:47:4A:CA:C1:DF:23:6B:1F:3A:27:F8:72:52:72:AD:E3:56:2E:F6:1B:D2:31:7A` |
| Numéro de série | `69E929B12959BE7B` |
| Émis le | 2026-10-29 15:04:33 UTC, valide jusqu'au 2054-03-16 |

Après l'export, comparer :

```bash
keytool -list -v -keystore <fichier-exporté>.jks | grep -i sha256
```

Les deux empreintes doivent être **identiques**. Si elles diffèrent, la clé qui signe les APK
installés chez les éleveurs est encore ailleurs, et rien n'est sauvegardé.

Un détail qui fait perdre une demi-heure : `keytool -printcert -jarfile <apk>` ne sort **rien** sur
cet APK, et ce n'est pas un défaut. EAS ne pose pas de signature v1 (JAR), seulement le schéma v2,
que `keytool` ne sait pas lire. L'empreinte ci-dessus vient du bloc v2 lui-même, recoupée avec
`openssl x509 -fingerprint -sha256`.

Tant que ce n'est pas fait, la seule copie vit chez EAS, et le compte EAS devient un point de
défaillance unique de plus.

## Pourquoi aucune table dédiée

La roadmap prévoyait une table `owner_heartbeat`. Le battement de cœur existait déjà : chaque
connexion et chaque action du personnel est écrite dans `admin_audit_log` avec son auteur et son
horodatage. Une table de plus aurait été une donnée à garder synchrone d'une autre — c'est-à-dire une
donnée à voir diverger. Le signal dérivé est aussi plus riche : quelqu'un qui travaille dans la
console avec une session déjà ouverte est manifestement présent, et un compteur limité aux connexions
aurait crié au loup un mardi chargé.
