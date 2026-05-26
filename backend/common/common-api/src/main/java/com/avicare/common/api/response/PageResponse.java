package com.avicare.common.api.response;

import java.util.List;
import org.springframework.data.domain.Page;

/**
 * Pagination wrapper.
 *
 * <p>JSON format:
 *
 * <pre>{@code
 * { "items": [...], "page": 0, "size": 20, "totalElements": 156, "totalPages": 8 }
 * }</pre>
 *
 * @param <T> item type
 */
public record PageResponse<T>(
    List<T> items, int page, int size, long totalElements, int totalPages) {

  public static <T> PageResponse<T> from(Page<T> page) {
    return new PageResponse<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
