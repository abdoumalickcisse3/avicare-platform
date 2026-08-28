package com.avicare.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.admin.domain.AdminAuditLog;
import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.common.tenancy.context.TenantData;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminAuditServiceTest {

  @Mock AdminAuditLogRepository repository;

  @AfterEach
  void clearContext() {
    TenancyContext.clear();
  }

  private AdminAuditLog saved() {
    ArgumentCaptor<AdminAuditLog> captor = ArgumentCaptor.captor();
    verify(repository).save(captor.capture());
    return captor.getValue();
  }

  @Test
  void takesTheActorFromTheTenancyContext() {
    TenancyContext.set(new TenantData(42L, List.of(), true));

    new AdminAuditService(repository)
        .record("farm.module.enable", "Farm", 8L, 8L, Map.of("module", "poultry"));

    AdminAuditLog entry = saved();
    assertThat(entry.getActorUserId()).isEqualTo(42L);
    assertThat(entry.getAction()).isEqualTo("farm.module.enable");
    assertThat(entry.getTenantId()).isEqualTo(8L);
    assertThat(entry.getMetadata()).containsEntry("module", "poultry");
  }

  @Test
  void acceptsAnExplicitActorWhenNoContextExists() {
    // The founder bootstrap promotes an account before anyone is authenticated.
    new AdminAuditService(repository).record(7L, "staff.founder.promote", "User", 7L, null, null);

    assertThat(saved().getActorUserId()).isEqualTo(7L);
  }

  @Test
  void turnsNullMetadataIntoAnEmptyMapNeverNull() {
    // The column is NOT NULL; a null here would fail the insert at the worst possible moment.
    new AdminAuditService(repository).record(7L, "staff.login", "User", 7L, null, null);

    assertThat(saved().getMetadata()).isNotNull().isEmpty();
  }

  @Test
  void neverBreaksTheActionItRecords() {
    when(repository.save(any())).thenThrow(new IllegalStateException("db is down"));

    // A trail that can fail the action it traces would make the console break on its own
    // bookkeeping. It logs loudly instead.
    assertThatCode(
            () ->
                new AdminAuditService(repository).record(7L, "staff.login", "User", 7L, null, null))
        .doesNotThrowAnyException();
  }
}
