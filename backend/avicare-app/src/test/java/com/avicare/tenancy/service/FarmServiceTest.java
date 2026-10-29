package com.avicare.tenancy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.security.principal.FarmRole;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.subscription.api.SubscriptionFacade;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.domain.UserFarm;
import com.avicare.tenancy.dto.request.CreateFarmRequest;
import com.avicare.tenancy.dto.request.UpdateFarmRequest;
import com.avicare.tenancy.dto.response.FarmResponse;
import com.avicare.tenancy.mapper.TenancyMapper;
import com.avicare.tenancy.repository.FarmLogoRepository;
import com.avicare.tenancy.repository.FarmRepository;
import com.avicare.tenancy.repository.UserFarmRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/** Unit test for {@link FarmService}: repositories mocked, real MapStruct mapper. */
class FarmServiceTest {

  private FarmRepository farmRepository;
  private FarmLogoRepository farmLogoRepository;
  private UserFarmRepository userFarmRepository;
  private ParametersFacade parametersFacade;
  private SubscriptionFacade subscriptionFacade;
  private FarmService farmService;

  @BeforeEach
  void setUp() {
    farmRepository = Mockito.mock(FarmRepository.class);
    farmLogoRepository = Mockito.mock(FarmLogoRepository.class);
    lenient().when(farmLogoRepository.findUpdatedAt(any())).thenReturn(Optional.empty());
    userFarmRepository = Mockito.mock(UserFarmRepository.class);
    parametersFacade = Mockito.mock(ParametersFacade.class);
    subscriptionFacade = Mockito.mock(SubscriptionFacade.class);
    lenient()
        .when(parametersFacade.resolve(any(), any(), any(), any()))
        .thenReturn(Optional.empty());
    TenancyMapper mapper = Mappers.getMapper(TenancyMapper.class);
    farmService =
        new FarmService(
            farmRepository,
            farmLogoRepository,
            userFarmRepository,
            mapper,
            parametersFacade,
            subscriptionFacade);
  }

  @Test
  void create_grantsCreatorOwnerMembership() {
    when(farmRepository.save(any(Farm.class)))
        .thenAnswer(
            inv -> {
              Farm f = inv.getArgument(0);
              f.setId(10L);
              return f;
            });

    farmService.create(
        7L, new CreateFarmRequest("Ferme A", null, null, null, null, null, null, null, null, null));

    ArgumentCaptor<UserFarm> captor = ArgumentCaptor.forClass(UserFarm.class);
    verify(userFarmRepository).save(captor.capture());
    UserFarm owner = captor.getValue();
    assertThat(owner.getUserId()).isEqualTo(7L);
    assertThat(owner.getFarmId()).isEqualTo(10L);
    assertThat(owner.getRole()).isEqualTo(FarmRole.OWNER);
    assertThat(owner.getPermissions())
        .containsExactlyElementsOf(FarmRole.OWNER.defaultPermissions());
  }

  @Test
  void create_appliesDefaultsAndOverrides() {
    when(farmRepository.save(any(Farm.class))).thenAnswer(inv -> inv.getArgument(0));

    farmService.create(
        1L,
        new CreateFarmRequest(
            "F", null, null, null, null, null, "Europe/Paris", "EUR", null, null));

    ArgumentCaptor<Farm> captor = ArgumentCaptor.forClass(Farm.class);
    verify(farmRepository).save(captor.capture());
    Farm farm = captor.getValue();
    assertThat(farm.getTimezone()).isEqualTo("Europe/Paris");
    assertThat(farm.getCurrency()).isEqualTo("EUR");
    assertThat(farm.getCreatedBy()).isEqualTo(1L);
  }

  /** Le catalogue des pays, tel que la migration V67 le sème. */
  private void catalogue(String iso, String fuseau, String libelle) {
    lenient()
        .when(parametersFacade.resolve(null, null, "countries", iso))
        .thenReturn(Optional.of(java.util.Map.of("timezone", fuseau, "tax_id_label", libelle)));
  }

