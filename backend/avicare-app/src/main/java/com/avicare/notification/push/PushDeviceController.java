package com.avicare.notification.push;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Where a phone registers to receive pushes. Per user, not per farm: the phone follows the person,
 * and the farm a push is about travels in its payload. The user comes from the verified token, so a
 * caller can only ever attach a phone to — or retire one from — their own account.
 */
@RestController
@RequestMapping("/api/v1/push-devices")
@RequiredArgsConstructor
public class PushDeviceController {

  private final PushDeviceService pushDeviceService;

  @PostMapping
  public ApiResponse<Void> register(@RequestBody @Valid RegisterPushDeviceRequest request) {
    pushDeviceService.register(TenancyContext.currentUserId(), request.token(), request.platform());
    return ApiResponse.of(null);
  }

  @PostMapping("/revoke")
  public ApiResponse<Void> revoke(@RequestBody @Valid RevokePushDeviceRequest request) {
    pushDeviceService.unregister(TenancyContext.currentUserId(), request.token());
    return ApiResponse.of(null);
  }
}
