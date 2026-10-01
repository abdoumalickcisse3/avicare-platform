package com.avicare.idempotency;

import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Storage for {@code Idempotency-Key} claims, over plain JDBC.
 *
 * <p>Every statement commits on its own, outside the request's transaction: the claim must be
 * visible to a concurrent replay immediately, and a request that rolls back must not drag the claim
 * with it (the filter releases or completes it explicitly).
 *
 * <p>{@link JdbcTemplate} is looked up lazily: the DB-less test contexts have none, and the filter
 * then simply does nothing.
 */
@Component
public class IdempotencyStore {

  private static final Logger log = LoggerFactory.getLogger(IdempotencyStore.class);

  /** A claim with no recorded response older than this is a request that died mid-flight. */
  static final int STALE_CLAIM_SECONDS = 60;

  private static final int RETENTION_DAYS = 7;

  /** What the store knows about a key. */
  public record Entry(
      String method, String path, Integer statusCode, String contentType, String responseBody) {
    public boolean completed() {
      return statusCode != null;
    }
  }

  private final ObjectProvider<JdbcTemplate> jdbc;

  public IdempotencyStore(ObjectProvider<JdbcTemplate> jdbc) {
    this.jdbc = jdbc;
  }

  public boolean available() {
    return jdbc.getIfAvailable() != null;
  }

  /** Try to become the one request that processes this key. */
  public boolean claim(Long userId, UUID key, String method, String path) {
    int inserted =
        jdbc.getObject()
            .update(
                "INSERT INTO idempotency_keys (user_id, idem_key, method, path) "
                    + "VALUES (?, ?, ?, ?) ON CONFLICT (user_id, idem_key) DO NOTHING",
                userId,
                key,
                method,
                path);
    return inserted == 1;
  }

  public Entry find(Long userId, UUID key) {
    List<Entry> rows =
        jdbc.getObject()
            .query(
                "SELECT method, path, status_code, content_type, response_body "
                    + "FROM idempotency_keys WHERE user_id = ? AND idem_key = ?",
                (rs, i) ->
                    new Entry(
                        rs.getString("method"),
                        rs.getString("path"),
                        (Integer) rs.getObject("status_code"),
                        rs.getString("content_type"),
                        rs.getString("response_body")),
                userId,
                key);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** Drop a claim that never got a response and is old enough to belong to a dead request. */
  public boolean evictStale(Long userId, UUID key) {
    return jdbc.getObject()
            .update(
                "DELETE FROM idempotency_keys WHERE user_id = ? AND idem_key = ? "
                    + "AND status_code IS NULL "
                    + "AND created_at < (NOW() AT TIME ZONE 'utc') - make_interval(secs => ?)",
                userId,
                key,
                STALE_CLAIM_SECONDS)
        == 1;
  }

  public void complete(Long userId, UUID key, int status, String contentType, String body) {
    jdbc.getObject()
        .update(
            "UPDATE idempotency_keys SET status_code = ?, content_type = ?, response_body = ?, "
                + "completed_at = (NOW() AT TIME ZONE 'utc') WHERE user_id = ? AND idem_key = ?",
            status,
            contentType,
            body,
            userId,
            key);
  }

  /** The request failed server-side: forget the claim so the client's retry runs for real. */
  public void release(Long userId, UUID key) {
    jdbc.getObject()
        .update(
            "DELETE FROM idempotency_keys WHERE user_id = ? AND idem_key = ? "
                + "AND status_code IS NULL",
            userId,
            key);
  }

  @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
  public void purgeOld() {
    if (!available()) {
      return;
    }
    int purged =
        jdbc.getObject()
            .update(
                "DELETE FROM idempotency_keys "
                    + "WHERE created_at < (NOW() AT TIME ZONE 'utc') - make_interval(days => ?)",
                RETENTION_DAYS);
    if (purged > 0) {
      log.info("Purged {} expired idempotency keys", purged);
    }
  }
}
