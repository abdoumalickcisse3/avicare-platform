package com.avicare.admin.repository;

import com.avicare.admin.domain.RequestTrace;
import jakarta.persistence.criteria.Predicate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.domain.Specification;

/**
 * The console's search criteria, turned into a query that only mentions the ones actually given.
 *
 * <p>This exists instead of a single JPQL query full of {@code (:x IS NULL OR column = :x)} guards.
 * That shape looks tidy and does not survive contact with PostgreSQL: Hibernate emits a separate
 * bind marker for every occurrence of a named parameter, so the {@code ? IS NULL} half carries no
 * type of its own, and the server rejects the whole statement — {@code function lower(bytea) does
 * not exist} for a null text criterion, {@code could not determine data type of parameter} for a
 * null timestamp. Building the predicate list means an unused criterion contributes nothing at all:
 * no bind parameter, no type to infer, nothing to get wrong.
 *
 * @param errorsOnly keep only the responses a support session cares about (status ≥ 400)
 */
public record RequestTraceSearch(
    String requestId,
    String email,
    Long farmId,
    String path,
    Integer status,
    boolean errorsOnly,
    LocalDateTime from,
    LocalDateTime to) {

  public Specification<RequestTrace> toSpecification() {
    return (root, query, cb) -> {
      List<Predicate> predicates = new ArrayList<>();
      if (notBlank(requestId)) {
        predicates.add(cb.equal(root.get("requestId"), requestId.trim()));
      }
      if (notBlank(email)) {
        predicates.add(cb.like(cb.lower(root.get("userEmail")), contains(email.toLowerCase())));
      }
      if (farmId != null) {
        predicates.add(cb.equal(root.get("farmId"), farmId));
      }
      if (notBlank(path)) {
        predicates.add(cb.like(root.get("path"), contains(path)));
      }
      if (status != null) {
        predicates.add(cb.equal(root.get("statusCode"), status));
      }
      if (errorsOnly) {
        predicates.add(cb.greaterThanOrEqualTo(root.<Integer>get("statusCode"), 400));
      }
      if (from != null) {
        predicates.add(cb.greaterThanOrEqualTo(root.<LocalDateTime>get("startedAt"), from));
      }
      if (to != null) {
        predicates.add(cb.lessThanOrEqualTo(root.<LocalDateTime>get("startedAt"), to));
      }
      return cb.and(predicates.toArray(Predicate[]::new));
    };
  }

  private static boolean notBlank(String value) {
    return value != null && !value.isBlank();
  }

  private static String contains(String value) {
    return "%" + value.trim() + "%";
  }
}
