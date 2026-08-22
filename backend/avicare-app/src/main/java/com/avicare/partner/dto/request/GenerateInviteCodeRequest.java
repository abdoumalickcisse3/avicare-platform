package com.avicare.partner.dto.request;

import java.time.LocalDateTime;

/** Generate an invite code (admin). Both fields optional: null maxUses = unlimited. */
public record GenerateInviteCodeRequest(Integer maxUses, LocalDateTime expiresAt) {}
