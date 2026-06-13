package com.avicare.livestock.domain;

/**
 * Direction of a stock movement (Sprint B4-2). The stored {@code quantity} is always the positive
 * magnitude of the change; the sign is carried by this type. {@code ADJUSTMENT} reconciles the
 * stock to a counted absolute value (physical inventory / correction).
 */
public enum MovementType {
  IN,
  OUT,
  ADJUSTMENT
}
