package com.avicare.tenancy.dto.request;

import com.avicare.common.security.principal.FarmRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Provision a new member account on a farm. {@code permissions} null → role defaults.
 *
 * <p>{@code phone} is required since 2026-10-09, and this is the path that matters: self-service
 * sign-up is closed (neither sign-in screen links to it, the landing's CTA points at /contact), so
 * in practice every new account is an owner adding a member. Requiring the number only on signup
 * would have changed nothing at all.
 *
 * <p>The cost is real and accepted: an owner who does not know a worker's number can no longer
 * create their account. The alternative was to keep creating people the platform cannot warn.
 */
public record CreateMemberRequest(
    @NotBlank @Size(max = 200) String fullName,
    @NotNull @Email String email,
    @NotBlank @Size(max = 30) String phone,
    @NotNull FarmRole role,
    List<String> permissions) {}
