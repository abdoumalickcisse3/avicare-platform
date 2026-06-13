#!/usr/bin/env bash
# B3-6 — Health module full-stack E2E (programmatic, authoritative).
# Boots against a running backend (localhost:8080) with gating ENABLED, so the
# basic/advanced split and cross-farm guard are exercised for real. Not a CI
# artifact — run manually after a jar boot. Idempotent via timestamped emails.
set -uo pipefail

BASE="http://localhost:8080"
TS=$(date +%s)
PASS=0; FAIL=0
TODAY=$(date +%F)
START=$(date -v-30d +%F)
FOLLOWUP=$(date -v+15d +%F)
PW="Password123!"

ok()  { PASS=$((PASS+1)); printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad() { FAIL=$((FAIL+1)); printf "  \033[31m✗ %s\033[0m\n" "$1"; }
chk() { if [ "$1" = "$2" ]; then ok "$3 ($1)"; else bad "$3 — attendu $2, obtenu $1"; fi; }

# Body POST returning a JSON string; status POST/GET returning the HTTP code.
jbody() { curl -s -X "$1" "$BASE$2" -H "Authorization: Bearer $3" -H "Content-Type: application/json" -d "$4"; }
scode() { curl -s -o /dev/null -w "%{http_code}" -X "$1" "$BASE$2" -H "Authorization: Bearer $3" -H "Content-Type: application/json" -d "$4"; }
gcode() { curl -s -o /dev/null -w "%{http_code}" "$BASE$1" -H "Authorization: Bearer $2"; }
login() { curl -s -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | jq -r '.data.accessToken'; }

echo "▶ E2E santé — start lot=$START today=$TODAY"
chk "$(curl -s -o /dev/null -w '%{http_code}' $BASE/actuator/health)" "200" "Backend UP"

# 1. OWNER
EMAIL="e2e-health-$TS@test.io"
curl -s -X POST "$BASE/api/v1/auth/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"fullName\":\"E2E Owner\"}" >/dev/null
TOKEN=$(login "$EMAIL")
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && ok "Signup+login OWNER" || { bad "login"; exit 1; }

# 2. Farm + re-login (membership claim in token)
FARM=$(jbody POST /api/v1/farms "$TOKEN" '{"name":"Ferme Sanitaire Test"}' | jq -r '.data.id')
chk "$([ -n "$FARM" ] && [ "$FARM" != null ] && echo ok)" "ok" "Ferme créée (id=$FARM)"
TOKEN=$(login "$EMAIL")

# 3. Enable broiler (lot creation gated) + health.basic (advanced later — split test)
chk "$(scode POST /api/v1/farms/$FARM/subscription/modules "$TOKEN" '{"moduleKey":"module.poultry.broiler","mode":"HARD"}')" "201" "Module poultry.broiler activé"
chk "$(scode POST /api/v1/farms/$FARM/subscription/modules "$TOKEN" '{"moduleKey":"module.health.basic","mode":"HARD"}')" "201" "Module health.basic activé"

# 4. Breed cobb_500 → broiler batch (start -30j)
BREED=$(curl -s "$BASE/api/v1/breeds?species=POULTRY" -H "Authorization: Bearer $TOKEN" | jq -r '.data[]|select(.code=="cobb_500")|.id')
chk "$([ -n "$BREED" ] && echo ok)" "ok" "Souche cobb_500 (id=$BREED)"
UNIT=$(jbody POST /api/v1/farms/$FARM/poultry-batches "$TOKEN" "{\"breedId\":$BREED,\"name\":\"Bâtiment A - Lot 1\",\"startDate\":\"$START\",\"initialCount\":5000}" | jq -r '.data.id')
chk "$([ -n "$UNIT" ] && [ "$UNIT" != null ] && echo ok)" "ok" "Lot chair créé (unitId=$UNIT, 5000 sujets)"

# 5. Assign program + schedule (all LATE: lot is 30d old)
chk "$(scode POST /api/v1/farms/$FARM/health/lots/$UNIT/program "$TOKEN" '{"programKey":"broiler_standard_cobb500"}')" "201" "Programme broiler_standard_cobb500 assigné"
SCHED=$(jbody GET /api/v1/farms/$FARM/health/lots/$UNIT/program/schedule "$TOKEN" '')
chk "$(echo "$SCHED" | jq '.data|length')" "5" "Schedule: 5 doses"
chk "$(echo "$SCHED" | jq '[.data[]|select(.status=="LATE")]|length')" "5" "Schedule: 5 LATE (lot 30j)"

# 6. Vaccination newcastle_la_sota → DONE
VAC_JSON="{\"unitId\":$UNIT,\"vaccineKey\":\"newcastle_la_sota\",\"administeredDate\":\"$TODAY\",\"subjectsCount\":5000,\"route\":\"OCULAR\"}"
ST=$(scode POST /api/v1/farms/$FARM/health/vaccinations "$TOKEN" "$VAC_JSON")
chk "$ST" "201" "Vaccination newcastle_la_sota enregistrée"
SCHED2=$(jbody GET /api/v1/farms/$FARM/health/lots/$UNIT/program/schedule "$TOKEN" '')
chk "$(echo "$SCHED2" | jq '[.data[]|select(.status=="DONE")]|length')" "1" "Schedule: 1 DONE"
chk "$(echo "$SCHED2" | jq '[.data[]|select(.status=="LATE")]|length')" "4" "Schedule: 4 LATE"

# 7. Observation CRITICAL
OBS_JSON="{\"unitId\":$UNIT,\"observationDate\":\"$TODAY\",\"severity\":\"CRITICAL\",\"title\":\"Mortalite aigue\"}"
ST=$(scode POST /api/v1/farms/$FARM/health/observations "$TOKEN" "$OBS_JSON")
chk "$ST" "201" "Observation CRITICAL enregistrée"

# 8. GATING (basic only): advanced 403, basic 200
chk "$(gcode "/api/v1/farms/$FARM/health/treatments?unitId=$UNIT" "$TOKEN")" "403" "GATING basic: GET treatments → 403"
chk "$(gcode "/api/v1/farms/$FARM/health/veterinarians" "$TOKEN")" "403" "GATING basic: GET veterinarians → 403"
chk "$(gcode "/api/v1/farms/$FARM/health/vaccinations?unitId=$UNIT" "$TOKEN")" "200" "GATING basic: GET vaccinations → 200"

# 9. Alerts (basic only): vaccins + obs, NO advanced sections
A1=$(jbody GET /api/v1/farms/$FARM/health/alerts "$TOKEN" '')
chk "$(echo "$A1" | jq '.data.vaccinationsLate|length')" "4" "Alerts basic: vaccinationsLate=4"
chk "$(echo "$A1" | jq '.data.criticalObservations|length')" "1" "Alerts basic: criticalObservations=1"
chk "$(echo "$A1" | jq '.data.activeWithdrawals|length')" "0" "Alerts basic: activeWithdrawals=0 (advanced off)"
chk "$(echo "$A1" | jq '.data.upcomingFollowUps|length')" "0" "Alerts basic: upcomingFollowUps=0 (advanced off)"

# 10. Enable ADVANCED
chk "$(scode POST /api/v1/farms/$FARM/subscription/modules "$TOKEN" '{"moduleKey":"module.health.advanced","mode":"HARD"}')" "201" "Module health.advanced activé"
chk "$(gcode "/api/v1/farms/$FARM/health/treatments?unitId=$UNIT" "$TOKEN")" "200" "GATING advanced: GET treatments → 200"

# 11. Veterinarian
VET=$(jbody POST /api/v1/farms/$FARM/health/veterinarians "$TOKEN" '{"fullName":"Dr. Diop","phone":"+221 77 123 45 67","speciality":"Aviculture","location":"Dakar"}' | jq -r '.data.id')
chk "$([ -n "$VET" ] && [ "$VET" != null ] && echo ok)" "ok" "Vétérinaire Dr. Diop créé (id=$VET)"

# 12. Treatment amoxicillin_50 with vet (withdrawal computed)
TRT=$(jbody POST /api/v1/farms/$FARM/health/treatments "$TOKEN" "{\"unitId\":$UNIT,\"treatmentKey\":\"amoxicillin_50\",\"startDate\":\"$TODAY\",\"durationDays\":5,\"doseAmount\":200,\"doseUnit\":\"g/1000L\",\"route\":\"WATER\",\"subjectsCount\":100,\"reason\":\"Suite mortalite\",\"prescribedBy\":\"VETERINARIAN\",\"veterinarianId\":$VET}")
chk "$(echo "$TRT" | jq -r 'if .data.withdrawalEndDateMeat != null then "ok" else "no" end')" "ok" "Traitement amoxicillin_50 (withdrawalEndDateMeat=$(echo "$TRT" | jq -r '.data.withdrawalEndDateMeat'))"

# 13. active-withdrawals
chk "$(jbody GET "/api/v1/farms/$FARM/health/treatments/active-withdrawals?unitId=$UNIT" "$TOKEN" '' | jq '.data|length')" "1" "active-withdrawals: 1 traitement"

# 14. Vet visit + follow-up
VV_JSON="{\"unitId\":$UNIT,\"veterinarianId\":$VET,\"visitDate\":\"$TODAY\",\"reason\":\"Controle\",\"followUpNeeded\":true,\"followUpDate\":\"$FOLLOWUP\"}"
ST=$(scode POST /api/v1/farms/$FARM/health/vet-visits "$TOKEN" "$VV_JSON")
chk "$ST" "201" "Visite véto + follow-up enregistrée"

# 15. Alerts (advanced): all 4 sections
A2=$(jbody GET /api/v1/farms/$FARM/health/alerts "$TOKEN" '')
chk "$(echo "$A2" | jq '.data.vaccinationsLate|length')" "4" "Alerts full: vaccinationsLate=4"
chk "$(echo "$A2" | jq '.data.activeWithdrawals|length')" "1" "Alerts full: activeWithdrawals=1"
chk "$(echo "$A2" | jq '.data.criticalObservations|length')" "1" "Alerts full: criticalObservations=1"
chk "$(echo "$A2" | jq '.data.upcomingFollowUps|length')" "1" "Alerts full: upcomingFollowUps=1"

# 16. Cross-farm guard: 2nd farm's unit via farm1 → 404
EMAIL2="e2e-health2-$TS@test.io"
curl -s -X POST "$BASE/api/v1/auth/signup" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"$PW\",\"fullName\":\"E2E Owner2\"}" >/dev/null
TOKEN2=$(login "$EMAIL2")
FARM2=$(jbody POST /api/v1/farms "$TOKEN2" '{"name":"Autre Ferme"}' | jq -r '.data.id')
TOKEN2=$(login "$EMAIL2")
scode POST /api/v1/farms/$FARM2/subscription/modules "$TOKEN2" '{"moduleKey":"module.poultry.broiler","mode":"HARD"}' >/dev/null
scode POST /api/v1/farms/$FARM2/subscription/modules "$TOKEN2" '{"moduleKey":"module.health.basic","mode":"HARD"}' >/dev/null
BREED2=$(curl -s "$BASE/api/v1/breeds?species=POULTRY" -H "Authorization: Bearer $TOKEN2" | jq -r '.data[]|select(.code=="cobb_500")|.id')
UNIT2=$(jbody POST /api/v1/farms/$FARM2/poultry-batches "$TOKEN2" "{\"breedId\":$BREED2,\"name\":\"L2\",\"startDate\":\"$TODAY\",\"initialCount\":100}" | jq -r '.data.id')
chk "$(gcode "/api/v1/farms/$FARM/health/vaccinations?unitId=$UNIT2" "$TOKEN")" "404" "Cross-farm: unit ferme2 via ferme1 → 404"

echo ""
echo "════════════════════════════════════"
printf "  Résultat : \033[32m%d OK\033[0m / \033[31m%d KO\033[0m\n" "$PASS" "$FAIL"
echo "════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
