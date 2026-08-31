# Stock, solde ou effectif incohérent

**Sévérité** : HIGH — un chiffre sur lequel l'éleveur compte est faux.
**Temps de résolution** : < 10 min quand la valeur est recalculable.
**Vérifié** : 2026-08-31, en local — incohérence injectée, détectée, simulée puis corrigée.

## Symptômes

- Le client dit : « mon stock d'aliment n'est pas le bon », « ce client ne me doit pas ça ».
- **Ou** : une anomalie CRITICAL apparaît dans Console → Intégrité, et l'astreinte reçoit un
  WhatsApp. Le plus souvent tu le sauras **avant** le client — c'est tout l'intérêt.

## Diagnostic

Console → **Intégrité** (`/console/integrite`). Les anomalies les plus graves sont en haut.

Sortie réelle du test :

```
compteurs : CRITICAL=1 WARNING=0 INFO=38
anomalie #141 : Quantité en stock différente du dernier mouvement
attendu 1250, réel 9999 | recalculable: true
```

**Lis « attendu » et « réel » avant tout.** « Attendu » est reconstruit depuis les enregistrements
source (le dernier mouvement de stock, les paiements encaissés, le journal du lot) ; « réel » est ce
que la plateforme affiche au client aujourd'hui.

Si rien n'apparaît alors que le client insiste, lance un balayage : bouton **« Lancer maintenant »**.
Le contrôle nocturne ignore ce qui a été écrit dans les 15 dernières minutes — une ferme en pleine
saisie n'est pas une anomalie.

## Résolution

### Cas nominal — la valeur est recalculable

Trois valeurs seulement peuvent être réécrites par la plateforme : **quantité de stock**, **montant
payé d'une facture**, **encours client**. Ce sont des agrégats qu'elle calcule elle-même.

1. **« Recalculer »** → une **simulation** s'affiche d'abord. Rien n'est écrit à ce stade.
   ```
   simulation : 9999 -> 1250 (-8749) | écrit: false
   ```
2. Vérifie que la valeur cible est plausible. Si elle ne l'est pas, **arrête-toi** : le contrôle a
   peut-être raison sur l'écart et tort sur la cause.
3. Écris une **raison** (obligatoire — un recalcul sans raison est refusé en 400) et confirme.
   ```
   appliqué : 9999 -> 1250
   ```

### Cas non recalculable

Un total de commande qui diverge de ses lignes, un effectif de lot, un état de workflow : la
plateforme **n'a pas le droit** de réécrire une valeur saisie par un humain (422
`RECOMPUTE_NOT_SUPPORTED`). Deux issues :

- **Corrige dans l'application** avec le client (c'est sa donnée, c'est sa décision), puis marque
  l'anomalie **« Corrigé »** avec la raison ;
- **ou** assume l'écart : **« Accepter »** avec une raison. Elle ne réapparaîtra plus.

### Si l'anomalie revient chaque nuit

Ce n'est plus une donnée à corriger, c'est un **bug qui la recrée**. Retrouve l'écriture fautive dans
Console → Traces (filtre sur la ferme), et envisage de **couper le module** le temps du correctif.

## Après

- Toute action est journalisée (`integrity.recomputed`, `.accepted_drift`, `.manual_fix`) avec ton
  nom et ta raison. Dans six mois, c'est cette phrase qui dira si l'écart était corrigé ou assumé.
- Une anomalie qui redevient saine se **ferme d'elle-même** au balayage suivant (`auto_resolved`).

## Références

- Endpoints : `GET /api/v1/admin/integrity`, `POST .../findings/{id}/recompute|accept|manual-fix`
- Tables : `integrity_findings`, plus les tables source
- Décision : `docs/decisions/012-data-integrity-checks.md`
