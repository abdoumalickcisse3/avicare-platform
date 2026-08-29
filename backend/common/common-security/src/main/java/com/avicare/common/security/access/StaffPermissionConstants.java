package com.avicare.common.security.access;

import java.util.List;
import java.util.Map;

/**
 * Canonical {@code resource:verb} permissions of the platform back-office (super-admin console).
 *
 * <p>Deliberately a <b>separate taxonomy</b> from {@link PermissionConstants}: a farm right and a
 * staff right must never be confused, and a farm permission accidentally written into {@code
 * staff_permissions} must not validate. The two catalogs share a shape, nothing else.
 *
 * <p>{@code UserRole.ADMIN} stays the "platform staff" marker; these say what each staff member is
 * allowed to do. {@code "*"} means SUPER_ADMIN — every permission, implicitly.
 */
public final class StaffPermissionConstants {

  private StaffPermissionConstants() {}

  // Tenants (farms)
  public static final String TENANTS_READ = "tenants:read";
  public static final String TENANTS_WRITE = "tenants:write";

  // Platform users
  public static final String USERS_READ = "users:read";
  public static final String USERS_RESET_PASSWORD = "users:reset-password";
  public static final String USERS_DEACTIVATE = "users:deactivate";

  /** Open a scoped, time-limited session as a farmer, for support. Always audited. */
  public static final String IMPERSONATE = "impersonate:open";

  // Platform catalog (catalog_items)
  public static final String CATALOG_WRITE = "catalog:write";

  // Broadcast / announcements
  public static final String BROADCAST_SEND = "broadcast:send";

  // GDPR-style compliance
  public static final String COMPLIANCE_EXPORT = "compliance:export";
  public static final String COMPLIANCE_DELETE = "compliance:delete";

  // Staff management itself
  public static final String STAFF_MANAGE = "staff:manage";

  // Partners (spec §6bis.4)
  public static final String PARTNERS_READ = "partners:read";
  public static final String PARTNERS_WRITE = "partners:write";
  public static final String PARTNERS_USERS = "partners:users";

  /**
   * Attach or detach a farm from a partner network. Its own permission on purpose: this is the
   * action that opens — and closes — a third party's access to a farmer's data.
   */
  public static final String PARTNERS_ATTACH = "partners:attach";

  public static final String PARTNERS_PROSPECT = "partners:prospect";

  /** Verbs assignable per resource, the source of truth for validation. */
  public static final Map<String, List<String>> RESOURCE_VERBS =
      Map.of(
          "tenants", List.of("read", "write"),
          "users", List.of("read", "reset-password", "deactivate"),
          "impersonate", List.of("open"),
          "catalog", List.of("write"),
          "broadcast", List.of("send"),
          "compliance", List.of("export", "delete"),
          "staff", List.of("manage"),
          "metrics", List.of("read"),
          "partners", List.of("read", "write", "users", "attach", "prospect"));
}
