package com.avicare.tenancy.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.tenancy.dto.request.CreateFarmRequest;
import com.avicare.tenancy.dto.request.UpdateFarmRequest;
import com.avicare.tenancy.dto.response.FarmResponse;
import com.avicare.tenancy.domain.FarmLogo;
import com.avicare.tenancy.service.FarmLogoService;
import com.avicare.tenancy.service.FarmService;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Farm CRUD. Listing and creation are open to any authenticated user (a user always sees their own
 * farms and can create a new one, becoming its OWNER). Per-farm reads/writes are guarded by the
 * tenant-level {@code @farmAccess} SpEL bean.
 */
@RestController
@RequestMapping("/api/v1/farms")
@RequiredArgsConstructor
public class FarmController {

  private final FarmService farmService;
  private final FarmLogoService farmLogoService;

  @GetMapping
  public ApiResponse<List<FarmResponse>> myFarms() {
    return ApiResponse.of(
        farmService.listAccessible(
            TenancyContext.currentUserId(), TenancyContext.get().isSuperAdmin()));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<FarmResponse> create(@RequestBody @Valid CreateFarmRequest request) {
    return ApiResponse.of(farmService.create(TenancyContext.currentUserId(), request));
  }

  @GetMapping("/{farmId}")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ApiResponse<FarmResponse> get(@PathVariable Long farmId) {
    return ApiResponse.of(farmService.get(farmId));
  }

  @PutMapping("/{farmId}")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER, T(com.avicare.common.security.principal.FarmRole).MANAGER)")
  public ApiResponse<FarmResponse> update(
      @PathVariable Long farmId, @RequestBody @Valid UpdateFarmRequest request) {
    return ApiResponse.of(farmService.update(farmId, request));
  }

  /**
   * Le logo de la ferme, tel qu'il s'imprime sur ses factures.
   *
   * <p>Lecture ouverte à tous les membres : l'ouvrier qui édite une facture depuis le terrain doit
   * pouvoir l'afficher. L'écriture est réservée au propriétaire — c'est l'identité de
   * l'exploitation vis-à-vis de ses clients, pas un réglage d'exploitation courant.
   */
  @GetMapping("/{farmId}/logo")
  @PreAuthorize("@farmAccess.hasAccess(#farmId)")
  public ResponseEntity<byte[]> logo(@PathVariable Long farmId) {
    FarmLogo logo = farmLogoService.get(farmId);
    return ResponseEntity.ok()
        // Immuable pour un an : l'URL porte l'horodatage du logo (`?v=`), donc un remplacement
        // change l'adresse et le cache n'a jamais à être invalidé.
        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
        .contentType(MediaType.parseMediaType(logo.getContentType()))
        .body(logo.getImage());
  }

  @PutMapping(value = "/{farmId}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public ApiResponse<FarmResponse> putLogo(
      @PathVariable Long farmId, @RequestParam("file") MultipartFile file) {
    farmLogoService.put(farmId, file);
    return ApiResponse.of(farmService.get(farmId));
  }

  @DeleteMapping("/{farmId}/logo")
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public ApiResponse<FarmResponse> deleteLogo(@PathVariable Long farmId) {
    farmLogoService.delete(farmId);
    return ApiResponse.of(farmService.get(farmId));
  }

  @DeleteMapping("/{farmId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(
      "@farmAccess.hasRole(#farmId, T(com.avicare.common.security.principal.FarmRole).OWNER)")
  public void delete(@PathVariable Long farmId) {
    farmService.delete(farmId);
  }
}
