package com.avicare.notification.api;

import java.time.LocalDateTime;

/** One announcement as any surface renders it. */
public record AnnouncementView(
    Long id,
    String title,
    String body,
    String severity,
    LocalDateTime startsAt,
    LocalDateTime endsAt,
    boolean published) {}
