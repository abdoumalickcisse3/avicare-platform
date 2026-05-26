package com.avicare.common.i18n.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Locale;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.ResourceBundleMessageSource;

class MessageServiceTest {

  private final MessageService service = new MessageService(buildMessageSource());

  @AfterEach
  void resetLocale() {
    LocaleContextHolder.resetLocaleContext();
  }

  @Test
  void returnsFrenchMessageByDefault() {
    LocaleContextHolder.setLocale(Locale.FRENCH);

    assertThat(service.get("validation.notblank")).isEqualTo("Ce champ est obligatoire");
  }

  @Test
  void returnsEnglishMessageWhenLocaleSwitched() {
    LocaleContextHolder.setLocale(Locale.ENGLISH);

    assertThat(service.get("validation.notblank")).isEqualTo("This field is required");
  }

  @Test
  void returnsKeyAsFallbackWhenMessageMissing() {
    LocaleContextHolder.setLocale(Locale.FRENCH);

    assertThat(service.get("nonexistent.key")).isEqualTo("nonexistent.key");
  }

  @Test
  void interpolatesPositionalArgument() {
    LocaleContextHolder.setLocale(Locale.FRENCH);

    assertThat(service.get("error.batch.notfound", 42)).isEqualTo("Le lot 42 est introuvable");
  }

  private static MessageSource buildMessageSource() {
    ResourceBundleMessageSource ms = new ResourceBundleMessageSource();
    ms.setBasenames("messages");
    ms.setDefaultEncoding("UTF-8");
    ms.setUseCodeAsDefaultMessage(true);
    return ms;
  }
}
