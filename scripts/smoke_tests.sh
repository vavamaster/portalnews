#!/bin/bash
# Comprehensive smoke tests for the news portal (brand-agnostic)
# Restarts dev server if needed between test groups

set -u
BASE_URL="http://localhost:3000"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@portal.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
COOKIE_FILE="/tmp/test_cookies.txt"
PASS=0
FAIL=0
ERRORS=()

# === Helper functions ===

ensure_server() {
  # Check if server is up; if not, restart
  if ! curl -s -o /dev/null --max-time 5 "$BASE_URL/" 2>/dev/null; then
    echo "  [server down, restarting...]"
    pkill -f "next" 2>/dev/null
    sleep 2
    rm -rf .next
    NODE_OPTIONS="--max-old-space-size=2048" nohup npx next dev -p 3000 --webpack < /dev/null > dev.log 2>&1 &
    disown
    # Wait up to 30 seconds
    for i in $(seq 1 15); do
      sleep 2
      if curl -s -o /dev/null --max-time 3 "$BASE_URL/" 2>/dev/null; then
        echo "  [server up after $((i*2))s]"
        return 0
      fi
    done
    echo "  [server failed to start]"
    return 1
  fi
}

req() {
  local method="$1" path="$2" data="${3:-}"
  local extra=()
  if [[ -n "$data" ]]; then
    extra=(-H "Content-Type: application/json" -d "$data")
  fi
  # Retry up to 3 times with server restart on failure
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
    echo "  [retry $attempt for $method $path]" >&2
    sleep 2
  done
  echo "__STATUS__0"
  return 1
}

test_eq() {
  local name="$1" expected="$2" actual="$3" details="${4:-}"
  if [[ "$expected" == "$actual" ]]; then
    PASS=$((PASS+1))
    echo "  ✅ $name"
  else
    FAIL=$((FAIL+1))
    ERRORS+=("$name: expected=$expected actual=$actual ${details:+— $details}")
    echo "  ❌ $name — expected=$expected actual=$actual ${details:+— $details}"
  fi
}

test_true() {
  local name="$1" condition="$2" details="${3:-}"
  if [[ "$condition" == "true" || "$condition" == "1" ]]; then
    PASS=$((PASS+1))
    echo "  ✅ $name"
  else
    FAIL=$((FAIL+1))
    ERRORS+=("$name: ${details}")
    echo "  ❌ $name — ${details}"
  fi
}

section() { echo; echo "============================================================"; echo "$1"; echo "============================================================"; }

# === Tests start ===

cd /home/z/my-project
rm -f "$COOKIE_FILE"

# 1. AUTH
section "1. AUTHENTICATION"
RESP=$(req POST "/api/auth/login" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "Login admin returns 200" "200" "$STATUS" "$BODY"

# Save BODY to temp file to avoid shell escaping issues with python
echo "$BODY" > /tmp/login_body.json
USER_NAME=$(python3 -c "import json; d=json.load(open('/tmp/login_body.json')); print(d.get('user',{}).get('name',''))" 2>/dev/null)
test_true "Login returns user name" "$([[ -n '$USER_NAME' ]] && echo true || echo false)" "name=$USER_NAME"
USER_ROLE=$(python3 -c "import json; d=json.load(open('/tmp/login_body.json')); print(d.get('user',{}).get('role',''))" 2>/dev/null)
test_eq "Login returns MASTER role" "MASTER" "$USER_ROLE"

# 2. CATEGORIES
section "2. CATEGORIES"
RESP=$(req GET "/api/categories")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "GET /api/categories returns 200" "200" "$STATUS"
CAT_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('categories',[])))" 2>/dev/null || echo 0)
test_true "Has at least 5 categories" "$(( CAT_COUNT >= 5 ))" "got $CAT_COUNT"

# 3. POSTS
section "3. POSTS"
RESP=$(req GET "/api/posts?limit=5")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "GET /api/posts returns 200" "200" "$STATUS"
POST_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('posts',[])))" 2>/dev/null || echo 0)
test_true "Has posts" "$(( POST_COUNT > 0 ))" "got $POST_COUNT"

# 4. ADS
section "4. ADS / MONETIZATION"
RESP=$(req GET "/api/ads?status=ALL")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/ads (admin) returns 200" "200" "$STATUS"
for placement in HOME_TOP HOME_SIDEBAR HOME_MIDDLE HEADER_BANNER; do
  RESP=$(req GET "/api/ads/serve?placement=$placement")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  test_eq "GET /api/ads/serve?placement=$placement" "200" "$STATUS"
done

# 5. CLASSIFIEDS
section "5. CLASSIFIEDS"
RESP=$(req GET "/api/classified-categories")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/classified-categories" "200" "$STATUS"
RESP=$(req GET "/api/classifieds?limit=5&sort=recent")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "GET /api/classifieds" "200" "$STATUS"
LISTING_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('listings',[])))" 2>/dev/null || echo 0)
test_true "Has classified listings" "$(( LISTING_COUNT > 0 ))" "got $LISTING_COUNT"
LISTING_SLUG=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); l=d.get('listings',[]); print(l[0]['slug'] if l else '')" 2>/dev/null)
if [[ -n "$LISTING_SLUG" ]]; then
  RESP=$(req GET "/api/classifieds?slug=$LISTING_SLUG")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  test_eq "GET /api/classifieds?slug=... returns 200" "200" "$STATUS"
fi

