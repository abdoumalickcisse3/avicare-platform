package com.avicare.livestock.domain;

/**
 * Kind of commercial client (Sprint B5-1). {@code INDIVIDUAL} = a person; {@code BUSINESS} = a
 * company with a legal name; {@code WHOLESALER} = a reseller buying in bulk. Mirrored by a CHECK
 * constraint in V20.
 */
public enum ClientType {
  INDIVIDUAL,
  BUSINESS,
  WHOLESALER
}
