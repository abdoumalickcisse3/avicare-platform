package com.avicare.livestock.repository;

import com.avicare.livestock.domain.InvoiceItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, Long> {

  List<InvoiceItem> findByInvoiceIdOrderById(Long invoiceId);
}
