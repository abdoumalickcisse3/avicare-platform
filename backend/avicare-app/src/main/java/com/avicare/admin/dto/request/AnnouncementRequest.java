package com.avicare.admin.dto.request;

import com.avicare.notification.domain.NotificationSeverity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

/** Create or edit a platform announcement. */
public record AnnouncementRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 4000) String body,
    NotificationSeverity severity,
    LocalDateTime startsAt,
    LocalDateTime endsAt,
    boolean published) {}
