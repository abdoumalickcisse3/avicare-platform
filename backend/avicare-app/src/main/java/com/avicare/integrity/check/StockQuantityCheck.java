package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A stock item's quantity must equal what its last movement left behind.
 *
 * <p>Deliberately <b>not</b> a signed sum of movements: {@code quantity} is constrained positive
 * and the direction lives in {@code movement_type}, where {@code ADJUSTMENT} carries an <i>absolute
 * target</i> rather than a delta. Summing would flag every farm that has ever done a physical
 * count. Each movement records {@code quantity_after}, so the last one is the arithmetic truth.
 */
@Component
public class StockQuantityCheck extends SqlIntegrityCheck {

  public StockQuantityCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "stock_current_quantity";
  }

  @Override
  public String label() {
    return "Quantité en stock différente du dernier mouvement";
  }

  @Override
  public Severity severity() {
    return Severity.CRITICAL;
  }

  @Override
  protected String entityType() {
    return "stock_item";
  }

  @Override
  protected String sql() {
    return """
        SELECT si.id            AS entity_id,
               si.farm_id       AS farm_id,
               -- trim_scale: la colonne est NUMERIC(14,3), et « 40.000 ≠ 100.000 » à l'écran est
               -- plus dur à lire que « 40 ≠ 100 ». Le moteur de recalcul normalise déjà de son
               -- côté ; les deux doivent afficher le même nombre de la même façon.
               trim_scale(last.quantity_after)::text AS expected,
               trim_scale(si.current_quantity)::text AS actual
          FROM stock_items si
          JOIN LATERAL (
                 SELECT sm.quantity_after
                   FROM stock_movements sm
                  WHERE sm.stock_item_id = si.id
                  ORDER BY sm.created_at DESC, sm.id DESC
                  LIMIT 1
               ) last ON TRUE
         WHERE si.updated_at < :cutoff
           AND si.current_quantity <> last.quantity_after
        """;
  }
}
