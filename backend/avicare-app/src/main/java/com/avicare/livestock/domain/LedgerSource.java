package com.avicare.livestock.domain;

/** Qui a écrit la ligne — le système, ou l'éleveur. */
public enum LedgerSource {
  /** Dérivée d'un bon d'achat reçu. Non supprimable : elle se corrige en corrigeant le bon. */
  PURCHASE_ORDER,
  /** Saisie par l'éleveur — un paiement, ou une livraison prise sans bon d'achat. */
  MANUAL
}
