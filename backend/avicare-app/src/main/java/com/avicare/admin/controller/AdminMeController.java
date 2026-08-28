package com.avicare.admin.controller;

import com.avicare.admin.access.StaffPermissionService;
import com.avicare.admin.dto.response.AdminMeResponse;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.UserInfo;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Who the signed-in staff member is and what they may do.
 *
 * <p>Gated on being staff rather than on a named permission: this is what the console calls right
 * after login to decide whether to open at all. A farmer who knows the URL gets a 403 here, and the
 * front purges their token instead of showing an empty shell.
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminMeController {

  private final StaffPermissionService permissions;
  private final IdentityFacade identityFacade;

  @GetMapping("/me")
  @PreAuthorize("@adminAccess.isStaff()")
  public ApiResponse<AdminMeResponse> me() {
    Long userId = TenancyContext.currentUserId();
    UserInfo user = identityFacade.findById(userId);
    List<String> held = permissions.permissionsOf(userId);
    return ApiResponse.of(
        new AdminMeResponse(userId, user.email(), user.fullName(), held, held.contains("*")));
  }
}
