package com.avicare.tenancy.service;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.tenancy.domain.FarmLogo;
import com.avicare.tenancy.repository.FarmLogoRepository;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Set;
import javax.imageio.ImageIO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Le logo que l'éleveur pose sur ses factures.
 *
 * <p>L'image est <b>redimensionnée à l'entrée</b>, une fois pour toutes. Elle sera embarquée dans
 * chaque facture générée, sur des téléphones d'entrée de gamme et des connexions lentes : accepter
 * telle quelle une photo de 4 Mo sortie d'un appareil ferait payer ce poids à chaque impression.
 * {@value #MAX_EDGE} px de côté suffisent largement à un logo imprimé en 56 px de haut, même sur
 * une imprimante fine.
 *
 * <p>Toujours réencodée en PNG, jamais réémise telle quelle : on ne renvoie donc jamais au
 * navigateur des octets arbitraires reçus d'un client, et le canal alpha d'un logo détouré survit.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FarmLogoService {

  /** Au-delà, l'image est réduite. Un logo de facture n'a pas besoin de plus. */
  static final int MAX_EDGE = 512;

  /** Taille maximale acceptée en entrée, avant redimensionnement. */
  static final long MAX_UPLOAD_BYTES = 2L * 1024 * 1024;

  private static final Set<String> ACCEPTED = Set.of("image/png", "image/jpeg", "image/jpg");
  private static final String STORED_TYPE = "image/png";

  private final FarmLogoRepository farmLogoRepository;

  @Transactional(readOnly = true)
  public FarmLogo get(Long farmId) {
    return farmLogoRepository
        .findById(farmId)
        .orElseThrow(
            () -> new NotFoundException("FARM_LOGO_NOT_FOUND", "Cette ferme n'a pas de logo."));
  }

  @Transactional
  public FarmLogo put(Long farmId, MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ValidationException("FARM_LOGO_EMPTY", "Aucune image reçue.");
    }
    if (file.getSize() > MAX_UPLOAD_BYTES) {
      throw new ValidationException(
          "FARM_LOGO_TOO_LARGE", "L'image ne doit pas dépasser 2 Mo. Celle-ci est plus lourde.");
    }
    String declared = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
    if (!ACCEPTED.contains(declared)) {
      throw new ValidationException(
          "FARM_LOGO_BAD_TYPE", "Le logo doit être une image PNG ou JPEG.");
    }

    byte[] png = normalise(file);

    // Un seul logo par ferme : le nouveau remplace l'ancien, sur place.
    FarmLogo logo = farmLogoRepository.findById(farmId).orElseGet(FarmLogo::new);
    logo.setFarmId(farmId);
    logo.setImage(png);
    logo.setContentType(STORED_TYPE);
    return farmLogoRepository.saveAndFlush(logo);
  }

  @Transactional
  public void delete(Long farmId) {
    farmLogoRepository.deleteById(farmId);
  }

  /**
   * Décode, réduit si besoin, réencode en PNG.
   *
   * <p>Le décodage fait aussi office de contrôle : un fichier qui annonce {@code image/png} sans en
   * être un ne produit pas d'image et se voit refusé ici, pas plus loin.
   */
  private byte[] normalise(MultipartFile file) {
    BufferedImage source;
    try {
      source = ImageIO.read(file.getInputStream());
    } catch (IOException e) {
      log.warn("Logo de ferme illisible", e);
      throw new ValidationException("FARM_LOGO_UNREADABLE", "Cette image n'a pas pu être lue.");
    }
    if (source == null) {
      throw new ValidationException(
          "FARM_LOGO_UNREADABLE", "Ce fichier n'est pas une image valide.");
    }

    BufferedImage scaled = scaleWithin(source, MAX_EDGE);
    try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      if (!ImageIO.write(scaled, "png", out)) {
        throw new ValidationException("FARM_LOGO_UNREADABLE", "Cette image n'a pas pu être lue.");
      }
      return out.toByteArray();
    } catch (IOException e) {
      log.warn("Réencodage du logo impossible", e);
      throw new ValidationException("FARM_LOGO_UNREADABLE", "Cette image n'a pas pu être lue.");
    }
  }

  /** Réduit l'image pour tenir dans un carré de {@code maxEdge}, sans jamais l'agrandir. */
  private BufferedImage scaleWithin(BufferedImage source, int maxEdge) {
    int w = source.getWidth();
    int h = source.getHeight();
    if (w <= maxEdge && h <= maxEdge) {
      // Déjà assez petite — on la réencode quand même, pour ne pas stocker d'octets d'origine.
      return toArgb(source);
    }
    double ratio = Math.min((double) maxEdge / w, (double) maxEdge / h);
    int tw = Math.max(1, (int) Math.round(w * ratio));
    int th = Math.max(1, (int) Math.round(h * ratio));

    BufferedImage out = new BufferedImage(tw, th, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = out.createGraphics();
    g.setRenderingHint(
        RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.drawImage(source, 0, 0, tw, th, null);
    g.dispose();
    return out;
  }

  /** Repasse en ARGB : un JPEG décodé n'a pas de canal alpha, le PNG de sortie en veut un. */
  private BufferedImage toArgb(BufferedImage source) {
    if (source.getType() == BufferedImage.TYPE_INT_ARGB) {
      return source;
    }
    BufferedImage out =
        new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = out.createGraphics();
    g.drawImage(source, 0, 0, null);
    g.dispose();
    return out;
  }
}
