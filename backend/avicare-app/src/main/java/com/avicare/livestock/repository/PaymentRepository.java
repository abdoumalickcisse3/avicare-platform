package com.avicare.livestock.repository;

import com.avicare.livestock.domain.Payment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

  List<Payment> findByFarmIdOrderByPaymentDateDescIdDesc(Long farmId);

  List<Payment> findByFarmIdOrderByPaymentDateDescIdDesc(Long farmId, Pageable pageable);

  List<Payment> findByFarmIdAndInvoiceIdOrderById(Long farmId, Long invoiceId);

  Optional<Payment> findByFarmIdAndId(Long farmId, Long id);

  /**
   * Highest sequence used by a farm for a given {@code P-YYYY-} prefix (0 when none), so the
   * service can mint the next {@code P-YYYY-NNN} (D24). Native — parses the trailing digits.
   */
  @Query(
      value =
          "SELECT COALESCE(MAX(CAST(SUBSTRING(payment_number FROM '[0-9]+$') AS INTEGER)), 0) "
              + "FROM payments WHERE farm_id = :farmId AND payment_number LIKE :prefix",
      nativeQuery = true)
  int findMaxSequence(@Param("farmId") Long farmId, @Param("prefix") String prefix);
}
