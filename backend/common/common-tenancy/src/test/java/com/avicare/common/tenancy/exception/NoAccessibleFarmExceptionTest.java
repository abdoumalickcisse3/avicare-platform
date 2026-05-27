package com.avicare.common.tenancy.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.common.api.exception.BusinessException;
import com.avicare.common.api.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class NoAccessibleFarmExceptionTest {

  @Test
  void exposesCode403AndExtendsForbidden() {
    NoAccessibleFarmException ex = new NoAccessibleFarmException();

    assertThat(ex).isInstanceOf(ForbiddenException.class).isInstanceOf(BusinessException.class);
    assertThat(ex.getCode()).isEqualTo("NO_ACCESSIBLE_FARM");
    assertThat(ex.getStatus()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(ex.getMessage()).contains("no accessible farm");
  }
}
