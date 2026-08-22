package com.avicare.partner.dto.request;

import jakarta.validation.constraints.NotNull;

/** Manually attach a farm to a partner network (admin). */
public record AttachFarmRequest(@NotNull Long farmId) {}
