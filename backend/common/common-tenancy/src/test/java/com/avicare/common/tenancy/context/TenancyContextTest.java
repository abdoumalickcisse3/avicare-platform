package com.avicare.common.tenancy.context;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class TenancyContextTest {

  private static final TenantData SAMPLE = new TenantData(7L, List.of(10L, 20L), false);

  @AfterEach
  void cleanup() {
    TenancyContext.clear();
  }

  @Test
  void set_thenGet_returnsSameData() {
    TenancyContext.set(SAMPLE);

    assertThat(TenancyContext.isSet()).isTrue();
    assertThat(TenancyContext.get()).isEqualTo(SAMPLE);
    assertThat(TenancyContext.currentUserId()).isEqualTo(7L);
    assertThat(TenancyContext.accessibleFarmIds()).containsExactly(10L, 20L);
    assertThat(TenancyContext.isSuperAdmin()).isFalse();
  }

  @Test
  void get_whenNotSet_throwsIllegalState() {
    assertThat(TenancyContext.isSet()).isFalse();

    assertThatThrownBy(TenancyContext::get)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("No tenancy context");
  }

  @Test
  void tryGet_whenNotSet_returnsEmpty() {
    assertThat(TenancyContext.tryGet()).isEqualTo(Optional.empty());

    TenancyContext.set(SAMPLE);
    assertThat(TenancyContext.tryGet()).contains(SAMPLE);
  }

  @Test
  void clear_removesBinding() {
    TenancyContext.set(SAMPLE);
    TenancyContext.clear();

    assertThat(TenancyContext.isSet()).isFalse();
    assertThat(TenancyContext.tryGet()).isEmpty();
    assertThatThrownBy(TenancyContext::get).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void set_twice_replacesPreviousValue() {
    TenantData first = new TenantData(1L, List.of(100L), false);
    TenantData second = new TenantData(2L, List.of(200L, 300L), true);

    TenancyContext.set(first);
    TenancyContext.set(second);

    assertThat(TenancyContext.get()).isEqualTo(second);
    assertThat(TenancyContext.currentUserId()).isEqualTo(2L);
    assertThat(TenancyContext.isSuperAdmin()).isTrue();
  }

  @Test
  void set_null_throwsNpe() {
    assertThatNullPointerException()
        .isThrownBy(() -> TenancyContext.set(null))
        .withMessageContaining("TenantData");
  }

  /**
   * CRITICAL multi-tenant security guarantee: a value set on one thread MUST NOT be visible from
   * another. If this test fails, the platform leaks tenancy data between requests and breaks
   * isolation between tenants.
   */
  @Test
  void isolatesBetweenThreads() throws ExecutionException, InterruptedException, TimeoutException {
    TenancyContext.set(SAMPLE);

    CompletableFuture<Optional<TenantData>> spawned =
        CompletableFuture.supplyAsync(
            () -> {
              try {
                return TenancyContext.tryGet();
              } finally {
                TenancyContext.clear();
              }
            });

    Optional<TenantData> seenFromOtherThread = spawned.get(5, TimeUnit.SECONDS);

    assertThat(seenFromOtherThread).as("Other thread must not see main thread's tenancy").isEmpty();
    assertThat(TenancyContext.get()).as("Main thread keeps its own tenancy").isEqualTo(SAMPLE);
  }
}
