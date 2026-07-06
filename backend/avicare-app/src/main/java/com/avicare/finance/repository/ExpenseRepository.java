package com.avicare.finance.repository;

import com.avicare.finance.domain.Expense;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Repository for {@link Expense} entities. */
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

  /**
   * Finds all expenses for a farm, ordered by date descending.
   *
   * @param farmId the farm id
   * @return list of expenses ordered by date descending
   */
  List<Expense> findByFarmIdOrderByExpenseDateDesc(Long farmId);

  /**
   * Searches for expenses within a farm, optionally filtered by date range, category, and
   * production unit.
   *
   * @param farmId the farm id
   * @param from optional start date (inclusive)
   * @param to optional end date (inclusive)
   * @param categoryKey optional category key
   * @param unitId optional production unit id
   * @return list of matching expenses ordered by date descending, then by id descending
   */
  @Query(
      "SELECT e FROM Expense e WHERE e.farmId = :farmId "
          + "AND (:from IS NULL OR e.expenseDate >= :from) "
          + "AND (:to IS NULL OR e.expenseDate <= :to) "
          + "AND (:categoryKey IS NULL OR e.categoryKey = :categoryKey) "
          + "AND (:unitId IS NULL OR e.productionUnitId = :unitId) "
          + "ORDER BY e.expenseDate DESC, e.id DESC")
  List<Expense> search(
      @Param("farmId") Long farmId,
      @Param("from") LocalDate from,
      @Param("to") LocalDate to,
      @Param("categoryKey") String categoryKey,
      @Param("unitId") Long unitId);

  /**
   * Sums expenses by category over a date range for a farm (Expenses page analytics).
   *
   * @param farmId the farm id
   * @param from optional start date (inclusive)
   * @param to optional end date (inclusive)
   * @return list of [categoryKey, sum] pairs
   */
  @Query(
      "SELECT e.categoryKey, SUM(e.amountXof) FROM Expense e "
          + "WHERE e.farmId = :farmId "
          + "AND (:from IS NULL OR e.expenseDate >= :from) "
          + "AND (:to IS NULL OR e.expenseDate <= :to) GROUP BY e.categoryKey")
  List<Object[]> sumByCategory(
      @Param("farmId") Long farmId, @Param("from") LocalDate from, @Param("to") LocalDate to);

  /**
   * Dépense liée à une visite vétérinaire donnée (idempotence de l'auto-dépense).
   *
   * @param farmId the farm id
   * @param vetVisitId the vet visit id
   * @return the expense for the given vet visit, or empty if none exists
   */
  Optional<Expense> findByFarmIdAndVetVisitId(Long farmId, Long vetVisitId);
}
