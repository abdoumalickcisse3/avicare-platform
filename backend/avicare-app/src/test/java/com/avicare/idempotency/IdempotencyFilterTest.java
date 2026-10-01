package com.avicare.idempotency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.security.principal.AvicarePrincipal;
import com.avicare.common.security.principal.UserRole;
import jakarta.servlet.FilterChain;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class IdempotencyFilterTest {

  private static final long USER = 7L;
  private static final String PATH = "/api/v1/farms/1/stock-items/2/adjust";

  private final IdempotencyStore store = mock(IdempotencyStore.class);
  private final IdempotencyFilter filter = new IdempotencyFilter(store);
  private final UUID key = UUID.randomUUID();
  private final AtomicInteger executions = new AtomicInteger();

  @BeforeEach
  void setUp() {
    when(store.available()).thenReturn(true);
    UsernamePasswordAuthenticationToken auth =
        UsernamePasswordAuthenticationToken.authenticated("u@x.sn", null, List.of());
    auth.setDetails(new AvicarePrincipal(USER, "u@x.sn", UserRole.USER, List.of()));
    SecurityContextHolder.getContext().setAuthentication(auth);
  }

  @AfterEach
  void tearDown() {
    SecurityContextHolder.clearContext();
  }

  private MockHttpServletRequest post(String path, String idemKey) {
    MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
    if (idemKey != null) {
      request.addHeader(IdempotencyFilter.HEADER, idemKey);
    }
    return request;
  }

  private FilterChain answering(int status, String body) {
    return (req, res) -> {
      executions.incrementAndGet();
      ((jakarta.servlet.http.HttpServletResponse) res).setStatus(status);
      res.setContentType("application/json");
      res.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
    };
  }

  @Test
  void withoutAKey_theRequestRunsUntouched() throws Exception {
    MockHttpServletResponse response = new MockHttpServletResponse();
    MockHttpServletRequest request = post(PATH, null);

    assertThat(filter.shouldNotFilter(request)).isTrue();
    filter.doFilter(request, response, answering(200, "{}"));

    verify(store, never()).claim(any(), any(), anyString(), anyString());
  }

  @Test
  void aReadIsNeverClaimed() {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", PATH);
    request.addHeader(IdempotencyFilter.HEADER, key.toString());

    assertThat(filter.shouldNotFilter(request)).isTrue();
  }

  @Test
  void firstRequest_runsAndItsAnswerIsStored() throws Exception {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(true);
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(post(PATH, key.toString()), response, answering(201, "{\"id\":9}"));

    assertThat(executions).hasValue(1);
    assertThat(response.getStatus()).isEqualTo(201);
    assertThat(response.getContentAsString()).isEqualTo("{\"id\":9}");
    verify(store).complete(eq(USER), eq(key), eq(201), any(), eq("{\"id\":9}"));
  }

  @Test
  void replay_returnsTheStoredAnswerWithoutRunningAgain() throws Exception {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(false);
    when(store.find(USER, key))
        .thenReturn(
            new IdempotencyStore.Entry("POST", PATH, 201, "application/json", "{\"id\":9}"));
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(post(PATH, key.toString()), response, answering(201, "{\"id\":10}"));

    assertThat(executions).hasValue(0);
    assertThat(response.getStatus()).isEqualTo(201);
    assertThat(response.getContentAsString()).isEqualTo("{\"id\":9}");
    assertThat(response.getHeader(IdempotencyFilter.REPLAYED_HEADER)).isEqualTo("true");
  }

  @Test
  void aRejectedRequestIsRememberedToo() throws Exception {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(true);

    filter.doFilter(
        post(PATH, key.toString()), new MockHttpServletResponse(), answering(422, "{\"x\":1}"));

    verify(store).complete(eq(USER), eq(key), eq(422), any(), anyString());
    verify(store, never()).release(any(), any());
  }

  @Test
  void aServerError_releasesTheKeySoTheRetryReallyRuns() throws Exception {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(true);

    filter.doFilter(post(PATH, key.toString()), new MockHttpServletResponse(), answering(500, ""));

    verify(store).release(USER, key);
    verify(store, never()).complete(any(), any(), anyInt(), any(), any());
  }

  @Test
  void anException_releasesTheKeyAndPropagates() {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(true);
    FilterChain boom =
        (req, res) -> {
          throw new IllegalStateException("boom");
        };

    assertThatThrownBy(
            () -> filter.doFilter(post(PATH, key.toString()), new MockHttpServletResponse(), boom))
        .isInstanceOf(IllegalStateException.class);
    verify(store).release(USER, key);
  }

  @Test
  void aSecondRequestWhileTheFirstRuns_isToldToComeBackLater() throws Exception {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(false);
    when(store.find(USER, key))
        .thenReturn(new IdempotencyStore.Entry("POST", PATH, null, null, null));
    when(store.evictStale(USER, key)).thenReturn(false);
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(post(PATH, key.toString()), response, answering(201, "{}"));

    assertThat(executions).hasValue(0);
    assertThat(response.getStatus()).isEqualTo(503);
    assertThat(response.getHeader("Retry-After")).isEqualTo("5");
  }

  @Test
  void aClaimLeftByADeadRequest_isTakenOver() throws Exception {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(false).thenReturn(true);
    when(store.find(USER, key))
        .thenReturn(new IdempotencyStore.Entry("POST", PATH, null, null, null));
    when(store.evictStale(USER, key)).thenReturn(true);

    filter.doFilter(
        post(PATH, key.toString()), new MockHttpServletResponse(), answering(200, "{}"));

    assertThat(executions).hasValue(1);
  }

  @Test
  void theSameKeyOnAnotherEndpoint_isRefused() throws Exception {
    when(store.claim(USER, key, "POST", PATH)).thenReturn(false);
    when(store.find(USER, key))
        .thenReturn(new IdempotencyStore.Entry("POST", "/api/v1/other", 200, null, "{}"));
    MockHttpServletResponse response = new MockHttpServletResponse();

    filter.doFilter(post(PATH, key.toString()), response, answering(200, "{}"));

    assertThat(executions).hasValue(0);
    assertThat(response.getStatus()).isEqualTo(422);
  }

  @Test
  void aMalformedKey_isIgnored() throws Exception {
    filter.doFilter(post(PATH, "not-a-uuid"), new MockHttpServletResponse(), answering(200, "{}"));

    assertThat(executions).hasValue(1);
    verify(store, never()).claim(any(), any(), anyString(), anyString());
  }
}
