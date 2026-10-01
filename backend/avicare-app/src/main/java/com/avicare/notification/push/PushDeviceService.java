package com.avicare.notification.push;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Registers and retires the phones that receive pushes. */
@Service
@RequiredArgsConstructor
public class PushDeviceService {

  private final PushDeviceRepository devices;

  /**
   * Attach {@code token} to {@code userId}, creating the device or taking over an existing one. The
   * token being unique, a phone passed to another account stops ringing for its previous owner, and
   * a revoked token comes back to life when the device registers itself again.
   */
  @Transactional
  public void register(Long userId, String token, PushPlatform platform) {
    devices.upsert(userId, token, platform.name());
  }

  /** Retire a token at logout — only if it belongs to the caller. */
  @Transactional
  public void unregister(Long userId, String token) {
    devices
        .findByToken(token)
        .filter(d -> d.getUserId().equals(userId) && d.getRevokedAt() == null)
        .ifPresent(
            d -> {
              d.setRevokedAt(LocalDateTime.now());
              devices.save(d);
            });
  }

  @Transactional(readOnly = true)
  public List<String> activeTokensOf(Collection<Long> userIds) {
    if (userIds.isEmpty()) {
      return List.of();
    }
    return devices.findByUserIdInAndRevokedAtIsNull(userIds).stream()
        .map(PushDevice::getToken)
        .toList();
  }

  /**
   * Retire tokens Expo reported dead. A new transaction on purpose: this runs from the {@code
   * afterCommit} of the scan, where the original one can no longer write.
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void revoke(Collection<String> tokens) {
    LocalDateTime now = LocalDateTime.now();
    List<PushDevice> found = devices.findByTokenIn(tokens);
    found.forEach(d -> d.setRevokedAt(now));
    devices.saveAll(found);
  }
}
