package com.avicare.admin.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * The complete permission set a staff member should end up with — not a delta.
 *
 * <p>Replacing the whole set rather than adding and removing one by one keeps the screen and the
 * database in agreement: a console showing checkboxes sends what the operator sees, and two
 * operators editing at once cannot merge into a union neither of them intended.
 *
 * <p>An empty list is valid and means "staff, but allowed nothing" — the state a newly promoted
 * account starts in.
 */
public record UpdateStaffPermissionsRequest(@NotNull List<String> permissions) {}
