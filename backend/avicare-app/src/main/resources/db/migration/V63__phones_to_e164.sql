-- Phone numbers: one canonical shape, E.164 with its leading '+'.
--
-- Production held five shapes at once: '+221774244267', '221704756996', '78 429 83 11',
-- '0160060633' and '789400956'. The WhatsApp normalizer had to guess which was which, guessed
-- '221' for everything foreign, and on 2026-10-06 turned three Beninese numbers into sixteen-digit
-- strangers. The fix in the code reads the '+' instead of destroying it; this migration makes the
-- stored data say the '+' in the first place.
--
-- DELIBERATELY CONSERVATIVE. Only shapes that can be read one way are rewritten:
--   * already '+<digits>'            -> whitespace and punctuation stripped, kept as-is
--   * '221' + 9 digits               -> '+221…'
--   * 9 digits starting 7 (Senegal)  -> '+221…'
-- Everything else is LEFT ALONE on purpose. A bare '0160060633' can be read as a Senegalese
-- number missing its country code or as a Beninese one missing its '+229', and no SQL can tell.
-- Rewriting it would be inventing data. Measured on production 2026-10-08: 18 rows already
-- correct, 14 rewritten, 5 left ambiguous (0154327852, 0160060633 x3, 0190181930). To list what
-- is still ambiguous after this migration, and settle it by hand through the country selector:
--
--   SELECT 'users' AS src, id, phone FROM users WHERE phone !~ '^\+[0-9]{10,15}$'
--   UNION ALL SELECT 'clients', id, phone FROM clients WHERE phone !~ '^\+[0-9]{10,15}$'
--   UNION ALL SELECT 'suppliers', id, phone FROM suppliers WHERE phone !~ '^\+[0-9]{10,15}$'
--   UNION ALL SELECT 'veterinarians', id, phone FROM veterinarians WHERE phone !~ '^\+[0-9]{10,15}$'
--   UNION ALL SELECT 'partners', id, contact_phone FROM partners WHERE contact_phone !~ '^\+[0-9]{10,15}$';

CREATE OR REPLACE FUNCTION pg_temp.to_e164(raw TEXT) RETURNS TEXT AS $$
DECLARE
  digits TEXT;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN raw;
  END IF;
  digits := regexp_replace(raw, '\D', '', 'g');
  IF digits = '' THEN
    RETURN raw;
  END IF;
  -- Carries its own country code, written '+' or '00'.
  IF btrim(raw) LIKE '+%' THEN
    RETURN '+' || digits;
  END IF;
  IF digits LIKE '00%' THEN
    RETURN '+' || substring(digits from 3);
  END IF;
  -- Senegal, country code already present but no '+'.
  IF digits ~ '^221[0-9]{9}$' THEN
    RETURN '+' || digits;
  END IF;
  -- Senegal, bare local mobile: nine digits opening on a 7.
  IF digits ~ '^7[0-9]{8}$' THEN
    RETURN '+221' || digits;
  END IF;
  -- Ambiguous: leave untouched rather than invent a country.
  RETURN raw;
END;
$$ LANGUAGE plpgsql;

UPDATE users          SET phone         = pg_temp.to_e164(phone)         WHERE phone IS NOT NULL;
UPDATE clients        SET phone         = pg_temp.to_e164(phone)         WHERE phone IS NOT NULL;
UPDATE suppliers      SET phone         = pg_temp.to_e164(phone)         WHERE phone IS NOT NULL;
UPDATE veterinarians  SET phone         = pg_temp.to_e164(phone)         WHERE phone IS NOT NULL;
UPDATE partners       SET contact_phone = pg_temp.to_e164(contact_phone) WHERE contact_phone IS NOT NULL;
