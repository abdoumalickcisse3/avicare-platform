package com.avicare.tenancy.dto.request;

import com.avicare.common.security.principal.FarmRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Provision a new member account on a farm. {@code permissions} null → role defaults. */
public record CreateMemberRequest(
    @NotBlank @Size(max = 200) String fullName,
    @NotNull @Email String email,
    @Size(max = 30) String phone,
    @NotNull FarmRole role,
    List<String> permissions) {}
