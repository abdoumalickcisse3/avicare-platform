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
| **[Accès d'urgence](emergency-access.md)** — qui appeler, à quoi il ou elle a accès | ⚠️ **modèle à compléter** | Malick |
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

1. **Choisir la personne.** Quelqu'un qui sait lire une procédure et rester calme. Ni forcément
   développeur, ni forcément proche — mais joignable.
2. **Lui parler avant.** Une personne qui découvre son rôle le jour de l'incident n'est pas un plan
   de continuité, c'est une surprise.
3. **Lui donner les accès** (voir [emergency-access.md](emergency-access.md)) et **vérifier qu'elle
   se connecte une fois**, tranquillement, avant d'en avoir besoin.
4. **Convenir d'une contrepartie**, même informelle. Un service qu'on n'a pas nommé est un service
   qu'on n'ose pas demander.
5. **Faire l'exercice une fois** : elle ouvre la console, coupe un module en préventif, le remet.
   Vingt minutes qui valent tout le reste de ce dossier.

## Pourquoi aucune table dédiée

La roadmap prévoyait une table `owner_heartbeat`. Le battement de cœur existait déjà : chaque
connexion et chaque action du personnel est écrite dans `admin_audit_log` avec son auteur et son
horodatage. Une table de plus aurait été une donnée à garder synchrone d'une autre — c'est-à-dire une
donnée à voir diverger. Le signal dérivé est aussi plus riche : quelqu'un qui travaille dans la
console avec une session déjà ouverte est manifestement présent, et un compteur limité aux connexions
aurait crié au loup un mardi chargé.
