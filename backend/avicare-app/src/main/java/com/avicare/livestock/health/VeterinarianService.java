package com.avicare.livestock.health;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.Veterinarian;
import com.avicare.livestock.repository.VeterinarianRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-farm veterinarian directory (Sprint B3-3). Farm-scoped with tenant isolation: reads and
 * mutations are always keyed by {@code (farmId, vetId)} so a vet of farm A is unreachable from farm
 * B. Soft delete via {@code active=false}. RBAC (OWNER/MANAGER) is enforced at the controller layer
 * (B3-4); these are plain services. No lifecycle event (the directory is farm-, not unit-scoped).
 */
@Service
@RequiredArgsConstructor
public class VeterinarianService {

  private final VeterinarianRepository veterinarianRepository;

  @Transactional
  public Veterinarian create(Long farmId, VeterinarianCommand cmd, Long userId) {
    Veterinarian vet = new Veterinarian();
    vet.setFarmId(farmId);
    vet.setCreatedBy(userId);
    apply(vet, cmd);
    return veterinarianRepository.save(vet);
  }

  @Transactional
  public Veterinarian update(Long farmId, Long vetId, VeterinarianCommand cmd, Long userId) {
    Veterinarian vet = load(farmId, vetId);
    apply(vet, cmd);
    return veterinarianRepository.save(vet);
  }

  /** Soft delete: keeps history but hides the vet from the active directory. */
  @Transactional
  public void deactivate(Long farmId, Long vetId, Long userId) {
    Veterinarian vet = load(farmId, vetId);
    vet.setActive(false);
    veterinarianRepository.save(vet);
  }

  @Transactional(readOnly = true)
  public List<Veterinarian> listForFarm(Long farmId) {
    return veterinarianRepository.findByFarmIdAndActiveTrueOrderByFullName(farmId);
  }

  @Transactional(readOnly = true)
  public Veterinarian get(Long farmId, Long vetId) {
    return load(farmId, vetId);
  }

  private Veterinarian load(Long farmId, Long vetId) {
    return veterinarianRepository
        .findByFarmIdAndId(farmId, vetId)
        .orElseThrow(() -> NotFoundException.of("Veterinarian", vetId));
  }

  private static void apply(Veterinarian vet, VeterinarianCommand cmd) {
    vet.setFullName(cmd.fullName());
    vet.setPhone(cmd.phone());
    vet.setEmail(cmd.email());
    vet.setSpeciality(cmd.speciality());
    vet.setLicenseNumber(cmd.licenseNumber());
    vet.setLocation(cmd.location());
    vet.setNotes(cmd.notes());
  }
}
