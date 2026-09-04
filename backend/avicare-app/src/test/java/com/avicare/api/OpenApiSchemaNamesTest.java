package com.avicare.api;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.media.Schema;
import java.io.IOException;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * SpringDoc names a schema after the <b>simple</b> name of its class. Two records called {@code
 * Line} in two different DTOs therefore collapse into one published schema, and whichever springdoc
 * writes last silently describes both — so the generated contract lies about one of them.
 *
 * <p>This bit once. {@code SaleRequest.LineRequest} and {@code
 * PurchaseOrderDraftRequest.LineRequest} shared the name {@code LineRequest}; the published
 * contract advertised the purchase-order field {@code orderedQuantity} for sales, while the API
 * required {@code quantity}. Anyone building from the spec — a generated client, a Postman
 * collection, a partner integration — sent the documented field and got a 400 they could not
 * explain.
 *
 * <p>The rule, enforced here: <b>an API-facing record whose simple name is not unique must carry
 * {@code @Schema(name = …)} with a name nobody else uses.</b> Records outside the API surface
 * (commands, domain models) are free to reuse names — they are never published.
 */
class OpenApiSchemaNamesTest {

  /** Where the compiled classes of this module land; walked rather than scanned with a library. */
  private static final String CLASSES_DIR = "target/classes";

  private static final String ROOT_PACKAGE = "com.avicare";

  @Test
  @DisplayName("no two API-facing records can publish under the same OpenAPI schema name")
  void apiFacingRecordsHaveUniqueSchemaNames() throws Exception {
    Map<String, List<String>> byPublishedName = new LinkedHashMap<>();

    for (Class<?> type : apiFacingRecords()) {
      byPublishedName
          .computeIfAbsent(publishedName(type), k -> new ArrayList<>())
          .add(type.getName());
    }

    Map<String, List<String>> clashes = new LinkedHashMap<>();
    byPublishedName.forEach(
        (name, owners) -> {
          if (owners.size() > 1) clashes.put(name, owners);
        });

    assertThat(clashes)
        .as(
            "each of these OpenAPI schema names is claimed by several API records; the published "
                + "contract can only describe one of them. Give each a distinct "
                + "@Schema(name = \"...\")")
        .isEmpty();
  }

  /** The name springdoc will publish: the explicit one when given, else the simple class name. */
  private static String publishedName(Class<?> type) {
    Schema schema = type.getAnnotation(Schema.class);
    return schema != null && !schema.name().isBlank() ? schema.name() : type.getSimpleName();
  }

  /**
   * A record that can reach the published contract: it lives in a {@code dto} package, or it (or an
   * enclosing class) is named like a request or a response. Commands and domain models are excluded
   * on purpose — they never appear in the spec, and forcing names on them would be noise.
   */
  private static boolean isApiFacing(Class<?> type) {
    if (!type.isRecord()) return false;
    if (type.getPackageName().contains(".dto")) return true;
    for (Class<?> c = type; c != null; c = c.getEnclosingClass()) {
      String simple = c.getSimpleName();
      if (simple.endsWith("Request") || simple.endsWith("Response")) return true;
    }
    return false;
  }

  private static List<Class<?>> apiFacingRecords() throws IOException, URISyntaxException {
    Path root = Path.of(CLASSES_DIR);
    assertThat(Files.isDirectory(root))
        .as("compiled classes are missing — this test needs the module to be built first")
        .isTrue();

    List<Class<?>> found = new ArrayList<>();
    try (Stream<Path> files = Files.walk(root)) {
      for (Path p : files.filter(f -> f.toString().endsWith(".class")).toList()) {
        String binaryName =
            root.relativize(p)
                .toString()
                .replace('/', '.')
                .replace('\\', '.')
                .replace(".class", "");
        if (!binaryName.startsWith(ROOT_PACKAGE)) continue;
        Class<?> type;
        try {
          type = Class.forName(binaryName, false, OpenApiSchemaNamesTest.class.getClassLoader());
        } catch (Throwable ignored) {
          continue; // a class we cannot load is a class springdoc will not publish either
        }
        if (isApiFacing(type)) found.add(type);
      }
    }

    assertThat(found)
        .as("the walk found no API records at all, so the guard would pass vacuously")
        .isNotEmpty();
    return found;
  }
}
