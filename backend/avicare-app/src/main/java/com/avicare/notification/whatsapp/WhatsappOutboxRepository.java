package com.avicare.notification.whatsapp;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for the WhatsApp outbox (Sprint C1 Phase 2). */
public interface WhatsappOutboxRepository extends JpaRepository<WhatsappOutbox, Long> {

  /** Oldest pending messages first, capped (dispatcher batch). */
  List<WhatsappOutbox> findTop50ByStatusOrderByCreatedAtAsc(OutboxStatus status);
}