  @Test
  void create_sansPays_resteAuSenegal() {
    when(farmRepository.save(any(Farm.class))).thenAnswer(inv -> inv.getArgument(0));
    catalogue("SN", "Africa/Dakar", "NINEA");

    // Une app iOS déjà installée n'envoie pas de pays : elle ne doit pas se voir refuser, ni
    // produire une ferme sans pays.
    FarmResponse reponse =
        farmService.create(
            1L, new CreateFarmRequest("F", null, null, null, null, null, null, null, null, null));

    assertThat(reponse.country()).isEqualTo("SN");
    assertThat(reponse.taxIdLabel()).isEqualTo("NINEA");
  }

  @Test
  void create_avecLaCoteDIvoire_enDeduitFuseauEtLibelleFiscal() {
    when(farmRepository.save(any(Farm.class))).thenAnswer(inv -> inv.getArgument(0));
    catalogue("CI", "Africa/Abidjan", "N° contribuable");

    FarmResponse reponse =
        farmService.create(
            1L, new CreateFarmRequest("F", null, null, null, null, null, null, null, null, "CI"));

    ArgumentCaptor<Farm> captor = ArgumentCaptor.forClass(Farm.class);
    verify(farmRepository).save(captor.capture());
    assertThat(captor.getValue().getCountry()).isEqualTo("CI");
    // Le défaut vivait en Java (`private String timezone = "Africa/Dakar"`), donc le défaut SQL
    // n'était jamais atteint : sans ce test, une ferme ivoirienne resterait à l'heure de Dakar.
    assertThat(captor.getValue().getTimezone()).isEqualTo("Africa/Abidjan");
    assertThat(reponse.taxIdLabel()).isEqualTo("N° contribuable");
  }

  @Test
  void create_unFuseauExplicite_gagneSurCeluiDuPays() {
    when(farmRepository.save(any(Farm.class))).thenAnswer(inv -> inv.getArgument(0));
    catalogue("CI", "Africa/Abidjan", "N° contribuable");

    farmService.create(
        1L,
        new CreateFarmRequest("F", null, null, null, null, null, "Europe/Paris", null, null, "CI"));

    ArgumentCaptor<Farm> captor = ArgumentCaptor.forClass(Farm.class);
    verify(farmRepository).save(captor.capture());
    assertThat(captor.getValue().getTimezone()).isEqualTo("Europe/Paris");
  }

  @Test
  void create_unPaysAbsentDuCatalogue_neLevePasEtRetombeSurLesDefauts() {
    when(farmRepository.save(any(Farm.class))).thenAnswer(inv -> inv.getArgument(0));
    // 'FR' est dans le sélecteur de téléphone mais hors zone XOF : la migration ne le sème pas.
    // Un éleveur ivoirien au numéro français ne doit pas faire tomber la création de sa ferme.
    FarmResponse reponse =
        farmService.create(
            1L, new CreateFarmRequest("F", null, null, null, null, null, null, null, null, "FR"));

    ArgumentCaptor<Farm> captor = ArgumentCaptor.forClass(Farm.class);
    verify(farmRepository).save(captor.capture());
    assertThat(captor.getValue().getCountry()).isEqualTo("FR");
    assertThat(captor.getValue().getTimezone()).isEqualTo("Africa/Dakar");
    assertThat(reponse.taxIdLabel()).isEqualTo("NINEA");
  }

  @Test
  void update_sansPays_neRamenePasLaFermeAuSenegal() {
    Farm existante = new Farm();
    existante.setId(10L);
    existante.setCountry("CI");
    existante.setTimezone("Africa/Abidjan");
    when(farmRepository.findById(10L)).thenReturn(Optional.of(existante));
    when(farmRepository.save(any(Farm.class))).thenAnswer(inv -> inv.getArgument(0));
    catalogue("CI", "Africa/Abidjan", "N° contribuable");

    // Un client qui ne connaît pas encore le champ l'omet. Ce PUT remplace les champs omis —
    // appliquer la règle au pays ramènerait silencieusement toutes les fermes au Sénégal.
    farmService.update(
        10L,
        new UpdateFarmRequest(
            "F", null, null, null, null, null, null, null, null, null, null, null));

    assertThat(existante.getCountry()).isEqualTo("CI");
    assertThat(existante.getTimezone()).isEqualTo("Africa/Abidjan");
  }
}
