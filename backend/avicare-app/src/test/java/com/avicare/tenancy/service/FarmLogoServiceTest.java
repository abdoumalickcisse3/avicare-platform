package com.avicare.tenancy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ValidationException;
import com.avicare.tenancy.domain.FarmLogo;
import com.avicare.tenancy.repository.FarmLogoRepository;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockMultipartFile;

/** Le logo part sur les factures : ce qui entre ici doit être propre et léger. */
class FarmLogoServiceTest {

  private FarmLogoRepository repository;
  private FarmLogoService service;

  @BeforeEach
  void setUp() {
    repository = Mockito.mock(FarmLogoRepository.class);
    when(repository.findById(any())).thenReturn(Optional.empty());
    when(repository.saveAndFlush(any(FarmLogo.class)))
        .thenAnswer(inv -> inv.getArgument(0, FarmLogo.class));
    service = new FarmLogoService(repository);
  }

  private static byte[] png(int width, int height) throws IOException {
    BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = img.createGraphics();
    g.setColor(Color.GREEN);
    g.fillRect(0, 0, width, height);
    g.dispose();
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    ImageIO.write(img, "png", out);
    return out.toByteArray();
  }

  private static MockMultipartFile upload(byte[] bytes, String type) {
    return new MockMultipartFile("file", "logo.png", type, bytes);
  }

  @Test
  void reduces_an_oversized_image_instead_of_storing_it_whole() throws IOException {
    FarmLogo saved = service.put(1L, upload(png(2000, 1200), "image/png"));

    BufferedImage stored = ImageIO.read(new java.io.ByteArrayInputStream(saved.getImage()));
    // Le plus grand côté tient dans la limite, et le ratio d'origine est conservé.
    assertThat(stored.getWidth()).isEqualTo(FarmLogoService.MAX_EDGE);
    assertThat(stored.getHeight()).isEqualTo(307);
  }

  @Test
  void leaves_a_small_logo_at_its_own_size() throws IOException {
    FarmLogo saved = service.put(1L, upload(png(180, 90), "image/png"));

    BufferedImage stored = ImageIO.read(new java.io.ByteArrayInputStream(saved.getImage()));
    assertThat(stored.getWidth()).isEqualTo(180);
    assertThat(stored.getHeight()).isEqualTo(90);
  }

  @Test
  void always_stores_png_even_when_a_jpeg_came_in() throws IOException {
    BufferedImage img = new BufferedImage(60, 60, BufferedImage.TYPE_INT_RGB);
    ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
    ImageIO.write(img, "jpg", jpeg);

    FarmLogo saved = service.put(1L, upload(jpeg.toByteArray(), "image/jpeg"));

    assertThat(saved.getContentType()).isEqualTo("image/png");
    // Signature PNG : on ne renvoie jamais au navigateur les octets reçus tels quels.
    assertThat(saved.getImage()[0]).isEqualTo((byte) 0x89);
    assertThat(new String(saved.getImage(), 1, 3, java.nio.charset.StandardCharsets.US_ASCII))
        .isEqualTo("PNG");
  }

  @Test
  void refuses_a_file_that_claims_to_be_an_image_but_is_not() {
    MockMultipartFile fake = upload("ceci n'est pas une image".getBytes(), "image/png");

    assertThatThrownBy(() -> service.put(1L, fake))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("image");
  }

  @Test
  void refuses_a_type_it_does_not_print_well() throws IOException {
    assertThatThrownBy(() -> service.put(1L, upload(png(10, 10), "image/gif")))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("PNG ou JPEG");
  }

  @Test
  void refuses_an_upload_heavier_than_the_cap() {
    byte[] heavy = new byte[(int) FarmLogoService.MAX_UPLOAD_BYTES + 1];

    assertThatThrownBy(() -> service.put(1L, upload(heavy, "image/png")))
        .isInstanceOf(ValidationException.class)
        .hasMessageContaining("2 Mo");
  }

  @Test
  void refuses_an_empty_upload() {
    assertThatThrownBy(() -> service.put(1L, upload(new byte[0], "image/png")))
        .isInstanceOf(ValidationException.class);
  }
}
