package com.avicare.notification.api;

import java.time.LocalDateTime;

/**
 * Public, read-only view of an active notification, exposed through {@link NotificationFacade} so a
 * future assistant read-tool can answer "what are today's alerts?" without touching the
 * notification entities (Sprint C1 — designed-for, not wired to the assistant yet).
 */
public record NotificationView(
    Long id,
    String category,
    String severity,
    String title,
    String body,
    LocalDateTime createdAt) {}
