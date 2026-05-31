package com.avicare.identity.mapper;

import com.avicare.identity.api.dto.UserInfo;
import com.avicare.identity.domain.User;
import com.avicare.identity.dto.response.UserResponse;
import org.mapstruct.Mapper;

/** Entity ↔ DTO mapping for the identity context. */
@Mapper(componentModel = "spring")
public interface IdentityMapper {

  UserResponse toResponse(User user);

  UserInfo toInfo(User user);
}
