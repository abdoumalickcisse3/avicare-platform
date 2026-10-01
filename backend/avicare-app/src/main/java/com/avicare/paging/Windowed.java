package com.avicare.paging;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.media.Schema;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Bounds a list endpoint that grows with the life of a farm (sales, payments, stock movements...).
 *
 * <p>The response keeps its {@code { data: [...] }} shape, so no client breaks. A caller may pass
 * {@code page} (from 0) and {@code size}; without them it gets the first {@value
 * WindowedListAdvice#DEFAULT_SIZE} rows. {@code meta} always reports {@code total}, {@code page},
 * {@code size} and {@code truncated}, so a screen can say "showing the latest 500 of 1 240" instead
 * of silently hiding rows.
 *
 * <p>Only for endpoints whose list is <b>newest first</b>: the window cuts from the end, and a
 * chronological list would lose its newest rows.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Parameter(
    name = "page",
    in = ParameterIn.QUERY,
    description = "Zero-based page of the window",
    schema = @Schema(type = "integer", defaultValue = "0"))
@Parameter(
    name = "size",
    in = ParameterIn.QUERY,
    description = "Rows per page (max 1000)",
    schema = @Schema(type = "integer", defaultValue = "500"))
public @interface Windowed {}
