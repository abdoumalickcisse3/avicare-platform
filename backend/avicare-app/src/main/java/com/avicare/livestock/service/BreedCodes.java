package com.avicare.livestock.service;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Server-side mirror of {@code web/src/lib/slug.ts}, with one deliberate difference: breed codes in
 * this repo are separated with {@code _} ({@code cobb_500}, {@code locale_amelioree}), not {@code
 * -} (the separator {@code web/src/lib/slug.ts} uses for medication keys).
 *
 * <p>Kept as a plain static method, no Spring context: lets {@code BreedCodesTest} run on a machine
 * where Testcontainers can't boot (see project memory), unlike {@code BreedWriteService} which
 * needs the database for dedup.
 */
public final class BreedCodes {

  private static final Pattern DIACRITICS = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
  private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
  private static final Pattern EDGE_UNDERSCORES = Pattern.compile("^_+|_+$");
  private static final int MAX_LENGTH = 100;

  private BreedCodes() {}

  /** Lowercase, accents stripped, non-alphanumerics collapsed to {@code _}, capped at 100 chars. */
  public static String slugify(String name) {
    String decomposed = Normalizer.normalize(name, Normalizer.Form.NFD);
    String withoutDiacritics = DIACRITICS.matcher(decomposed).replaceAll("");
    String lower = withoutDiacritics.toLowerCase(Locale.ROOT);
    String collapsed = NON_ALPHANUMERIC.matcher(lower).replaceAll("_");
    String trimmed = EDGE_UNDERSCORES.matcher(collapsed).replaceAll("");
    return trimmed.length() > MAX_LENGTH ? trimmed.substring(0, MAX_LENGTH) : trimmed;
  }
}
