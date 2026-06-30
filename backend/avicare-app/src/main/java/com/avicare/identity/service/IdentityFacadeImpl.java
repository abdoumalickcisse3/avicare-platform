package com.avicare.identity.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.api.dto.ProvisionUserCommand;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.identity.domain.User;
import com.avicare.identity.mapper.IdentityMapper;
import com.avicare.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Default {@link IdentityFacade} implementation. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class IdentityFacadeImpl implements IdentityFacade {

  private final UserRepository userRepository;
  private final IdentityMapper identityMapper;
  private final AuthService authService;
  private final PasswordEncoder passwordEncoder;

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

  @Override
  @Transactional
  public UserInfo provisionUser(ProvisionUserCommand command) {
    User saved =
        authService.createUser(
            command.fullName(), command.email(), command.phone(), command.rawPassword());
    return identityMapper.toInfo(saved);
  }

  @Override
  @Transactional
  public void resetPassword(Long userId, String rawPassword) {
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User " + userId));
    user.setPasswordHash(passwordEncoder.encode(rawPassword));
  }

  private User loadById(Long userId) {
    return userRepository.findById(userId).orElseThrow(() -> NotFoundException.of("User", userId));
  }
}
