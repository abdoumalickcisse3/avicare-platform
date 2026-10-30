package com.avicare.integrity.check;

import com.avicare.integrity.domain.Severity;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * A stock quantity must never be below zero.
 *
 * <p>Nothing used to notice. {@link StockQuantityCheck} compares the quantity to its <i>last
 * movement</i>, so a journal that itself ends negative is perfectly coherent and passes — and its
 * {@code JOIN LATERAL} drops any item with no movement at all, which is exactly the shape a
 * cascade-deleted row leaves behind. The pilot farm carried −105 kg of layer feed for twenty-eight
 * nights, through twenty-eight sweeps, in silence. The three lines were found by hand.
 *
 * <p>ADR-018 (PR #457) closed the main door: a consumption that would go below zero is refused.
 * This is the net underneath it, because the guard has deliberate exclusions — {@code IN}, {@code
 * ADJUSTMENT}, a sale debiting its own stock — it can be switched off per farm, and the offline
 * mobile queue still replays writes decided on a stale cache.
 *
 * <p>CRITICAL on purpose: a negative stock is not a rounding dispute. It means the feed the farmer
 * is counting on is already miscounted, and the consumption index built on it is wrong.
 */
@Component
public class NegativeStockCheck extends SqlIntegrityCheck {

  public NegativeStockCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbc) {
    super(jdbc);
  }

  @Override
  public String key() {
    return "stock_negative";
  }

  @Override
  public String label() {
    return "Stock négatif";
  }

  @Override
  public Severity severity() {
    return Severity.CRITICAL;
  }

  /**
   * Never recomputable. The platform cannot invent what is physically in the store, and the obvious
   * mechanical answer is a trap: recomputing puts back the last movement's figure, which is the
   * negative one. The repair is a movement recorded with the farmer — their stock, their count.
   */
  @Override
  public boolean recomputable() {
    return false;
  }

  @Override
  protected String entityType() {
    return "stock_item";
  }

  @Override
  protected String sql() {
    // movements : zéro est un diagnostic à lui seul — une quantité qui a bougé sans laisser de
    // ligne au journal est la signature d'un mouvement supprimé en cascade (défaut corrigé par la
    // PR #454), pas d'une saisie de travers. Le dire ici économise la requête que l'astreinte
    // écrirait à la main.
    return """
        SELECT si.id      AS entity_id,
               si.farm_id AS farm_id,
               '0'        AS expected,
               trim_scale(si.current_quantity)::text AS actual,
               si.article_key,
               si.unit,
               si.last_movement_at,
               (SELECT count(*) FROM stock_movements sm WHERE sm.stock_item_id = si.id) AS movements
          FROM stock_items si
         WHERE si.updated_at < :cutoff
           AND si.current_quantity < 0
        """;
  }

  @Override
  protected Map<String, Object> details(ResultSet rs) throws SQLException {
    Map<String, Object> details = new HashMap<>();
    details.put("articleKey", rs.getString("article_key"));
    details.put("unit", rs.getString("unit"));
    details.put("movements", rs.getLong("movements"));
    details.put("lastMovementAt", String.valueOf(rs.getObject("last_movement_at")));
    return details;
  }
}
