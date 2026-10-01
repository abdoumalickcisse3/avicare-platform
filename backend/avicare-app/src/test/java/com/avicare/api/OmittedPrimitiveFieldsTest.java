package com.avicare.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.RecordComponent;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

/**
 * Every request record that declares a primitive component must still accept a payload that omits
 * it.
 *
 * <p>Jackson 3 turns {@code FAIL_ON_NULL_FOR_PRIMITIVES} on by default, where Jackson 2 had it off.
 * An absent field reaches a record's canonical constructor as {@code null}, so the new default
 * turns every such request into a 400 "Request body is missing or is not valid JSON" — not a
 * validation error naming the field, just a flat rejection. The Spring Boot 4 upgrade hit exactly
 * that on {@code POST /inventory/suppliers} and {@code POST /commercial/clients}; seven other
 * request DTOs were one call away from the same answer.
 *
 * <p>This test holds the HTTP contract rather than the configuration: it parses an empty object
 * with the deployed setting and fails if any of them stops accepting it.
 */
class OmittedPrimitiveFieldsTest {

  private static final Path SOURCE_ROOT = Path.of("src/main/java");

  private final JsonMapper mapper =
      JsonMapper.builder().disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES).build();

  static Stream<Class<?>> requestRecordsWithAPrimitive() throws Exception {
    try (var paths = Files.walk(SOURCE_ROOT)) {
      return paths
          .filter(p -> p.getFileName().toString().endsWith("Request.java"))
          .map(OmittedPrimitiveFieldsTest::classOf)
          .filter(c -> c != null && c.isRecord())
          .filter(c -> Stream.of(c.getRecordComponents()).anyMatch(r -> r.getType().isPrimitive()))
          .toList()
          .stream();
    }
  }

  private static Class<?> classOf(Path javaFile) {
    String name =
        SOURCE_ROOT.relativize(javaFile).toString().replace(".java", "").replace('/', '.');
    try {
      return Class.forName(name);
    } catch (ClassNotFoundException e) {
      return null;
    }
  }

  @Test
  void theScanFindsTheRequestRecordsItIsMeantToGuard() throws Exception {
    assertThat(requestRecordsWithAPrimitive().map(Class::getSimpleName))
        .contains("SupplierRequest", "ClientRequest")
        .hasSizeGreaterThanOrEqualTo(9);
  }

  /**
   * The parsing tests below build their own mapper, so they would stay green even if the deployed
   * setting were dropped. This is the assertion that ties them to what actually ships.
   */
  @Test
  void theDeployedConfigurationKeepsTheFeatureOff() throws Exception {
    String config = Files.readString(Path.of("src/main/resources/application.yml"));

    assertThat(config).contains("fail-on-null-for-primitives: false");
  }

  @ParameterizedTest
  @MethodSource("requestRecordsWithAPrimitive")
  void anOmittedPrimitiveParsesToItsDefault(Class<?> requestRecord) {
    Object parsed = mapper.readValue("{}", requestRecord);

    List<RecordComponent> primitives =
        Stream.of(requestRecord.getRecordComponents())
            .filter(r -> r.getType().isPrimitive())
            .toList();
    assertThat(primitives).isNotEmpty();
    assertThat(parsed).isNotNull();
  }
}
