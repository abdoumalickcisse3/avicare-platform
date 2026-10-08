-- One phone number, one account.
--
-- Until 2026-10-08 nothing forbade two accounts carrying the same number, and two did:
-- +2290169566061 belonged to both 'zoclibenoit513@gmail.com' (created 22 Sept, signed in once,
-- never again) and 'zoclibenoit51@gmail.com' (still signing in). The duplicate was cleared by
-- hand before this migration; the index is what stops the next one.
--
-- It matters now because sign-in accepts a phone number. An ambiguous number has no good
-- answer: picking one account would hand somebody a way into a stranger's farm, and refusing
-- leaves a person unable to sign in without knowing why. The only kind fix is upstream — make
-- the ambiguity impossible.
--
-- Indexed on the DIGITS, not the text: '+221 77 184 27 87' and '221771842787' are the same
-- number, and a plain unique index on the column would happily let both exist.
CREATE UNIQUE INDEX ux_users_phone_digits
  ON users ((regexp_replace(phone, '[^0-9]', '', 'g')))
  WHERE phone IS NOT NULL AND btrim(phone) <> '';
