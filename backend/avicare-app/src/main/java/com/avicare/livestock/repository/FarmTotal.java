package com.avicare.livestock.repository;

/**
 * One farm's total for an aggregate query.
 *
 * <p>Its own file rather than nested in one repository: two repositories return it, and nesting it
 * in either would make the other import a type from a sibling for no reason.
 */
public interface FarmTotal {

  Long getFarmId();

  long getTotal();
}
