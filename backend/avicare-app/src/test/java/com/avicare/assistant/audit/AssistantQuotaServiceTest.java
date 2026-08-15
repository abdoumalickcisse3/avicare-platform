package com.avicare.assistant.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AssistantQuotaServiceTest {

  @Mock private AssistantAuditRepository repository;

  private AssistantQuotaService service(int quota) {
    return new AssistantQuotaService(repository, quota);
  }

  @Test
  void underTheCap_isNotExhausted() {
    when(repository.countByUserIdAndCreatedAtGreaterThanEqual(eq(9L), any())).thenReturn(5L);

    assertThat(service(300).isExhausted(9L)).isFalse();
  }

  @Test
  void atTheCap_isExhausted() {
    when(repository.countByUserIdAndCreatedAtGreaterThanEqual(eq(9L), any())).thenReturn(300L);

    assertThat(service(300).isExhausted(9L)).isTrue();
  }

  @Test
  void zeroOrNegativeQuota_meansUnlimited_andNeverQueries() {
    lenient()
        .when(repository.countByUserIdAndCreatedAtGreaterThanEqual(any(), any()))
        .thenReturn(9999L);

    assertThat(service(0).isExhausted(9L)).isFalse();
    verifyNoInteractions(repository);
  }
}
