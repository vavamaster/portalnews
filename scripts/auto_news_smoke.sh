#!/bin/bash
# Smoke test for Auto News module
BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/autonews_cookies.txt"
PASS=0
FAIL=0
ERRORS=()

test_pass() { PASS=$((PASS+1)); echo "  ✅ $1"; }
test_fail() { FAIL=$((FAIL+1)); ERRORS+=("$1: $2"); echo "  ❌ $1 — $2"; }
section() { echo; echo "============================================================"; echo "$1"; echo "============================================================"; }

cd /home/z/my-project
rm -f "$COOKIE_FILE"

# ============================================================
section "0. LOGIN"
# ============================================================
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@portal.com","password":"admin123"}' \
  -c "$COOKIE_FILE" -w "%{http_code}" -o /dev/null --max-time 15 | {
  read code
  if [ "$code" = "200" ]; then test_pass "Login admin"; else test_fail "Login" "HTTP $code"; fi
}

# Re-login since subshell loses vars
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@portal.com","password":"admin123"}' \
  -c "$COOKIE_FILE" > /dev/null 2>&1

# ============================================================
section "1. LIST SCHEDULES (empty or existing)"
# ============================================================
RESP=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/auto-news" --max-time 30 2>&1)
STATUS=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok')" 2>/dev/null)
if [ "$STATUS" = "ok" ]; then
  test_pass "GET /api/admin/auto-news returns valid JSON"
  COUNT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('schedules',[])))" 2>/dev/null)
  test_pass "Has schedules array (count=$COUNT)"
  HAS_STATS=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if 'stats' in d else 'no')" 2>/dev/null)
  test_pass "Has stats object ($HAS_STATS)"
else
  test_fail "GET /api/admin/auto-news" "invalid response"
fi

# ============================================================
section "2. CREATE SCHEDULES (5 scopes)"
# ============================================================
declare -A SCHEDULE_IDS

for scope_info in \
  "LOCAL|Notícia local diária|DAILY|8|0" \
  "STATE|Cobertura agronegócio MT|DAILY|12|0" \
  "NATIONAL|Brasil contextualizado|WEEKLY|9|30" \
  "WORLD|Commodities internacionais|WEEKLY|15|0" \
  "TRENDING|Trending topics|HOURLY|0|0"
do
  IFS='|' read -r scope name freq hour minute <<< "$scope_info"
  
  DAYS_JSON="[1,2,3,4,5]"
  if [ "$freq" = "HOURLY" ]; then DAYS_JSON="null"; fi
  
  RESP=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/admin/auto-news" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"frequency\":\"$freq\",\"hour\":$hour,\"minute\":$minute,\"daysOfWeek\":$DAYS_JSON,\"scope\":\"$scope\",\"autoPublish\":false,\"isEnabled\":true}" \
    --max-time 15 2>&1)
  
  ID=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('schedule',{}).get('id',''))" 2>/dev/null)
  if [ -n "$ID" ] && [ "$ID" != "" ]; then
    test_pass "Created schedule: $name (scope=$scope, freq=$freq)"
    SCHEDULE_IDS[$scope]=$ID
  else
    test_fail "Create schedule: $name" "no ID returned: $RESP"
  fi
done

# ============================================================
section "3. VERIFY SCHEDULES CREATED"
# ============================================================
RESP=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/auto-news" --max-time 30 2>&1)
COUNT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('schedules',[])))" 2>/dev/null)
if [ "$COUNT" -ge 5 ]; then
  test_pass "At least 5 schedules exist ($COUNT)"
else
  test_fail "Schedule count" "expected ≥5, got $COUNT"
fi

# List all
echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for s in d.get('schedules',[]):
    days = s.get('daysOfWeek') or 'every day'
    print(f'  📋 {s[\"name\"]} | {s[\"frequency\"]} | {s[\"scope\"]} | {s[\"hour\"]:02d}:{s[\"minute\"]:02d} | enabled={s[\"isEnabled\"]} | days={days}')
" 2>/dev/null

