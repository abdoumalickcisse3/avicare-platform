package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.commercial.ClientService;
import com.avicare.livestock.commercial.dto.ClientRequest;
import com.avicare.livestock.commercial.dto.ClientResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Client directory endpoints (Sprint B5-5). Reads for any farm member; writes (create/update/
 * deactivate) for OWNER/MANAGER. The indicative over-credit-limit listing supports the
 * credit-overshoot alert (D26).
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/commercial/clients")
@RequiredArgsConstructor
public class ClientController {

  private final ClientService clientService;

  @GetMapping
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<ClientResponse>> list(@PathVariable Long farmId) {
    return ApiResponse.of(
        clientService.listForFarm(farmId).stream().map(ClientResponse::from).toList());
  }

  @GetMapping("/over-credit-limit")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<List<ClientResponse>> overCreditLimit(@PathVariable Long farmId) {
    return ApiResponse.of(
        clientService.listOverCreditLimit(farmId).stream().map(ClientResponse::from).toList());
  }

  @GetMapping("/{id}")
  @PreAuthorize(CommercialAccess.READ)
  public ApiResponse<ClientResponse> get(@PathVariable Long farmId, @PathVariable Long id) {
    return ApiResponse.of(ClientResponse.from(clientService.getById(farmId, id)));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<ClientResponse> create(
      @PathVariable Long farmId, @RequestBody @Valid ClientRequest request) {
    return ApiResponse.of(
        ClientResponse.from(
            clientService.create(farmId, request.toCommand(), TenancyContext.currentUserId())));
  }

  @PutMapping("/{id}")
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public ApiResponse<ClientResponse> update(
      @PathVariable Long farmId, @PathVariable Long id, @RequestBody @Valid ClientRequest request) {
    return ApiResponse.of(
        ClientResponse.from(clientService.update(farmId, id, request.toCommand())));
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize(CommercialAccess.WRITE_MANAGER)
  public void deactivate(@PathVariable Long farmId, @PathVariable Long id) {
    clientService.deactivate(farmId, id);
  }
}
