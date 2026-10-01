package com.avicare.paging;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.api.response.ApiResponse;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class WindowedListAdviceTest {

  private final WindowedListAdvice advice = new WindowedListAdvice();

  @Windowed
  ApiResponse<List<Integer>> windowed() {
    return null;
  }

  ApiResponse<List<Integer>> plain() {
    return null;
  }

  private MethodParameter method(String name) throws Exception {
    return new MethodParameter(WindowedListAdviceTest.class.getDeclaredMethod(name), -1);
  }

  @SuppressWarnings("unchecked")
  private ApiResponse<List<Integer>> run(int rows, String... params) throws Exception {
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/x");
    for (int i = 0; i < params.length; i += 2) {
      request.setParameter(params[i], params[i + 1]);
    }
    List<Integer> all = IntStream.range(0, rows).boxed().toList();
    return (ApiResponse<List<Integer>>)
        advice.beforeBodyWrite(
            ApiResponse.of(all),
            method("windowed"),
            MediaType.APPLICATION_JSON,
            null,
            new ServletServerHttpRequest(request),
            new ServletServerHttpResponse(new MockHttpServletResponse()));
  }

  @Test
  void onlyAnnotatedEndpointsAreWindowed() throws Exception {
    assertThat(advice.supports(method("windowed"), null)).isTrue();
    assertThat(advice.supports(method("plain"), null)).isFalse();
  }

  @Test
  void aSmallListIsLeftWhole_andStillReportsItsTotal() throws Exception {
    ApiResponse<List<Integer>> out = run(3);

    assertThat(out.data()).containsExactly(0, 1, 2);
    assertThat(out.meta())
        .containsEntry("total", 3)
        .containsEntry("page", 0)
        .containsEntry("size", 500)
        .containsEntry("truncated", false);
  }

  @Test
  void withoutParameters_aLongListIsCutToTheDefaultWindow() throws Exception {
    ApiResponse<List<Integer>> out = run(700);

    assertThat(out.data()).hasSize(500).startsWith(0);
    assertThat(out.meta()).containsEntry("total", 700).containsEntry("truncated", true);
  }

  @Test
  void aCallerCanWalkThePages() throws Exception {
    ApiResponse<List<Integer>> out = run(25, "page", "2", "size", "10");

    assertThat(out.data()).containsExactly(20, 21, 22, 23, 24);
    assertThat(out.meta()).containsEntry("page", 2).containsEntry("size", 10);
  }

  @Test
  void aPageBeyondTheEnd_isEmptyNotAnError() throws Exception {
    assertThat(run(5, "page", "9", "size", "10").data()).isEmpty();
  }

  @Test
  void sizeIsCapped_andGarbageFallsBackToDefaults() throws Exception {
    assertThat(run(1500, "size", "99999").data()).hasSize(1000);
    assertThat(run(600, "size", "abc", "page", "-4").data()).hasSize(500).startsWith(0);
  }
}
