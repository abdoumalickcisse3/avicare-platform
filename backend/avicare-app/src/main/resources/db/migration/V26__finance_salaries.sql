-- V26 — Finance P2 (Sprint B6) : salaires par membre + avances.
-- Employé = membre de la ferme (user_id -> users). Complète V25 : ajoute la FK
-- différée expenses.salary_id (colonne créée nullable en V25, table absente alors).

CREATE TABLE salary_settings (
    id                  BIGSERIAL PRIMARY KEY,
    farm_id             BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    monthly_salary_xof  BIGINT NOT NULL CHECK (monthly_salary_xof > 0),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id)
);
CREATE TRIGGER trg_salary_settings_updated_at
    BEFORE UPDATE ON salary_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE salaries (
    id                    BIGSERIAL PRIMARY KEY,
    farm_id               BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period                CHAR(7) NOT NULL,
    gross_xof             BIGINT NOT NULL CHECK (gross_xof > 0),
    advance_deducted_xof  BIGINT NOT NULL DEFAULT 0 CHECK (advance_deducted_xof >= 0),
    net_xof               BIGINT NOT NULL CHECK (net_xof >= 0),
    status                VARCHAR(10) NOT NULL CHECK (status IN ('DUE','PAID')),
    paid_at               TIMESTAMP,
    created_by            BIGINT NOT NULL REFERENCES users(id),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (farm_id, user_id, period)
);
CREATE INDEX idx_salaries_farm_period ON salaries(farm_id, period);
CREATE TRIGGER trg_salaries_updated_at
    BEFORE UPDATE ON salaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE salary_advances (
    id             BIGSERIAL PRIMARY KEY,
    farm_id        BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_xof     BIGINT NOT NULL CHECK (amount_xof > 0),
    reason         VARCHAR(200),
    status         VARCHAR(10) NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    requested_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    decided_by     BIGINT REFERENCES users(id),
    decided_at     TIMESTAMP,
    remaining_xof  BIGINT NOT NULL DEFAULT 0 CHECK (remaining_xof >= 0),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_salary_advances_farm_status ON salary_advances(farm_id, status);
CREATE INDEX idx_salary_advances_user ON salary_advances(farm_id, user_id);
CREATE TRIGGER trg_salary_advances_updated_at
    BEFORE UPDATE ON salary_advances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FK différée depuis V25 (expenses.salary_id créé nullable sans contrainte).
ALTER TABLE expenses
    ADD CONSTRAINT fk_expenses_salary FOREIGN KEY (salary_id) REFERENCES salaries(id);
