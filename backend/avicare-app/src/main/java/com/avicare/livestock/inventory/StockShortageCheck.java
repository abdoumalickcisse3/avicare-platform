package com.avicare.livestock.inventory;

/**
 * Faut-il refuser cette sortie si le stock ne la couvre pas (ADR-018) ?
 *
 * <p>Le choix appartient à l'<b>appelant</b>, et c'est tout l'intérêt de ce type. Faire dépendre
 * l'exclusion du {@code MovementReason} serait une porte dérobée : le motif vient de la requête,
 * l'écran de mouvement manuel propose « Vente » dans sa liste de sorties, et il suffirait de la
 * cocher pour passer outre. Ici, seul du code serveur peut demander la levée.
 */
public enum StockShortageCheck {

  /** Le cas normal : une sortie à découvert est refusée en 422 {@code STOCK_INSUFFICIENT}. */
  ENFORCED,

  /**
   * Réservé à la vente et à la livraison. Refuser une consommation force la saisie de l'entrée
   * manquante et la donnée s'améliore ; refuser une vente déjà encaissée empêche d'enregistrer de
   * l'argent reçu, et la donnée se perd — l'éleveur passera outre sans rien saisir. Le
   * sur-engagement, lui, est gardé en amont par la décision 27.
   */
  SKIPPED_FOR_SALE
}
