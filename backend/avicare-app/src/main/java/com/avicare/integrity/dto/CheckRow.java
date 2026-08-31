package com.avicare.integrity.dto;

import com.avicare.integrity.domain.Severity;

/** One invariant, as documentation for whoever reads the screen. */
public record CheckRow(String key, String label, Severity severity) {}
