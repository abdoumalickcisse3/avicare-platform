package com.avicare.notification.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.notification.api.AnnouncementView;
import com.avicare.notification.domain.Announcement;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.repository.AnnouncementRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Platform announcements: authored by staff, read by everyone.
 *
 * <p>The active window is computed in the query rather than filtered in Java, so an announcement
 * ends on its own. Nothing has to remember to take it down — which is the failure mode of every
 * banner system that only has an on/off switch.
 */
@Service
@RequiredArgsConstructor
public class AnnouncementService {

  private final AnnouncementRepository announcements;

  /** What a signed-in user should see right now. */
  @Transactional(readOnly = true)
  public List<AnnouncementView> active() {
    return announcements.findActive(LocalDateTime.now()).stream()
        .map(AnnouncementService::toView)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<AnnouncementView> all() {
    return announcements.findAllByOrderByStartsAtDesc().stream()
        .map(AnnouncementService::toView)
        .toList();
  }

  @Transactional
  public AnnouncementView create(
      String title,
      String body,
      NotificationSeverity severity,
      LocalDateTime startsAt,
      LocalDateTime endsAt,
      boolean published,
      Long authorId) {
    Announcement a = new Announcement();
    a.setCreatedBy(authorId);
    return toView(apply(a, title, body, severity, startsAt, endsAt, published));
  }

  @Transactional
  public AnnouncementView update(
      Long id,
      String title,
      String body,
      NotificationSeverity severity,
      LocalDateTime startsAt,
      LocalDateTime endsAt,
      boolean published) {
    Announcement a =
        announcements
            .findById(id)
            .orElseThrow(
                () -> new NotFoundException("ANNOUNCEMENT_NOT_FOUND", "Announcement " + id));
    return toView(apply(a, title, body, severity, startsAt, endsAt, published));
  }

  private Announcement apply(
      Announcement a,
      String title,
      String body,
      NotificationSeverity severity,
      LocalDateTime startsAt,
      LocalDateTime endsAt,
      boolean published) {
    if (endsAt != null && startsAt != null && !endsAt.isAfter(startsAt)) {
      // Otherwise the announcement is published and invisible, which reads as a bug from both ends.
      throw new ValidationException(
          "ANNOUNCEMENT_WINDOW_INVALID", "La fin doit être postérieure au début.");
    }
    a.setTitle(title);
    a.setBody(body);
    a.setSeverity(severity == null ? NotificationSeverity.INFO : severity);
    if (startsAt != null) {
      a.setStartsAt(startsAt);
    }
    a.setEndsAt(endsAt);
    a.setPublished(published);
    return announcements.save(a);
  }

  private static AnnouncementView toView(Announcement a) {
    return new AnnouncementView(
        a.getId(),
        a.getTitle(),
        a.getBody(),
        a.getSeverity().name(),
        a.getStartsAt(),
        a.getEndsAt(),
        a.isPublished());
  }
}
