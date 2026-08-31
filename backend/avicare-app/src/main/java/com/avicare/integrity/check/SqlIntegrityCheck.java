package com.avicare.integrity.check;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

/**
 * Base for a check expressed as one query returning the offending rows.
 *
 * <p>The contract of the query is fixed: {@code entity_id}, {@code farm_id}, {@code expected},
 * {@code actual}, and optionally {@code entity_type}. Everything else is per-check detail.
 *
 * <p>The template is injected optionally, the way {@code AdminMetricsService} takes its own: the
 * DB-less test contexts boot the web layer with no {@code DataSource}, and a check with no database
 * to read simply has nothing to report. Requiring it would make every one of those contexts fail on
 * a bean it has no use for.
 */
public abstract class SqlIntegrityCheck implements IntegrityCheck {

  private final ObjectProvider<NamedParameterJdbcTemplate> jdbcProvider;

  protected SqlIntegrityCheck(ObjectProvider<NamedParameterJdbcTemplate> jdbcProvider) {
    this.jdbcProvider = jdbcProvider;
  }

  /** The query, taking a single {@code :cutoff} parameter. */
  protected abstract String sql();

  /** Default entity type, when the query does not return one per row. */
  protected abstract String entityType();

  @Override
  public List<FindingCandidate> run(LocalDateTime graceCutoff) {
    NamedParameterJdbcTemplate jdbc = jdbcProvider.getIfAvailable();
    if (jdbc == null) {
      return List.of();
    }
    return jdbc.query(
        sql(),
        new MapSqlParameterSource("cutoff", graceCutoff),
        (rs, rowNum) -> {
          String type = hasColumn(rs, "entity_type") ? rs.getString("entity_type") : entityType();
          Long farmId = rs.getObject("farm_id") == null ? null : rs.getLong("farm_id");
          return new FindingCandidate(
              type,
              rs.getLong("entity_id"),
              farmId,
              rs.getString("expected"),
              rs.getString("actual"),
              details(rs));
        });
  }

  /** Per-check enrichment shown in the console drill-down. */
  protected Map<String, Object> details(java.sql.ResultSet rs) throws java.sql.SQLException {
    return Map.of();
  }

  private static boolean hasColumn(java.sql.ResultSet rs, String name)
      throws java.sql.SQLException {
    java.sql.ResultSetMetaData meta = rs.getMetaData();
    for (int i = 1; i <= meta.getColumnCount(); i++) {
      if (name.equalsIgnoreCase(meta.getColumnLabel(i))) {
        return true;
      }
    }
    return false;
  }
}
