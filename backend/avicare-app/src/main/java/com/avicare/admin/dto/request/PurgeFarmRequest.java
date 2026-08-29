package com.avicare.admin.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Confirmation for an irreversible farm purge.
 *
 * <p>The caller must retype the farm's exact name. A checkbox is clicked by reflex; a name has to
 * be read first, which is the whole point when the action removes a farm's entire history.
 */
public record PurgeFarmRequest(@NotBlank String confirmationName) {}
