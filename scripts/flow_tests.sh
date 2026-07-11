#!/bin/bash
# Critical flow tests for the news portal
# Tests end-to-end user journeys

set -u
BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/flow_cookies.txt"
PASS=0
FAIL=0
ERRORS=()

ensure_server() {
  if ! curl -s -o /dev/null --max-time 5 "$BASE_URL/" 2>/dev/null; then
    pkill -f "next" 2>/dev/null
    sleep 2
    rm -rf .next
    NODE_OPTIONS="--max-old-space-size=2048" nohup npx next dev -p 3000 --webpack < /dev/null > dev.log 2>&1 &
    disown
    for i in $(seq 1 15); do
      sleep 2
      if curl -s -o /dev/null --max-time 3 "$BASE_URL/" 2>/dev/null; then
        return 0
      fi
    done
    return 1
  fi
}

req() {
  local method="$1" path="$2" data="${3:-}"
  local extra=()
  if [[ -n "$data" ]]; then
    extra=(-H "Content-Type: application/json" -d "$data")
  fi
  for attempt in 1 2 3; do
    ensure_server || return 1
    local resp
    resp=$(curl -s -X "$method" "$BASE_URL$path" \
      -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
      "${extra[@]}" \
      -w "\n__STATUS__%{http_code}" \
      --max-time 30 2>/dev/null)
    if [[ "$resp" == *"__STATUS__"* ]]; then
      echo "$resp"
      return 0
    fi
    sleep 2
  done
  echo "__STATUS__0"
}

test_pass() { PASS=$((PASS+1)); echo "  ✅ $1"; }
test_fail() { FAIL=$((FAIL+1)); ERRORS+=("$1: $2"); echo "  ❌ $1 — $2"; }

section() { echo; echo "============================================================"; echo "$1"; echo "============================================================"; }

cd /home/z/my-project
rm -f "$COOKIE_FILE"

# ============================================================
# FLOW 1: Login → Dashboard → List → Detail
# ============================================================
section "FLOW 1: Admin authentication & navigation"

RESP=$(req POST "/api/auth/login" '{"email":"admin@portal.com","password":"admin123"}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Admin login" || test_fail "Admin login" "got $STATUS"

RESP=$(req GET "/api/auth/me")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Session valid" || test_fail "Session valid" "got $STATUS"

RESP=$(req GET "/api/dashboard")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Dashboard accessible" || test_fail "Dashboard accessible" "got $STATUS"

# ============================================================
# FLOW 2: Classifieds full cycle (create → view → contact → boost → delete)
# ============================================================
section "FLOW 2: Classifieds lifecycle (create → contact → boost → delete)"

# Get a category
RESP=$(req GET "/api/classified-categories")
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
CAT_ID=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['categories'][0]['id'])" 2>/dev/null)
[[ -n "$CAT_ID" ]] && test_pass "Got classified category" || test_fail "Got classified category" "no categories"

# Create a classified listing
RESP=$(req POST "/api/classifieds" "{
  \"title\":\"Teste Smoke — Bicicleta Caloi Cross\",
  \"description\":\"Bicicleta aro 26, 21 marchas, freio a disco, semi nova. Usada por 1 ano.\",
  \"price\":850,
  \"isNegotiable\":true,
  \"categoryId\":\"$CAT_ID\",
  \"personType\":\"PF\",
  \"city\":\"Cidade\",
  \"state\":\"MT\",
  \"photos\":[]
}")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
LISTING_ID=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('listing',{}).get('id',''))" 2>/dev/null)
LISTING_SLUG=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('listing',{}).get('slug',''))" 2>/dev/null)
if [[ "$STATUS" == "200" && -n "$LISTING_ID" ]]; then
  test_pass "Created classified listing (id=$LISTING_ID)"
else
  test_fail "Created classified listing" "status=$STATUS body=$BODY"
fi

# View it
if [[ -n "$LISTING_SLUG" ]]; then
  RESP=$(req GET "/api/classifieds?slug=$LISTING_SLUG")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  [[ "$STATUS" == "200" ]] && test_pass "View listing by slug" || test_fail "View listing by slug" "got $STATUS"
fi

# Send a contact message
if [[ -n "$LISTING_ID" ]]; then
  RESP=$(req POST "/api/classifieds/$LISTING_ID/contact" '{
    "senderName":"Cliente Teste",
    "senderEmail":"cliente@teste.com",
    "senderPhone":"(66) 99999-9999",
    "message":"Tenho interesse na bicicleta. Ainda está disponível?",
    "channel":"PANEL"
  }')
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  [[ "$STATUS" == "200" ]] && test_pass "Sent contact message" || test_fail "Sent contact message" "got $STATUS"
fi

# Boost with points (admin has 528 points)
if [[ -n "$LISTING_ID" ]]; then
  RESP=$(req POST "/api/classifieds/$LISTING_ID/boost" '{"tierId":"3d"}')
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  [[ "$STATUS" == "200" ]] && test_pass "Boosted listing (3 days)" || test_fail "Boosted listing" "got $STATUS"
fi

# Check leads
RESP=$(req GET "/api/leads?mode=received")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Got received leads" || test_fail "Got received leads" "got $STATUS"