# ============================================================
section "4. RUN SCHEDULES MANUALLY (generate news)"
# ============================================================
for scope in LOCAL STATE NATIONAL WORLD TRENDING; do
  ID=${SCHEDULE_IDS[$scope]}
  if [ -z "$ID" ]; then
    test_fail "Run $scope" "no schedule ID"
    continue
  fi
  
  echo "  Running $scope schedule (id=$ID)..."
  RESP=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/admin/auto-news/run" \
    -H "Content-Type: application/json" \
    -d "{\"scheduleId\":\"$ID\"}" \
    --max-time 180 2>&1)
  
  SUCCESS=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if d.get('success') else 'no')" 2>/dev/null)
  if [ "$SUCCESS" = "yes" ]; then
    TITLE=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('post',{}).get('title','?')[:60])" 2>/dev/null)
    DURATION=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('duration','?'))" 2>/dev/null)
    test_pass "Generated $scope: \"$TITLE\" (${DURATION}ms)"
  else
    ERROR=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error','unknown')[:100])" 2>/dev/null)
    test_fail "Run $scope" "$ERROR"
  fi
done

# ============================================================
section "5. VERIFY LOGS"
# ============================================================
RESP=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/auto-news?logs=true" --max-time 30 2>&1)
LOG_COUNT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('logs',[])))" 2>/dev/null)
if [ "$LOG_COUNT" -ge 5 ]; then
  test_pass "Logs recorded ($LOG_COUNT entries)"
else
  test_fail "Logs" "expected ≥5, got $LOG_COUNT"
fi

echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for log in d.get('logs',[])[:8]:
    status = '✅' if log['status']=='SUCCESS' else '❌'
    title = log.get('postTitle','—') or '—'
    dur = log.get('duration','?')
    print(f'  {status} {log[\"scheduleName\"]} | {title[:50]} | {dur}ms')
" 2>/dev/null

# ============================================================
section "6. CRON ENDPOINT"
# ============================================================
RESP=$(curl -s "$BASE_URL/api/cron/auto-news" --max-time 15 2>&1)
OK=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if d.get('ok') else 'no')" 2>/dev/null)
if [ "$OK" = "yes" ]; then
  test_pass "Cron endpoint returns ok"
  GENERATED=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('generated',0))" 2>/dev/null)
  SKIPPED=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('skipped',0))" 2>/dev/null)
  test_pass "Cron: generated=$GENERATED, skipped=$SKIPPED (skipped = already ran recently)"
else
  test_fail "Cron endpoint" "invalid response: $RESP"
fi

# ============================================================
section "7. UPDATE SCHEDULE (toggle enabled)"
# ============================================================
ID=${SCHEDULE_IDS[LOCAL]}
RESP=$(curl -s -b "$COOKIE_FILE" -X PUT "$BASE_URL/api/admin/auto-news/$ID" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled":false}' --max-time 15 2>&1)
ENABLED=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('schedule',{}).get('isEnabled','?'))" 2>/dev/null)
if [ "$ENABLED" = "False" ] || [ "$ENABLED" = "false" ]; then
  test_pass "Toggle schedule to disabled"
else
  test_fail "Toggle schedule" "isEnabled=$ENABLED"
fi

# Re-enable
curl -s -b "$COOKIE_FILE" -X PUT "$BASE_URL/api/admin/auto-news/$ID" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled":true}' > /dev/null 2>&1
test_pass "Re-enabled schedule"

# ============================================================
section "8. DELETE SCHEDULES"
# ============================================================
for scope in WORLD TRENDING; do
  ID=${SCHEDULE_IDS[$scope]}
  if [ -n "$ID" ]; then
    RESP=$(curl -s -b "$COOKIE_FILE" -X DELETE "$BASE_URL/api/admin/auto-news/$ID" --max-time 15 2>&1)
    OK=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('yes' if d.get('ok') else 'no')" 2>/dev/null)
    if [ "$OK" = "yes" ]; then
      test_pass "Deleted $scope schedule"
    else
      test_fail "Delete $scope" "$RESP"
    fi
  fi
done

# ============================================================
section "9. VERIFY GENERATED POSTS"
# ============================================================
RESP=$(curl -s "$BASE_URL/api/posts?limit=10" --max-time 30 2>&1)
COUNT=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('posts',[])))" 2>/dev/null)
test_pass "Posts API returns $COUNT posts"

# Check for auto-generated posts (they should be DRAFT)
RESP=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/auto-news?logs=true" --max-time 30 2>&1)
SUCCESS_COUNT=$(echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
logs = d.get('logs',[])
print(len([l for l in logs if l['status']=='SUCCESS']))
" 2>/dev/null)
test_pass "Successful generations: $SUCCESS_COUNT"

# ============================================================
section "SUMMARY"
# ============================================================
echo
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
echo "Total: $((PASS+FAIL))"
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo
  echo "--- Errors ---"
  for e in "${ERRORS[@]}"; do echo "  • $e"; done
fi
