package com.avicare.tenancy.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.security.access.PermissionCatalog;
import com.avicare.common.security.principal.FarmRole;
import com.avicare.tenancy.dto.response.PermissionCatalogResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exposes the assignable permission vocabulary + per-role defaults (read-only). */
@RestController
@RequestMapping("/api/v1/permissions")
public class PermissionCatalogController {

  @GetMapping("/catalog")
  public ApiResponse<PermissionCatalogResponse> catalog() {
    Map<String, java.util.List<String>> defaults = new LinkedHashMap<>();
    for (FarmRole role : FarmRole.values()) {
      defaults.put(role.name(), role.defaultPermissions());
    }
    return ApiResponse.of(new PermissionCatalogResponse(PermissionCatalog.RESOURCES, defaults));
  }
}
