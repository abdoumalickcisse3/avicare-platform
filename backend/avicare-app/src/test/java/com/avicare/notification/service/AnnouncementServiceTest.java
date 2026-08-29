package com.avicare.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.notification.api.AnnouncementView;
import com.avicare.notification.domain.Announcement;
import com.avicare.notification.domain.NotificationSeverity;
import com.avicare.notification.repository.AnnouncementRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AnnouncementServiceTest {

  @Mock AnnouncementRepository announcements;
  @InjectMocks AnnouncementService service;

  private void savesWhatItIsGiven() {
    when(announcements.save(any())).thenAnswer(inv -> inv.getArgument(0));
  }

  @Test
  void createsWithInfoWhenNoSeverityIsGiven() {
    savesWhatItIsGiven();

    AnnouncementView view =
        service.create("Maintenance", "Samedi 8h", null, LocalDateTime.now(), null, true, 1L);

    // A missing severity must not become a null column: the banner reads it to pick its colour.
    assertThat(view.severity()).isEqualTo("INFO");
  }

  @Test
  void refusesAWindowThatEndsBeforeItStarts() {
    LocalDateTime start = LocalDateTime.now();

    // Published and invisible reads as a bug from both ends — better refused at the source.
    assertThatThrownBy(
            () ->
                service.create(
                    "T", "B", NotificationSeverity.INFO, start, start.minusHours(1), true, 1L))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("postérieure");
    verify(announcements, never()).save(any());
  }

  @Test
  void refusesAWindowWithNoDuration() {
    LocalDateTime moment = LocalDateTime.now();

    assertThatThrownBy(
            () -> service.create("T", "B", NotificationSeverity.INFO, moment, moment, true, 1L))
        .isInstanceOf(ValidationException.class);
  }

  @Test
  void allowsAnOpenEndedAnnouncement() {
    savesWhatItIsGiven();

    // No end date is legitimate; the console warns about it rather than the service forbidding it.
    AnnouncementView view =
        service.create("T", "B", NotificationSeverity.WARNING, LocalDateTime.now(), null, true, 1L);

    assertThat(view.endsAt()).isNull();
    assertThat(view.published()).isTrue();
  }

  @Test
  void updatingKeepsTheAuthorAndReplacesTheContent() {
    Announcement existing = new Announcement();
    existing.setId(3L);
    existing.setCreatedBy(9L);
    existing.setTitle("Ancien");
    when(announcements.findById(3L)).thenReturn(Optional.of(existing));
    savesWhatItIsGiven();

    service.update(
        3L, "Nouveau", "Corps", NotificationSeverity.CRITICAL, LocalDateTime.now(), null, false);

    assertThat(existing.getTitle()).isEqualTo("Nouveau");
    assertThat(existing.isPublished()).isFalse();
    // The author is who wrote it first; editing does not reassign authorship.
    assertThat(existing.getCreatedBy()).isEqualTo(9L);
  }

  @Test
  void anAnnouncementIsActiveOnlyInsideItsWindow() {
    Announcement a = new Announcement();
    a.setPublished(true);
    a.setStartsAt(LocalDateTime.now().minusDays(1));
    a.setEndsAt(LocalDateTime.now().plusDays(1));

    assertThat(a.isActiveAt(LocalDateTime.now())).isTrue();
    assertThat(a.isActiveAt(LocalDateTime.now().minusDays(2))).isFalse();
    // It ends on its own — nothing has to remember to take it down.
    assertThat(a.isActiveAt(LocalDateTime.now().plusDays(2))).isFalse();

    a.setPublished(false);
    assertThat(a.isActiveAt(LocalDateTime.now())).isFalse();
  }
}
