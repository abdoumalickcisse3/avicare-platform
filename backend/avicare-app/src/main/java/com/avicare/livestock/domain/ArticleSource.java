package com.avicare.livestock.domain;

/**
 * Where a stock item's article definition lives (Sprint B4-1). {@code INVENTORY} keys resolve
 * against the platform catalog category {@code inventory_items} (V15); {@code TREATMENT} keys
 * resolve against the health catalog category {@code treatments} (V12) — medications are
 * referenced, not duplicated. {@code PRODUCTION} identifies a farm production unit (broiler batch
 * or egg-tray pool) sold directly (Décision D27, V24).
 */
public enum ArticleSource {
  INVENTORY,
  TREATMENT,
  PRODUCTION
}
