-- V71 — Enquête terrain auprès des éleveurs (Sénégal, Côte d'Ivoire, Bénin, puis le reste).
--
-- Table EN AJOUT SEUL : une réponse d'enquête ne se corrige pas, on en reçoit une autre. D'où
-- l'absence de deleted_at et de updated_at, et l'absence de trigger : rien n'est jamais modifié.
--
-- Aucun farm_id, aucun user_id : un répondant n'est pas un client, et la plupart ne le seront
-- jamais. C'est la seule table métier de la plateforme qui ne soit pas multi-tenant, et c'est
-- délibéré.
--
-- ip_hash est une EMPREINTE SHA-256 de l'adresse, jamais l'adresse : assez pour compter les
-- réponses d'un même appelant et repérer un robot, rien pour identifier quelqu'un.
--
-- phone est stocké tel que saisi. La normalisation E.164 appartient au contexte notification,
-- d'où partent réellement les messages WhatsApp ; normaliser deux fois, c'est créer deux vérités.

CREATE TABLE survey_responses (
    id                     BIGSERIAL PRIMARY KEY,

    -- où
    country                VARCHAR(2)  NOT NULL,
    region                 VARCHAR(120) NOT NULL,
    commune                VARCHAR(120),
    referrer               VARCHAR(200),

    -- l'élevage
    flock_type             VARCHAR(20) NOT NULL CHECK (flock_type IN ('BROILER','LAYER','BOTH','HATCHERY')),
    current_birds          INTEGER     NOT NULL CHECK (current_birds >= 0),
    batches_last_12_months INTEGER     CHECK (batches_last_12_months >= 0),
    started_year           INTEGER     CHECK (started_year BETWEEN 1900 AND 2100),
    workers                INTEGER     CHECK (workers >= 0),

    -- la dernière bande
    last_batch_month       DATE,
    birds_placed           INTEGER     CHECK (birds_placed >= 0),
    chick_price            NUMERIC(12,2) CHECK (chick_price >= 0),
    birds_died             INTEGER     CHECK (birds_died >= 0),
    feed_bags              INTEGER     CHECK (feed_bags >= 0),
    last_bag_price         NUMERIC(12,2) CHECK (last_bag_price >= 0),
    last_bag_brand         VARCHAR(120),
    last_bag_month         DATE,

    -- chez qui il achète
    feed_supplier          VARCHAR(200),
    payment_terms          VARCHAR(10) CHECK (payment_terms IN ('CASH','CREDIT')),
    credit_days            INTEGER     CHECK (credit_days >= 0),
    credit_costs_more      BOOLEAN,
    raw_material_prices    VARCHAR(1000),

    -- à qui il vend
    main_buyer             VARCHAR(20) CHECK (main_buyer IN ('RESELLER','SHOPKEEPER','RESTAURANT','INDIVIDUALS','WHOLESALER','SUPERMARKET','OTHER')),
    last_sale_price        NUMERIC(12,2) CHECK (last_sale_price >= 0),
    last_sale_unit         VARCHAR(20) CHECK (last_sale_unit IN ('EGG_TRAY','LIVE_BIRD')),
    last_sale_month        DATE,
    payment_delay          VARCHAR(20) CHECK (payment_delay IN ('IMMEDIATE','UNDER_WEEK','ONE_TO_FOUR_WEEKS','OVER_MONTH','VARIES')),

    -- quand ça va mal
    first_call             VARCHAR(20) CHECK (first_call IN ('VET','FEED_TECHNICIAN','WHATSAPP_GROUP','NEIGHBOUR','NOBODY')),
    last_incident_cost     NUMERIC(12,2) CHECK (last_incident_cost >= 0),

    -- l'outil
    record_keeping         VARCHAR(20) CHECK (record_keeping IN ('NOTEBOOK','MEMORY','SPREADSHEET','APP','NOTHING')),
    willingness_to_pay     VARCHAR(30) CHECK (willingness_to_pay IN ('NOTHING','UNDER_5K','FROM_5K_TO_15K','FROM_15K_TO_30K','OVER_30K','ONLY_IF_OTHERS_PAY')),
    has_quit               BOOLEAN,
    quit_reason            VARCHAR(1000),

    -- la contrepartie promise
    phone                  VARCHAR(32),
    accepts_interview      BOOLEAN,

    -- anti-abus
    ip_hash                VARCHAR(64),

    created_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

-- L'agrégation publique groupe par pays puis par région : c'est le seul chemin de lecture.
CREATE INDEX idx_survey_responses_area ON survey_responses(country, region);

-- Compter ce qu'une même adresse a déposé depuis une date : le robot patient, celui qui revient
-- toutes les heures et que le limiteur de débit ne voit pas.
CREATE INDEX idx_survey_responses_ip_hash ON survey_responses(ip_hash, created_at);

-- Relancer ceux qui ont accepté un entretien, sans balayer toute la table.
CREATE INDEX idx_survey_responses_interview ON survey_responses(accepts_interview) WHERE accepts_interview IS TRUE;