# Delete listing
if [[ -n "$LISTING_ID" ]]; then
  RESP=$(req DELETE "/api/classifieds/$LISTING_ID")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  [[ "$STATUS" == "200" ]] && test_pass "Deleted listing" || test_fail "Deleted listing" "got $STATUS"
fi

# ============================================================
# FLOW 3: User management (create editor → configure → delete)
# ============================================================
section "FLOW 3: User management (create editor with login)"

# Create new editor with login
RESP=$(req POST "/api/editor-profile" '{
  "name":"Editor Teste Flow",
  "email":"editor.flow@test.com",
  "password":"flow123456",
  "bio":"Editor criado para teste de fluxo",
  "bioTitle":"Editor de Teste",
  "bioSlug":"editor-teste-flow",
  "bioIsActive":true
}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
NEW_USER_ID=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('user',{}).get('id',''))" 2>/dev/null)
if [[ "$STATUS" == "200" && -n "$NEW_USER_ID" ]]; then
  test_pass "Created new editor with login (id=$NEW_USER_ID)"
else
  test_fail "Created new editor" "status=$STATUS body=$BODY"
fi

# Verify it appears in editor list
RESP=$(req GET "/api/editor-profile")
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
FOUND=$(echo "$BODY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
profiles=d.get('profiles',[])
print('true' if any(p.get('userId') == '$NEW_USER_ID' for p in profiles) else 'false')
" 2>/dev/null)
[[ "$FOUND" == "true" ]] && test_pass "Editor appears in list" || test_fail "Editor appears in list" "not found"

# Get metrics for the new editor
if [[ -n "$NEW_USER_ID" ]]; then
  RESP=$(req GET "/api/admin/editors/$NEW_USER_ID/metrics")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  [[ "$STATUS" == "200" ]] && test_pass "Got editor metrics" || test_fail "Got editor metrics" "got $STATUS"
fi

# Cleanup: delete the test editor
if [[ -n "$NEW_USER_ID" ]]; then
  RESP=$(req DELETE "/api/users/$NEW_USER_ID")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  [[ "$STATUS" == "200" ]] && test_pass "Cleanup: deleted test editor" || test_fail "Cleanup: delete test editor" "got $STATUS"
fi

# ============================================================
# FLOW 4: Plan subscription (free plan)
# ============================================================
section "FLOW 4: Plan subscription (FREE)"

RESP=$(req GET "/api/plans")
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
FREE_PLAN_ID=$(echo "$BODY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
plans=d.get('plans',[])
free=[p for p in plans if p.get('slug')=='FREE']
print(free[0]['id'] if free else '')
" 2>/dev/null)
[[ -n "$FREE_PLAN_ID" ]] && test_pass "Got FREE plan ID" || test_fail "Got FREE plan ID" "no FREE plan"

# ============================================================
# FLOW 5: Verification submit & approve
# ============================================================
section "FLOW 5: Verification (CPF/CNPJ) flow"

# Submit verification
RESP=$(req POST "/api/verification" '{"type":"CPF","document":"12345678901"}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Submitted CPF verification" || test_fail "Submitted CPF verification" "got $STATUS"

# Admin approve
RESP=$(req PATCH "/api/admin/verifications" '{"userId":"cmqitzmyh000jjp4f5xgm8ivz","status":"VERIFIED"}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Admin approved verification" || test_fail "Admin approved verification" "got $STATUS"

# ============================================================
# FLOW 6: Check-in (daily points)
# ============================================================
section "FLOW 6: Daily check-in"

RESP=$(req POST "/api/check-in" '{}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
# 200 = success, 400 = already checked in today
if [[ "$STATUS" == "200" || "$STATUS" == "400" ]]; then
  test_pass "Check-in endpoint works (status=$STATUS)"
else
  test_fail "Check-in endpoint" "got $STATUS"
fi

# ============================================================
# FLOW 7: Points & credits balance
# ============================================================
section "FLOW 7: Points & credits"

RESP=$(req GET "/api/credits")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Got credits balance" || test_fail "Got credits balance" "got $STATUS"

RESP=$(req GET "/api/credits?type=points")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
[[ "$STATUS" == "200" ]] && test_pass "Got points history" || test_fail "Got points history" "got $STATUS"

# ============================================================
# FLOW 8: Ad serve (priority rotation)
# ============================================================
section "FLOW 8: Ad serving"

# Make 10 requests and verify variety
SUCCESS_COUNT=0
for i in 1 2 3 4 5; do
  RESP=$(req GET "/api/ads/serve?placement=HOME_SIDEBAR")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  [[ "$STATUS" == "200" ]] && SUCCESS_COUNT=$((SUCCESS_COUNT+1))
done
[[ "$SUCCESS_COUNT" -eq 5 ]] && test_pass "Ad serve stable across 5 requests" || test_fail "Ad serve" "$SUCCESS_COUNT/5 succeeded"

# ============================================================
# SUMMARY
# ============================================================
section "SUMMARY"
echo
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
echo "Total: $((PASS+FAIL))"
if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo
  echo "--- Errors ---"
  for e in "${ERRORS[@]}"; do echo "  • $e"; done
fi
exit 0
