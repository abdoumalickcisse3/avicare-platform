#!/usr/bin/env bash
# B4-8 — Inventory module full-stack E2E (programmatic, authoritative).
# Boots against a running backend (localhost:8080) with gating ENABLED, so the
# module.inventory gate (403), the Option α coupling guard (422) and the
# cross-farm guard (404) are exercised for real. Not a CI artifact — run after a
# jar boot with `--avicare.features.gating-enabled=true`. Idempotent via
# timestamped emails.
set -uo pipefail

BASE="http://localhost:8080"
TS=$(date +%s)
PASS=0; FAIL=0
TODAY=$(date +%F)
START=$(date -v-30d +%F)
PW="Password123!"

ok()  { PASS=$((PASS+1)); printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad() { FAIL=$((FAIL+1)); printf "  \033[31m✗ %s\033[0m\n" "$1"; }
chk() { if [ "$1" = "$2" ]; then ok "$3 ($1)"; else bad "$3 — attendu $2, obtenu $1"; fi; }

jbody() { curl -s -X "$1" "$BASE$2" -H "Authorization: Bearer $3" -H "Content-Type: application/json" -d "$4"; }
scode() { curl -s -o /dev/null -w "%{http_code}" -X "$1" "$BASE$2" -H "Authorization: Bearer $3" -H "Content-Type: application/json" -d "$4"; }
gcode() { curl -s -o /dev/null -w "%{http_code}" "$BASE$1" -H "Authorization: Bearer $2"; }
login() { curl -s -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | jq -r '.data.accessToken'; }
provision() { # email name -> token (signup + login)
  curl -s -X POST "$BASE/api/v1/auth/signup" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PW\",\"fullName\":\"$2\"}" >/dev/null
  login "$1"
}

echo "▶ E2E inventory — $TODAY (gating doit être ON)"
chk "$(curl -s -o /dev/null -w '%{http_code}' $BASE/actuator/health)" "200" "Backend UP"

# 1-2. OWNER + farm + ferme_complete plan (all V1 modules)
EMAIL="e2e-inv-$TS@test.io"
TOKEN=$(provision "$EMAIL" "E2E Inventory")
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && ok "Signup+login OWNER" || { bad "login"; exit 1; }
FARM=$(jbody POST /api/v1/farms "$TOKEN" '{"name":"Ferme Inventory Test"}' | jq -r '.data.id')
chk "$([ -n "$FARM" ] && [ "$FARM" != null ] && echo ok)" "ok" "Ferme créée (id=$FARM)"
TOKEN=$(login "$EMAIL")
chk "$(scode POST /api/v1/farms/$FARM/subscription/plan "$TOKEN" '{"planKey":"ferme_complete"}')" "200" "Plan ferme_complete appliqué"
INV="/api/v1/farms/$FARM/inventory"

# 3-4. Broiler batch
BREED=$(curl -s "$BASE/api/v1/breeds?species=POULTRY" -H "Authorization: Bearer $TOKEN" | jq -r '.data[]|select(.code=="cobb_500")|.id')
UNIT=$(jbody POST /api/v1/farms/$FARM/poultry-batches "$TOKEN" "{\"breedId\":$BREED,\"name\":\"Lot 1\",\"startDate\":\"$START\",\"initialCount\":5000}" | jq -r '.data.id')
chk "$([ -n "$UNIT" ] && [ "$UNIT" != null ] && echo ok)" "ok" "Lot chair Cobb 500 créé (unitId=$UNIT)"

# 5. Supplier
SUP=$(jbody POST $INV/suppliers "$TOKEN" '{"commercialName":"Sénégal Aliment Co","types":["FEED"],"city":"Thiès"}' | jq -r '.data.id')
chk "$([ -n "$SUP" ] && [ "$SUP" != null ] && echo ok)" "ok" "Fournisseur créé (id=$SUP)"

# 6-8. Purchase order DRAFT → SENT → RECEIVED
PO=$(jbody POST $INV/purchase-orders "$TOKEN" "{\"supplierId\":$SUP,\"lines\":[{\"articleKey\":\"feed_starter_broiler\",\"articleSource\":\"INVENTORY\",\"orderedQuantity\":100,\"unitPriceXof\":500}]}")
POID=$(echo "$PO" | jq -r '.data.id')
chk "$(echo "$PO" | jq -r '.data.status')" "DRAFT" "PO créé DRAFT"
chk "$(echo "$PO" | jq -r '.data.orderNumber' | grep -c '^BC-')" "1" "PO orderNumber BC-*"
ITEMID=$(echo "$PO" | jq -r '.data.items[0].id')
SUBMIT=$(jbody POST $INV/purchase-orders/$POID/submit "$TOKEN" '')
chk "$(echo "$SUBMIT" | jq -r '.data.status')" "SENT" "PO submit → SENT"
RECV=$(jbody POST $INV/purchase-orders/$POID/receive "$TOKEN" "{\"lines\":[{\"itemId\":$ITEMID,\"receivedQuantity\":100}]}")
chk "$(echo "$RECV" | jq -r '.data.status')" "RECEIVED" "PO receive → RECEIVED"

# 9-10. Stock created + IN movement backref purchase_order_id
SID=$(jbody GET $INV/stock-items "$TOKEN" '' | jq -r '.data[]|select(.articleKey=="feed_starter_broiler")|.id')
chk "$(jbody GET $INV/stock-items "$TOKEN" '' | jq -r '.data[]|select(.articleKey=="feed_starter_broiler")|.currentQuantity')" "100.000" "Stock feed_starter_broiler = 100kg"
chk "$(jbody GET "$INV/movements?stockItemId=$SID" "$TOKEN" '' | jq '[.data[]|select(.movementType=="IN" and .purchaseOrderId=='"$POID"')]|length')" "1" "Mouvement IN backref purchase_order_id"

# 11. D18 — daily record with feedConsumption → OUT, stock 70
DR=$(jbody POST /api/v1/farms/$FARM/poultry-batches/$UNIT/daily-records "$TOKEN" "{\"recordDate\":\"$TODAY\",\"mortalityCount\":0,\"feedKg\":30,\"feedConsumption\":{\"articleKey\":\"feed_starter_broiler\",\"articleSource\":\"INVENTORY\",\"quantity\":30}}")
DRID=$(echo "$DR" | jq -r '.data.id')
chk "$([ -n "$DRID" ] && [ "$DRID" != null ] && echo ok)" "ok" "DailyRecord + feedConsumption créé"
chk "$(jbody GET $INV/stock-items "$TOKEN" '' | jq -r '.data[]|select(.articleKey=="feed_starter_broiler")|.currentQuantity')" "70.000" "Stock décrémenté à 70kg (D18)"
chk "$(jbody GET "$INV/movements?stockItemId=$SID" "$TOKEN" '' | jq '[.data[]|select(.movementType=="OUT" and .dailyRecordId=='"$DRID"')]|length')" "1" "Mouvement OUT backref daily_record_id"

# 12. D18 — vaccination with stockConsumption (auto-creates TREATMENT stock, goes negative D19)
VAC=$(jbody POST /api/v1/farms/$FARM/health/vaccinations "$TOKEN" "{\"unitId\":$UNIT,\"vaccineKey\":\"newcastle_la_sota\",\"administeredDate\":\"$TODAY\",\"subjectsCount\":5000,\"stockConsumption\":{\"articleKey\":\"amoxicillin_50\",\"articleSource\":\"TREATMENT\",\"quantity\":5}}")
VACID=$(echo "$VAC" | jq -r '.data.id')
chk "$([ -n "$VACID" ] && [ "$VACID" != null ] && echo ok)" "ok" "Vaccination + stockConsumption créée"
MID=$(jbody GET $INV/stock-items "$TOKEN" '' | jq -r '.data[]|select(.articleKey=="amoxicillin_50")|.id')
chk "$(jbody GET "$INV/movements?stockItemId=$MID" "$TOKEN" '' | jq '[.data[]|select(.reason=="CONSUMPTION_VACCINATION" and .vaccinationId=='"$VACID"')]|length')" "1" "Mouvement OUT reason CONSUMPTION_VACCINATION"

# 13. D18 — treatment with stockConsumption
TRT=$(jbody POST /api/v1/farms/$FARM/health/treatments "$TOKEN" "{\"unitId\":$UNIT,\"treatmentKey\":\"amoxicillin_50\",\"startDate\":\"$TODAY\",\"durationDays\":5,\"doseAmount\":200,\"doseUnit\":\"g/1000L\",\"route\":\"WATER\",\"subjectsCount\":100,\"stockConsumption\":{\"articleKey\":\"amoxicillin_50\",\"articleSource\":\"TREATMENT\",\"quantity\":3}}")
TRTID=$(echo "$TRT" | jq -r '.data.id')
chk "$(jbody GET "$INV/movements?stockItemId=$MID" "$TOKEN" '' | jq '[.data[]|select(.reason=="CONSUMPTION_TREATMENT" and .treatmentExecutedId=='"$TRTID"')]|length')" "1" "Mouvement OUT reason CONSUMPTION_TREATMENT"

# 14. Robustesse — invalid article → error + rollback (no daily record)
BEFORE=$(jbody GET /api/v1/farms/$FARM/poultry-batches/$UNIT/daily-records "$TOKEN" '' | jq '.data|length')
BAD_DR="{\"recordDate\":\"2026-01-02\",\"mortalityCount\":0,\"feedConsumption\":{\"articleKey\":\"__nope__\",\"articleSource\":\"INVENTORY\",\"quantity\":10}}"
C14=$(scode POST /api/v1/farms/$FARM/poultry-batches/$UNIT/daily-records "$TOKEN" "$BAD_DR")
chk "$C14" "404" "Article invalide → 404"
chk "$(jbody GET /api/v1/farms/$FARM/poultry-batches/$UNIT/daily-records "$TOKEN" '' | jq '.data|length')" "$BEFORE" "Rollback : aucun daily record ajouté"

# 15. Robustesse — quantity > stock → mouvement créé, stock négatif (D19 non bloquant)
DR2=$(scode POST /api/v1/farms/$FARM/poultry-batches/$UNIT/daily-records "$TOKEN" "{\"recordDate\":\"2026-01-03\",\"mortalityCount\":0,\"feedConsumption\":{\"articleKey\":\"feed_starter_broiler\",\"articleSource\":\"INVENTORY\",\"quantity\":1000}}")
chk "$DR2" "201" "Conso > stock acceptée (D19)"
chk "$(jbody GET $INV/stock-items "$TOKEN" '' | jq -r '.data[]|select(.articleKey=="feed_starter_broiler")|.currentQuantity|tonumber < 0')" "true" "Stock feed_starter_broiler négatif (D19)"

# 16-17. GATING — 2e ferme broiler+health SANS inventory
EMAIL2="e2e-inv-noinv-$TS@test.io"
T2=$(provision "$EMAIL2" "E2E NoInv")
FARM2=$(jbody POST /api/v1/farms "$T2" '{"name":"Ferme Sans Inventory"}' | jq -r '.data.id')
T2=$(login "$EMAIL2")
scode POST /api/v1/farms/$FARM2/subscription/modules "$T2" '{"moduleKey":"module.poultry.broiler","mode":"HARD"}' >/dev/null
scode POST /api/v1/farms/$FARM2/subscription/modules "$T2" '{"moduleKey":"module.health.basic","mode":"HARD"}' >/dev/null
BREED2=$(curl -s "$BASE/api/v1/breeds?species=POULTRY" -H "Authorization: Bearer $T2" | jq -r '.data[]|select(.code=="cobb_500")|.id')
UNIT2=$(jbody POST /api/v1/farms/$FARM2/poultry-batches "$T2" "{\"breedId\":$BREED2,\"name\":\"L2\",\"startDate\":\"$TODAY\",\"initialCount\":100}" | jq -r '.data.id')
NOINV_DR="{\"recordDate\":\"$TODAY\",\"mortalityCount\":0,\"feedConsumption\":{\"articleKey\":\"feed_starter_broiler\",\"articleSource\":\"INVENTORY\",\"quantity\":5}}"
C16=$(scode POST /api/v1/farms/$FARM2/poultry-batches/$UNIT2/daily-records "$T2" "$NOINV_DR")
chk "$C16" "422" "Option α : couplage sans module.inventory → 422"
chk "$(gcode "/api/v1/farms/$FARM2/inventory/stock-items" "$T2")" "403" "Gating : GET /inventory sans module → 403"

# 18-19. Feed formulas — clone a platform template
PKEY=$(jbody GET $INV/catalog/feed-formulas "$TOKEN" '' | jq -r '.data[0].key')
CLONE_BODY="{\"sourceFormulaKey\":\"$PKEY\",\"newName\":\"Ma formule E2E\"}"
CLONE=$(jbody POST $INV/feed-formulas/clone "$TOKEN" "$CLONE_BODY")
chk "$(echo "$CLONE" | jq -r 'if .data.id then "ok" else "ko" end')" "ok" "Clone formule plateforme ($PKEY) → 201"
AVAIL=$(jbody GET $INV/feed-formulas "$TOKEN" '')
chk "$(echo "$AVAIL" | jq '.data.platformFormulas|length>0')" "true" "Formules plateforme listées"
chk "$(echo "$AVAIL" | jq '[.data.farmFormulas[]|select(.name=="Ma formule E2E")]|length')" "1" "Formule farm clonée listée"

# 20-21. Alerts — set threshold, OUT below it, alert appears
chk "$(scode PUT $INV/stock-items/$MID/threshold "$TOKEN" '{"threshold":100}')" "200" "Seuil d'alerte posé sur amoxicillin_50"
LOW=$(jbody GET $INV/alerts "$TOKEN" '' | jq '[.data.lowStockItems[],.data.negativeStockItems[]]|map(.articleKey)')
chk "$(echo "$LOW" | jq 'index("amoxicillin_50") != null')" "true" "Alerte stock bas/négatif contient amoxicillin_50"

# 22. PO cancel from DRAFT
PD=$(jbody POST $INV/purchase-orders "$TOKEN" "{\"supplierId\":$SUP,\"lines\":[{\"articleKey\":\"corn_crushed\",\"articleSource\":\"INVENTORY\",\"orderedQuantity\":10,\"unitPriceXof\":300}]}" | jq -r '.data.id')
chk "$(jbody POST $INV/purchase-orders/$PD/cancel "$TOKEN" '{"reason":"test"}' | jq -r '.data.status')" "CANCELLED" "PO DRAFT → CANCELLED"

# 23. PO cancel from SENT
PS=$(jbody POST $INV/purchase-orders "$TOKEN" "{\"supplierId\":$SUP,\"lines\":[{\"articleKey\":\"corn_crushed\",\"articleSource\":\"INVENTORY\",\"orderedQuantity\":10,\"unitPriceXof\":300}]}" | jq -r '.data.id')
jbody POST $INV/purchase-orders/$PS/submit "$TOKEN" '' >/dev/null
chk "$(jbody POST $INV/purchase-orders/$PS/cancel "$TOKEN" '{}' | jq -r '.data.status')" "CANCELLED" "PO SENT → CANCELLED"

# 24. PO partial reception
PP=$(jbody POST $INV/purchase-orders "$TOKEN" "{\"supplierId\":$SUP,\"lines\":[{\"articleKey\":\"grit_calcium\",\"articleSource\":\"INVENTORY\",\"orderedQuantity\":100,\"unitPriceXof\":350}]}")
PORD=$(echo "$PP" | jq -r '.data.id'); PORDIT=$(echo "$PP" | jq -r '.data.items[0].id')
jbody POST $INV/purchase-orders/$PORD/submit "$TOKEN" '' >/dev/null
RC=$(jbody POST $INV/purchase-orders/$PORD/receive "$TOKEN" "{\"lines\":[{\"itemId\":$PORDIT,\"receivedQuantity\":50}]}")
chk "$(echo "$RC" | jq -r '.data.status')" "RECEIVED" "PO réception partielle → RECEIVED"
chk "$(echo "$RC" | jq -r '.data.items[0].receivedQuantity | tonumber')" "50" "received_quantity = 50 (partiel)"

# 25. Cross-farm — a 2nd inventory-enabled farm cannot touch farm1's stock item → 404
# (the acting farm must HAVE inventory, otherwise the gate returns 403 before the 404 check)
FARM3=$(jbody POST /api/v1/farms "$TOKEN" '{"name":"Ferme Inventory 2"}' | jq -r '.data.id')
TOKEN=$(login "$EMAIL")
scode POST /api/v1/farms/$FARM3/subscription/modules "$TOKEN" '{"moduleKey":"module.inventory","mode":"HARD"}' >/dev/null
XFARM_BODY="{\"stockItemId\":$SID,\"movementType\":\"OUT\",\"quantity\":1,\"reason\":\"LOSS\"}"
C25=$(scode POST /api/v1/farms/$FARM3/inventory/movements "$TOKEN" "$XFARM_BODY")
chk "$C25" "404" "Cross-farm : mouvement sur stock d'une autre ferme → 404"

echo ""
echo "════════════════════════════════════"
printf "  Résultat : \033[32m%d OK\033[0m / \033[31m%d KO\033[0m\n" "$PASS" "$FAIL"
echo "════════════════════════════════════"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
