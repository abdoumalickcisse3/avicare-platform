package com.avicare.identity.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.identity.domain.User;
import com.avicare.identity.mapper.IdentityMapper;
import com.avicare.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link IdentityFacade} implementation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IdentityFacadeImpl implements IdentityFacade {

  private final UserRepository userRepository;
  private final IdentityMapper identityMapper;

  @Override
  public UserInfo findById(Long userId) {
    return identityMapper.toInfo(loadById(userId));
  }

  @Override
  public UserInfo findByEmail(String email) {
    User user =
        userRepository
            .findByEmailIgnoreCase(email)
            .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User not found: " + email));
    return identityMapper.toInfo(user);
  }

  @Override
  public boolean isActive(Long userId) {
    return loadById(userId).isActive();
  }

  private User loadById(Long userId) {
    return userRepository.findById(userId).orElseThrow(() -> NotFoundException.of("User", userId));
  }
}
