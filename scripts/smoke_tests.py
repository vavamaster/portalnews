#!/usr/bin/env python3
"""Comprehensive smoke tests for the news portal."""
import json
import subprocess
import time
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_URL = "http://localhost:3000"
ADMIN_EMAIL = "admin@portal.com"
ADMIN_PASSWORD = "admin123"
COOKIE_FILE = "/tmp/test_cookies.txt"

# Stats
PASS = 0
FAIL = 0
ERRORS = []

def request(method, path, data=None, headers=None, cookies=True):
    """Make HTTP request, return (status_code, response_json, response_text)."""
    url = f"{BASE_URL}{path}"
    body = None
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    if data is not None:
        body = json.dumps(data).encode()

    cmd = ["curl", "-s", "-X", method, url, "-w", "\n__HTTP_STATUS__%{http_code}"]
    if cookies:
        cmd.extend(["-b", COOKIE_FILE, "-c", COOKIE_FILE])
    for k, v in h.items():
        cmd.extend(["-H", f"{k}: {v}"])
    if body:
        cmd.extend(["-d", body])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        text = result.stdout
        # Split status
        if "__HTTP_STATUS__" in text:
            parts = text.rsplit("__HTTP_STATUS__", 1)
            body_text = parts[0].strip()
            status = int(parts[1].strip())
        else:
            body_text = text
            status = 0
        try:
            return status, json.loads(body_text), body_text
        except json.JSONDecodeError:
            return status, None, body_text
    except subprocess.TimeoutExpired:
        return 0, None, "TIMEOUT"
    except Exception as e:
        return 0, None, str(e)

