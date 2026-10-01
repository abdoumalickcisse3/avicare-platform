# Notifications push sur le téléphone — conception

Date : 2026-10-01. Statut : approuvée par le propriétaire du produit (« oui je suis d'accord »).

## Problème

Une alerte (stock bas, mortalité anormale, vaccin en retard…) n'atteint l'éleveur que s'il ouvre
l'application (cloche, relevée toutes les 60 s) ou s'il consulte WhatsApp. Il n'existe aucune
notification au niveau du système d'exploitation : pas de jeton d'appareil, pas de stockage côté
backend, pas d'envoi.

## Décisions

- **Un canal de plus**, `PUSH`, à côté de `IN_APP` et `WHATSAPP`. La cloche reste la source de
  vérité ; le push n'est qu'un signal pour aller la regarder.
- **Expo Push Service**, pas FCM/APNs en direct : l'application est Expo (SDK 57), le jeton
  `ExponentPushToken[...]` est obtenu côté client et Expo relaie vers APNs. Aucune clé de service
  à gérer côté backend (jeton d'accès Expo optionnel).
- **iOS seulement** pour cette livraison (le pilote est sur iPhone/TestFlight). Le modèle stocke la
  plateforme, Android viendra sans migration.
- **Pas de push web** : exception explicite à la règle « web ⇒ mobile ». Le web n'a pas de colonne
  « Push » dans les réglages (les cellules `PUSH` renvoyées par l'API sont ignorées).
- **Seuils par défaut** : un cran sous WhatsApp, parce que le push ne coûte rien. Catégories de
  terrain (mortalité, observation critique, stock négatif/bas, fin de délai d'attente, vaccin en
  retard) : dès `INFO`. Catégories de bureau (bon de commande, facture, crédit) : dès `WARNING`.
  L'utilisateur peut tout surcharger ou couper, comme pour WhatsApp.
- **Au mieux, après validation de la transaction** : le scan matérialise les notifications dans une
  transaction. L'envoi est enregistré en `afterCommit` — une transaction annulée n'envoie rien, et
  un envoi qui échoue ne fait jamais échouer le scan. Pas d'outbox de reprise : si Expo ne répond
  pas, la cloche contient quand même l'alerte et WhatsApp prend le relais pour le critique.
- **Jetons morts** : un jeton qu'Expo déclare `DeviceNotRegistered` est révoqué (`revoked_at`) et
  n'est plus utilisé. Limite connue : Expo ne signale souvent l'appareil désinstallé que dans les
  *reçus* (relevés ~15 min après) ; on ne les relève pas dans cette livraison — un jeton mort coûte
  un envoi perdu, rien de plus.
- **Période de calme respectée** : le hook est au même endroit que `outboxEnqueuer.enqueueFor`, donc
  une condition qui revient dans les 6 h ne sonne pas une seconde fois.

## Backend

- Migration `V61__push_devices.sql` : table `push_devices` (`user_id`, `token` unique, `platform`,
  `last_seen_at`, `revoked_at`) ; la contrainte `CHECK` de `notification_preferences.channel`
  accepte `PUSH`.
- `POST /api/v1/push-devices` `{token, platform}` : enregistre ou rattache le jeton à
  l'utilisateur courant (upsert sur le jeton : un téléphone passé à un autre compte change de
  propriétaire, et réactive un jeton révoqué). `POST /api/v1/push-devices/revoke` `{token}` : le
  révoque s'il appartient à l'utilisateur (déconnexion). Authentifié, sans ferme.
- `PushNotifier` (port) / `PushNotifierImpl` : membres de la ferme → préférence `PUSH` → appareils
  actifs → `ExpoPushClient.send`. Désactivé par `notifications.push.enabled` (faux par défaut, vrai
  en prod, comme WhatsApp).
- Contenu : titre = titre de la notification, corps = nom de la ferme + détail ; `data` =
  `{notificationId, farmId, sourceRef}` pour que le téléphone route comme l'écran des notifications.

## Mobile (PR suivante)

`expo-notifications` ; permission demandée après connexion ; jeton enregistré une fois la ferme
choisie ; révoqué à la déconnexion ; au premier plan la bannière s'affiche ; un toucher ouvre
l'écran concerné ; colonne « Push » dans Réglages → Notifications.

## Hors périmètre

Android, web, reçus Expo, outbox de reprise, sons/canaux personnalisés, badge d'icône.

## Pré-requis hors code

Clé APNs dans EAS (`eas credentials`, compte Apple de l'équipe WXZLFJCJ5L), nouveau build
TestFlight, appareil réel. Le backend doit être déployé avant le test.
