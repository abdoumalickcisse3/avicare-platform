package com.avicare.paging;

import com.avicare.common.api.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/** Applies {@link Windowed}: cuts the list to the requested page and reports the total in meta. */
@RestControllerAdvice
public class WindowedListAdvice implements ResponseBodyAdvice<Object> {

  static final int DEFAULT_SIZE = 500;
  static final int MAX_SIZE = 1000;

  @Override
  public boolean supports(
      MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
    return returnType.hasMethodAnnotation(Windowed.class);
  }

  @Override
  public Object beforeBodyWrite(
      Object body,
      MethodParameter returnType,
      MediaType selectedContentType,
      Class<? extends HttpMessageConverter<?>> selectedConverterType,
      ServerHttpRequest request,
      ServerHttpResponse response) {
    if (!(body instanceof ApiResponse<?> wrapped)
        || !(wrapped.data() instanceof List<?> rows)
        || !(request instanceof ServletServerHttpRequest servletRequest)) {
      return body;
    }
    HttpServletRequest http = servletRequest.getServletRequest();
    int size = clamp(parse(http.getParameter("size"), DEFAULT_SIZE), 1, MAX_SIZE);
    int page = Math.max(parse(http.getParameter("page"), 0), 0);

    int total = rows.size();
    long from = (long) page * size;
    List<?> window =
        from >= total ? List.of() : rows.subList((int) from, (int) Math.min(from + size, total));

    Map<String, Object> meta = new LinkedHashMap<>();
    if (wrapped.meta() != null) {
      meta.putAll(wrapped.meta());
    }
    meta.put("total", total);
    meta.put("page", page);
    meta.put("size", size);
    meta.put("truncated", window.size() < total);
    return ApiResponse.of(window, meta);
  }

  private static int parse(String raw, int fallback) {
    try {
      return raw == null ? fallback : Integer.parseInt(raw.trim());
    } catch (NumberFormatException e) {
      return fallback;
    }
  }

  private static int clamp(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }
}