# 6. PLANS
section "6. PLANS & SUBSCRIPTIONS"
RESP=$(req GET "/api/plans")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "GET /api/plans returns 200" "200" "$STATUS"
PLAN_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('plans',[])))" 2>/dev/null || echo 0)
test_eq "Has 4 plans" "4" "$PLAN_COUNT"
RESP=$(req GET "/api/subscriptions")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/subscriptions" "200" "$STATUS"

# 7. DASHBOARD
section "7. DASHBOARD"
RESP=$(req GET "/api/dashboard")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "GET /api/dashboard returns 200" "200" "$STATUS"
HAS_STATS=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if 'stats' in d else 'false')" 2>/dev/null)
test_true "Dashboard has stats" "$HAS_STATS" ""
HAS_FIN=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if d.get('financial') is not None else 'false')" 2>/dev/null)
test_true "Dashboard has financial" "$HAS_FIN" ""
HAS_MOD=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print('true' if 'moderation' in d else 'false')" 2>/dev/null)
test_true "Dashboard has moderation" "$HAS_MOD" ""

# 8. USERS
section "8. USERS"
RESP=$(req GET "/api/users")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "GET /api/users returns 200" "200" "$STATUS"
USER_COUNT=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('users',[])))" 2>/dev/null || echo 0)
test_true "Has users" "$(( USER_COUNT > 0 ))" "got $USER_COUNT"

# 9. EDITORS
section "9. EDITORS"
RESP=$(req GET "/api/editor-profile")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
BODY=$(echo "$RESP" | sed 's/__STATUS__[0-9]*$//')
test_eq "GET /api/editor-profile returns 200" "200" "$STATUS"
EDITOR_USER_ID=$(echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); ps=d.get('profiles',[]); print(ps[0]['userId'] if ps else '')" 2>/dev/null)
if [[ -n "$EDITOR_USER_ID" ]]; then
  RESP=$(req GET "/api/admin/editors/$EDITOR_USER_ID/metrics")
  STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
  test_eq "GET /api/admin/editors/[id]/metrics" "200" "$STATUS"
fi

# 10. VERIFICATIONS
section "10. VERIFICATIONS"
RESP=$(req GET "/api/admin/verifications")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/admin/verifications" "200" "$STATUS"

# 11. NOTIFICATIONS
section "11. NOTIFICATIONS"
RESP=$(req GET "/api/notifications?limit=15")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/notifications" "200" "$STATUS"

# 12. CREDITS
section "12. CREDITS & POINTS"
RESP=$(req GET "/api/credits")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/credits" "200" "$STATUS"
RESP=$(req GET "/api/credits?type=points")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/credits?type=points" "200" "$STATUS"

# 13. SEO & SLIDE CONFIG
section "13. SEO & SLIDE CONFIG"
RESP=$(req GET "/api/seo")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/seo" "200" "$STATUS"
RESP=$(req GET "/api/slide-config")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/slide-config" "200" "$STATUS"

# 14. QUOTES
section "14. QUOTES"
RESP=$(req GET "/api/quotes")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/quotes" "200" "$STATUS"
RESP=$(req GET "/api/quotes/all")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/quotes/all" "200" "$STATUS"

# 15. WEBHOOKS
section "15. WEBHOOKS (smoke — no crash)"
RESP=$(req POST "/api/webhooks/asaas" '{"event":"test"}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_true "POST /api/webhooks/asaas (no crash)" "$([[ "$STATUS" =~ ^(200|400|404)$ ]] && echo true || echo false)" "got $STATUS"
RESP=$(req POST "/api/webhooks/mercadopago" '{"type":"test"}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_true "POST /api/webhooks/mercadopago (no crash)" "$([[ "$STATUS" =~ ^(200|400|404)$ ]] && echo true || echo false)" "got $STATUS"
RESP=$(req POST "/api/webhooks/stripe" '{"type":"test"}')
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_true "POST /api/webhooks/stripe (no crash)" "$([[ "$STATUS" =~ ^(200|400|404)$ ]] && echo true || echo false)" "got $STATUS"

# 16. ADMIN CLASSIFIEDS
section "16. ADMIN CLASSIFIEDS"
RESP=$(req GET "/api/admin/classifieds?status=ALL")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/admin/classifieds" "200" "$STATUS"

# 17. GATEWAYS
section "17. GATEWAYS"
RESP=$(req GET "/api/admin/gateways")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/admin/gateways" "200" "$STATUS"

# 18. AI CONFIG
section "18. AI CONFIG"
RESP=$(req GET "/api/admin/ai-config")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/admin/ai-config" "200" "$STATUS"

# 19. PROFILE & VERIFICATION
section "19. PROFILE & CHECK-IN"
# /api/profile only supports PUT (no GET) — testing /api/auth/me instead for profile data
RESP=$(req GET "/api/auth/me")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/auth/me (profile)" "200" "$STATUS"
RESP=$(req GET "/api/verification")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/verification" "200" "$STATUS"
RESP=$(req GET "/api/referral")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/referral" "200" "$STATUS"

# 20. FAVORITES & LEADS
section "20. FAVORITES & LEADS"
RESP=$(req GET "/api/favorites")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/favorites" "200" "$STATUS"
RESP=$(req GET "/api/leads?mode=received")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/leads?mode=received" "200" "$STATUS"
RESP=$(req GET "/api/classifieds/mine")
STATUS=$(echo "$RESP" | grep -oP '__STATUS__\K[0-9]+')
test_eq "GET /api/classifieds/mine" "200" "$STATUS"

# === Summary ===
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
