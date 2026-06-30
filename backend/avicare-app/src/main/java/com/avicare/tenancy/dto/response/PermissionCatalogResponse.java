package com.avicare.tenancy.dto.response;

import com.avicare.common.security.access.PermissionCatalog.ResourceDef;
import java.util.List;
import java.util.Map;

/** Permission vocabulary for the member-access UI. */
public record PermissionCatalogResponse(
    List<ResourceDef> resources, Map<String, List<String>> roleDefaults) {}
