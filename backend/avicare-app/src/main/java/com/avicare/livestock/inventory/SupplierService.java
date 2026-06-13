package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.repository.SupplierRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-farm supplier directory (Sprint B4-1). Farm-scoped with tenant isolation: reads and mutations
 * are always keyed by {@code (farmId, supplierId)} so a supplier of farm A is unreachable from farm
 * B. Soft delete via {@code active=false}. RBAC (OWNER/MANAGER) is enforced at the controller layer
 * (B4-6); these are plain services. Mirrors the veterinarian directory pattern (B3-3).
 */
@Service
@RequiredArgsConstructor
public class SupplierService {

  private final SupplierRepository supplierRepository;

  @Transactional
  public Supplier create(Long farmId, SupplierCommand cmd, Long userId) {
    Supplier supplier = new Supplier();
    supplier.setFarmId(farmId);
    supplier.setCreatedBy(userId);
    apply(supplier, cmd);
    return supplierRepository.save(supplier);
  }

  @Transactional
  public Supplier update(Long farmId, Long supplierId, SupplierCommand cmd, Long userId) {
    Supplier supplier = load(farmId, supplierId);
    apply(supplier, cmd);
    return supplierRepository.save(supplier);
  }

  /** Soft delete: keeps history but hides the supplier from the active directory. */
  @Transactional
  public void deactivate(Long farmId, Long supplierId, Long userId) {
    Supplier supplier = load(farmId, supplierId);
    supplier.setActive(false);
    supplierRepository.save(supplier);
  }

  @Transactional(readOnly = true)
  public List<Supplier> listForFarm(Long farmId) {
    return supplierRepository.findByFarmIdAndActiveTrueOrderByCommercialName(farmId);
  }

  @Transactional(readOnly = true)
  public Supplier get(Long farmId, Long supplierId) {
    return load(farmId, supplierId);
  }

  private Supplier load(Long farmId, Long supplierId) {
    return supplierRepository
        .findByFarmIdAndId(farmId, supplierId)
        .orElseThrow(() -> NotFoundException.of("Supplier", supplierId));
  }

  private static void apply(Supplier supplier, SupplierCommand cmd) {
    supplier.setCommercialName(cmd.commercialName());
    supplier.setContactPerson(cmd.contactPerson());
    supplier.setPhone(cmd.phone());
    supplier.setEmail(cmd.email());
    supplier.setAddress(cmd.address());
    supplier.setCity(cmd.city());
    supplier.setTypes(cmd.types() != null ? cmd.types() : List.of());
    supplier.setPaymentTerms(cmd.paymentTerms());
    supplier.setNotes(cmd.notes());
  }
}
