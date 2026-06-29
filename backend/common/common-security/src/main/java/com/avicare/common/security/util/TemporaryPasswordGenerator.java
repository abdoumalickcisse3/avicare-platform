package com.avicare.common.security.util;

import java.security.SecureRandom;

/** Generates readable temporary passwords (no ambiguous characters). */
public final class TemporaryPasswordGenerator {

  private TemporaryPasswordGenerator() {}

  // excludes O/0/o, l/1/I to stay readable when transmitted verbally
  private static final char[] ALPHABET =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789".toCharArray();
  private static final int LENGTH = 12;
  private static final SecureRandom RANDOM = new SecureRandom();

  public static String generate() {
    StringBuilder sb = new StringBuilder(LENGTH);
    for (int i = 0; i < LENGTH; i++) {
      sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
    }
    return sb.toString();
  }
}