def test(name, condition, details=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        ERRORS.append(f"{name}: {details}")
        print(f"  ❌ {name} — {details}")

def section(name):
    print(f"\n{'='*60}\n{name}\n{'='*60}")

# ============================================================
# 1. AUTH
# ============================================================
section("1. AUTHENTICATION")
status, data, _ = request("POST", "/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, cookies=False)
test("Login admin returns 200", status == 200, f"got {status}")
test("Login returns user with MASTER role", data and data.get("user", {}).get("role") == "MASTER", str(data)[:200] if data else "no data")

status, data, _ = request("GET", "/api/auth/me")
test("GET /api/auth/me authenticated", status == 200 and data and data.get("user"), f"got {status}")
test("Current user is admin", data and data.get("user", {}).get("email") == ADMIN_EMAIL, str(data)[:200] if data else "")

status, data, _ = request("POST", "/api/auth/login", {"email": "wrong@email.com", "password": "wrong"}, cookies=False)
test("Login with wrong creds returns 401", status == 401, f"got {status}")

# ============================================================
# 2. CATEGORIES
# ============================================================
section("2. CATEGORIES")
status, data, _ = request("GET", "/api/categories")
test("GET /api/categories", status == 200 and data and "categories" in data, f"got {status}")
cats = data.get("categories", []) if data else []
test("Has at least 5 categories", len(cats) >= 5, f"got {len(cats)}")

# ============================================================
# 3. POSTS
# ============================================================
section("3. POSTS")
status, data, _ = request("GET", "/api/posts?limit=5")
test("GET /api/posts", status == 200, f"got {status}")
posts = data.get("posts", []) if data else []
test("Has posts", len(posts) > 0, f"got {len(posts)}")
if posts:
    p = posts[0]
    test("Post has slug", bool(p.get("slug")), "no slug")
    test("Post has title", bool(p.get("title")), "no title")
    test("Post has category", bool(p.get("category")), "no category")

# ============================================================
# 4. ADS
# ============================================================
section("4. ADS / MONETIZATION")
status, data, _ = request("GET", "/api/ads?status=ALL")
test("GET /api/ads (admin)", status == 200, f"got {status}")

for placement in ["HOME_TOP", "HOME_SIDEBAR", "HOME_MIDDLE", "HEADER_BANNER"]:
    status, data, _ = request("GET", f"/api/ads/serve?placement={placement}")
    test(f"GET /api/ads/serve?placement={placement}", status == 200, f"got {status}")

# ============================================================
# 5. CLASSIFIEDS
# ============================================================
section("5. CLASSIFIEDS")
status, data, _ = request("GET", "/api/classified-categories")
test("GET /api/classified-categories", status == 200, f"got {status}")
ccats = data.get("categories", []) if data else []
test("Has classified categories", len(ccats) >= 5, f"got {len(ccats)}")

status, data, _ = request("GET", "/api/classifieds?limit=5&sort=recent")
test("GET /api/classifieds", status == 200, f"got {status}")
listings = data.get("listings", []) if data else []
test("Has classified listings", len(listings) > 0, f"got {len(listings)}")
if listings:
    l = listings[0]
    test("Listing has slug", bool(l.get("slug")), "no slug")
    test("Listing has plan info", bool(l.get("plan")), "no plan")

    # Test single listing
    status, data, _ = request("GET", f"/api/classifieds?slug={l['slug']}")
    test("GET /api/classifieds?slug=...", status == 200, f"got {status}")
    test("Listing detail has owner", data and data.get("listing", {}).get("owner"), "no owner")

# ============================================================
# 6. PLANS & SUBSCRIPTIONS
# ============================================================
section("6. PLANS & SUBSCRIPTIONS")
status, data, _ = request("GET", "/api/plans")
test("GET /api/plans", status == 200, f"got {status}")
plans = data.get("plans", []) if data else []
test("Has 4 plans (FREE/PROFESSIONAL/COMPANY/PREMIUM)", len(plans) == 4, f"got {len(plans)}: {[p.get('slug') for p in plans]}")
test("FREE plan exists", any(p.get("slug") == "FREE" for p in plans), "")
test("PREMIUM plan exists", any(p.get("slug") == "PREMIUM" for p in plans), "")

status, data, _ = request("GET", "/api/subscriptions")
test("GET /api/subscriptions", status == 200, f"got {status}")

# ============================================================
# 7. DASHBOARD
# ============================================================
section("7. DASHBOARD")
status, data, _ = request("GET", "/api/dashboard")
test("GET /api/dashboard", status == 200, f"got {status}")
test("Dashboard has stats", data and "stats" in data, "")
test("Dashboard has recentPosts", data and "recentPosts" in data, "")
test("Dashboard has byCategory", data and "byCategory" in data, "")
test("Dashboard has postsByDay", data and "postsByDay" in data, "")
test("Dashboard has financial (admin)", data and data.get("financial") is not None, "")
test("Dashboard has moderation queue", data and "moderation" in data, "")
if data and data.get("financial"):
    f = data["financial"]
    test("Financial has MRR", "mrrCents" in f, "")
    test("Financial has planAggregation", isinstance(f.get("planAggregation"), list), "")
    test("Financial has recentTransactions", isinstance(f.get("recentTransactions"), list), "")

# ============================================================
# 8. USERS (admin)
# ============================================================
section("8. USERS MANAGEMENT")
status, data, _ = request("GET", "/api/users")
test("GET /api/users (admin)", status == 200, f"got {status}")
users = data.get("users", []) if data else []
test("Has users", len(users) > 0, f"got {len(users)}")
if users:
    u = users[0]
    test("User has editorProfile field", "editorProfile" in u, "missing editorProfile")
    test("User has verificationStatus", "verificationStatus" in u, "missing verificationStatus")

# ============================================================
# 9. EDITORS
# ============================================================
section("9. EDITORS")
status, data, _ = request("GET", "/api/editor-profile")
test("GET /api/editor-profile (admin)", status == 200, f"got {status}")
profiles = data.get("profiles", []) if data else []
test("Has editor profiles", len(profiles) > 0, f"got {len(profiles)}")
if profiles:
    p = profiles[0]
    test("Profile has user", bool(p.get("user")), "no user")
    test("Profile has level", bool(p.get("level")), "no level")
    test("Profile has trustLevel", "trustLevel" in p, "")
    user_id = p.get("userId")
    if user_id:
        status, data, _ = request("GET", f"/api/admin/editors/{user_id}/metrics")
        test("GET /api/admin/editors/[id]/metrics", status == 200, f"got {status}")
        if data:
            test("Metrics has summary", "summary" in data, "")
            test("Metrics has categoriesDistribution", "categoriesDistribution" in data, "")
            test("Metrics has topPosts", "topPosts" in data, "")

# ============================================================
# 10. VERIFICATIONS
# ============================================================
section("10. VERIFICATIONS")
status, data, _ = request("GET", "/api/admin/verifications")
test("GET /api/admin/verifications", status == 200, f"got {status}")

# ============================================================
# 11. NOTIFICATIONS
# ============================================================
section("11. NOTIFICATIONS")
status, data, _ = request("GET", "/api/notifications?limit=15")
test("GET /api/notifications", status == 200, f"got {status}")

# ============================================================
# 12. CREDITS & POINTS
# ============================================================
section("12. CREDITS & POINTS")
status, data, _ = request("GET", "/api/credits")
test("GET /api/credits", status == 200, f"got {status}")
status, data, _ = request("GET", "/api/credits?type=points")
test("GET /api/credits?type=points", status == 200, f"got {status}")

# ============================================================
# 13. SEO & SLIDE CONFIG
# ============================================================
section("13. SEO & SLIDE CONFIG")
status, data, _ = request("GET", "/api/seo")
test("GET /api/seo", status == 200, f"got {status}")
status, data, _ = request("GET", "/api/slide-config")
test("GET /api/slide-config", status == 200, f"got {status}")

# ============================================================
# 14. QUOTES
# ============================================================
section("14. QUOTES (Cotações)")
status, data, _ = request("GET", "/api/quotes")
test("GET /api/quotes", status == 200, f"got {status}")
status, data, _ = request("GET", "/api/quotes/all")
test("GET /api/quotes/all", status == 200, f"got {status}")

# ============================================================
# 15. WEBHOOKS (smoke test — should not crash)
# ============================================================
section("15. WEBHOOKS")
# Asaas webhook
status, data, _ = request("POST", "/api/webhooks/asaas", {"event": "PAYMENT_RECEIVED", "payment": {"id": "test"}}, cookies=False)
test("POST /api/webhooks/asaas (no crash)", status in [200, 400, 404], f"got {status}")

# Mercado Pago
status, data, _ = request("POST", "/api/webhooks/mercadopago", {"type": "payment", "data": {"id": "test"}}, cookies=False)
test("POST /api/webhooks/mercadopago (no crash)", status in [200, 400, 404], f"got {status}")

# Stripe
status, data, _ = request("POST", "/api/webhooks/stripe", {"type": "payment_intent.succeeded", "data": {"object": {}}}, cookies=False)
test("POST /api/webhooks/stripe (no crash)", status in [200, 400, 404], f"got {status}")

# Generic payments webhook
status, data, _ = request("POST", "/api/payments/webhook", {"provider": "ASAAS", "event": "test"}, cookies=False)
test("POST /api/payments/webhook (no crash)", status in [200, 400, 404], f"got {status}")

# ============================================================
# 16. ADMIN CLASSIFIEDS
# ============================================================
section("16. ADMIN CLASSIFIEDS")
status, data, _ = request("GET", "/api/admin/classifieds?status=ALL")
test("GET /api/admin/classifieds", status == 200, f"got {status}")
test("Returns listings array", data and "listings" in data, "")
test("Returns byStatus", data and "byStatus" in data, "")
test("Returns byPlan", data and "byPlan" in data, "")

# ============================================================
# 17. GATEWAYS (admin)
# ============================================================
section("17. GATEWAYS")
status, data, _ = request("GET", "/api/admin/gateways")
test("GET /api/admin/gateways", status == 200, f"got {status}")

# ============================================================
# 18. AI CONFIG
# ============================================================
section("18. AI CONFIG")
status, data, _ = request("GET", "/api/admin/ai-config")
test("GET /api/admin/ai-config", status == 200, f"got {status}")

# ============================================================
# 19. PROFILE & CHECK-IN
# ============================================================
section("19. PROFILE & CHECK-IN")
status, data, _ = request("GET", "/api/profile")
test("GET /api/profile", status == 200, f"got {status}")
status, data, _ = request("GET", "/api/verification")
test("GET /api/verification", status == 200, f"got {status}")
status, data, _ = request("GET", "/api/referral")
test("GET /api/referral", status == 200, f"got {status}")

# ============================================================
# 20. FAVORITES & LEADS
# ============================================================
section("20. FAVORITES & LEADS")
status, data, _ = request("GET", "/api/favorites")
test("GET /api/favorites", status == 200, f"got {status}")
status, data, _ = request("GET", "/api/leads?mode=received")
test("GET /api/leads?mode=received", status == 200, f"got {status}")
status, data, _ = request("GET", "/api/classifieds/mine")
test("GET /api/classifieds/mine", status == 200, f"got {status}")

# ============================================================
# SUMMARY
# ============================================================
section("SUMMARY")
print(f"\n✅ Passed: {PASS}")
print(f"❌ Failed: {FAIL}")
print(f"Total: {PASS + FAIL}")
if ERRORS:
    print(f"\n--- Errors ---")
    for e in ERRORS:
        print(f"  • {e}")
sys.exit(0 if FAIL == 0 else 1)
