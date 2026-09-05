package com.avicare.livestock.domain;

/** Le sens d'une écriture du compte-courant fournisseur. */
public enum LedgerDirection {
  /** Ce que la ferme doit : une livraison prise. */
  DEBIT,
  /** Ce que la ferme a versé. */
  CREDIT
}
