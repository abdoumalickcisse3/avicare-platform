package com.avicare.tenancy.mapper;

import com.avicare.tenancy.api.dto.FarmInfo;
import com.avicare.tenancy.api.dto.UserFarmInfo;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.response.FarmResponse;
import com.avicare.tenancy.dto.response.MemberResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** Entity ↔ DTO mapping for the tenancy context. */
@Mapper(componentModel = "spring")
public interface TenancyMapper {

  // production_focus is not a Farm column — it lives in farm_settings, set by FarmService.
  @Mapping(target = "productionFocus", ignore = true)
  FarmResponse toResponse(Farm farm);

  FarmInfo toInfo(Farm farm);

  MemberResponse toResponse(UserFarm membership);

  UserFarmInfo toInfo(UserFarm membership);
}
