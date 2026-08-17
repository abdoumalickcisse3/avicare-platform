package com.avicare.notification.whatsapp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One queued WhatsApp message (Sprint C1 Phase 2), created per (notification, recipient) when a
 * recipient opted in for the WhatsApp channel. The dispatcher sends PENDING rows best-effort with
 * retry; timestamps DB-owned. {@code providerResponse} stores the Konekt reply as JSON.
 */
@Entity
@Table(name = "whatsapp_outbox")
@Getter
@Setter
@NoArgsConstructor
@ToString
public class WhatsappOutbox {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "notification_id", nullable = false)
  private Long notificationId;

  @Column(nullable = false)
  private String phone;

  @Column(nullable = false)
  private String message;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private OutboxStatus status = OutboxStatus.PENDING;

  @Column(nullable = false)
  private int attempts = 0;

  @Column(name = "last_error")
  private String lastError;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "provider_response")
  private Map<String, Object> providerResponse;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "sent_at")
  private LocalDateTime sentAt;
}
