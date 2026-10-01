# ADR 015 — Notifications push via Expo Push Service

**Date** : 2026-10-01
**Statut** : Accepté
**Auteur** : Abdou Malick Cisse

## Contexte

Une alerte (mortalité anormale, stock bas, vaccin en retard…) n'atteignait l'éleveur que s'il
ouvrait l'application ou consultait WhatsApp : aucune notification au niveau du système
d'exploitation. Le pilote est sur iPhone (TestFlight). Conception détaillée :
`docs/superpowers/specs/2026-10-01-push-notifications-design.md` (PR #370 backend, #371 mobile).

## Décision

1. **Expo Push Service**, pas FCM/APNs en direct. L'application mobile est Expo (SDK 57) : le
   jeton `ExponentPushToken[...]` s'obtient côté client et Expo relaie vers APNs. Le backend n'a
   aucune clé de service à gérer ; seul le jeton d'accès Expo est optionnel.
2. **Un canal de plus**, `PUSH`, à côté de `IN_APP` et `WHATSAPP`. La cloche reste la source de
   vérité ; le push est un signal pour aller la regarder. Pas d'outbox de reprise : si Expo ne
   répond pas, la cloche contient l'alerte et WhatsApp prend le relais pour le critique.
3. **iOS d'abord**, Android sans migration (la plateforme est stockée avec le jeton).
4. **Pas de push web** — exception explicite à la règle « tout ce qui part sur le web part aussi sur
   le mobile », ici dans l'autre sens : le web ne reçoit pas de push.
5. **Interrupteur** `notifications.push.enabled` : faux par défaut (aucun envoi vers l'extérieur en
   local), vrai dans `application-prod.yml`. `NOTIF_PUSH_ENABLED` n'est **volontairement pas**
   défini dans le compose ni dans `.env.prod.example` : une variable vide ou à `false` couperait le
   canal en silence, comme cela est arrivé à WhatsApp.

## Conséquences

- Dépendance à un tiers (Expo) pour la livraison ; acceptable car la cloche et WhatsApp restent.
- **Côté APNs** : la clé d'authentification Apple doit être déclarée dans le compte EAS
  (`eas credentials`) pour que les pushs atteignent un vrai iPhone. Sans elle, le backend envoie,
  Expo accepte, et rien n'arrive. Cette étape n'est pas dans le code.
- Un jeton d'appareil désinstallé n'est signalé par Expo que dans les *reçus* (non relevés pour
  l'instant) : un jeton mort coûte un envoi perdu, rien de plus.
- Si le volume ou le besoin de Android justifie un jour FCM/APNs en direct, le port `PushNotifier`
  et le client `ExpoPushClient` isolent le changement.
