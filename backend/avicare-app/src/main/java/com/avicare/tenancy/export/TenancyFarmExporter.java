package com.avicare.tenancy.export;

import com.avicare.admin.spi.FarmDataExporter;
import com.avicare.identity.repository.UserRepository;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** The farm itself and the people on it. */
@Component
@RequiredArgsConstructor
public class TenancyFarmExporter implements FarmDataExporter {

  private final FarmRepository farms;
  private final UserFarmRepository memberships;
  private final UserRepository users;

  @Override
  public String section() {
    return "farm";
  }

  @Override
  public Map<String, Object> export(Long farmId) {
    Map<String, Object> out = new LinkedHashMap<>();
    farms
        .findById(farmId)
        .ifPresent(
            farm -> {
              out.put("id", farm.getId());
              out.put("name", farm.getName());
              out.put("description", farm.getDescription());
              out.put("location", farm.getLocation());
              out.put("capacity", farm.getCapacity());
              out.put("ninea", farm.getNinea());
              out.put("rccm", farm.getRccm());
              out.put("currency", farm.getCurrency());
              out.put("timezone", farm.getTimezone());
              out.put("createdAt", farm.getCreatedAt());
              out.put("deletedAt", farm.getDeletedAt());
            });

    List<Map<String, Object>> members =
        memberships.findByFarmId(farmId).stream()
            .map(
                m -> {
                  Map<String, Object> row = new LinkedHashMap<>();
                  row.put("userId", m.getUserId());
                  row.put("role", m.getRole() == null ? null : m.getRole().name());
                  users
                      .findById(m.getUserId())
                      .ifPresent(
                          u -> {
                            row.put("email", u.getEmail());
                            row.put("fullName", u.getFullName());
                            row.put("phone", u.getPhone());
                          });
                  return row;
                })
            .toList();
    out.put("members", members);
    return out;
  }
}
