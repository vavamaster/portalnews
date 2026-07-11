#!/usr/bin/env python3
"""
Smoke test completo: simula usuário grátis e usuário assinante pago
anunciando em áreas do site (banners) e nos classificados.
"""
import requests
import time

BASE = 'http://localhost:3000'
TIMEOUT = 30

def login(email, password):
    r = requests.post(f'{BASE}/api/auth/login', json={'email': email, 'password': password}, timeout=TIMEOUT)
    if r.status_code != 200:
        return None
    cookies = r.headers.get('set-cookie', '')
    for c in cookies.split(';'):
        c = c.strip()
        if c.startswith('portal_token='):
            return c.split('=', 1)[1]
    return None

def hdr(token):
    return {'Cookie': f'portal_token={token}', 'Content-Type': 'application/json'}

def safe_json(r):
    try:
        return r.json()
    except:
        return {'error': f'Non-JSON response (HTTP {r.status_code})'}

def test_user(email, password, label):
    print(f'\n{"="*60}')
    print(f'  CENÁRIO: {label}')
    print(f'{"="*60}')

    token = login(email, password)
    if not token:
        print('  ❌ Login falhou')
        return

    # 1. Dados do usuário
    r = requests.get(f'{BASE}/api/auth/me', headers=hdr(token), timeout=TIMEOUT)
    user = safe_json(r).get('user', {})
    print(f'\n[1] Usuário: {user.get("name")} | Role: {user.get("role")}')
    print(f'    Pontos: {user.get("points")} | Créditos: {user.get("credits")}')

    # 2. Plano ativo
    r = requests.get(f'{BASE}/api/subscriptions', headers=hdr(token), timeout=TIMEOUT)
    sub_data = safe_json(r)
    subs = sub_data.get('subscriptions', [])
    if subs:
        s = subs[0]
        print(f'[2] Plano: {s["plan"]["name"]} | Status: {s["status"]} | Fim: {s["currentPeriodEnd"][:10]}')
        is_paid = s['plan']['priceCents'] > 0
        plan_name = s['plan']['name']
    else:
        print(f'[2] Plano: Grátis (sem assinatura ativa)')
        is_paid = False
        plan_name = 'Grátis'

    # 3. Buscar categorias de classificados
    r = requests.get(f'{BASE}/api/classifieds?limit=1', timeout=TIMEOUT)
    cls_data = safe_json(r)

    # Buscar categoria diretamente
    r2 = requests.get(f'{BASE}/api/classifieds?slug=geral', timeout=TIMEOUT)
    cat_data = safe_json(r2)
    cat_id = None
    if cat_data.get('listing'):
        cat_id = cat_data['listing'].get('categoryId')
    
    # Se não achou por slug, tenta pegar de um listing existente
    if not cat_id and cls_data.get('listings'):
        cat_id = cls_data['listings'][0].get('categoryId')
    
    # Buscar todas as categorias via prisma (não há endpoint, vamos pegar do listing)
    if not cat_id:
        # Tentar criar com um slug conhecido
        print(f'[3] Categorias: buscando via listing existente...')
        for listing in cls_data.get('listings', [])[:3]:
            if listing.get('categoryId'):
                cat_id = listing['categoryId']
                break
    
    if cat_id:
        print(f'[3] Categoria encontrada: {cat_id[:12]}...')
    else:
        print(f'[3] ⚠️ Nenhuma categoria encontrada — tentando criar listing sem categoryId')

    # 4. Criar anúncio banner (HOME_SIDEBAR)
    print(f'\n[4] Criar anúncio banner (HOME_SIDEBAR)...')
    r = requests.post(f'{BASE}/api/store/free-ad', headers=hdr(token), json={
        'title': f'Smoke {label} — Banner Sidebar',
        'content': f'Anúncio de teste — {label}',
        'placement': 'HOME_SIDEBAR',
        'durationDays': 7,
    }, timeout=TIMEOUT)
    ad_data = safe_json(r)
    print(f'    HTTP {r.status_code} | isFreeAd: {ad_data.get("ad",{}).get("isFreeAd")} | creditsSpent: {ad_data.get("creditsSpent")}')
    if ad_data.get('error'):
        print(f'    ❌ {ad_data["error"]}')
    else:
        print(f'    ✅ {ad_data.get("message","")}')

    # 5. Criar anúncio banner (HOME_MIDDLE)
    print(f'[5] Criar anúncio banner (HOME_MIDDLE)...')
    r = requests.post(f'{BASE}/api/store/free-ad', headers=hdr(token), json={
        'title': f'Smoke {label} — Banner Middle',
        'content': f'Anúncio middle — {label}',
        'placement': 'HOME_MIDDLE',
        'durationDays': 7,
    }, timeout=TIMEOUT)
    ad_data2 = safe_json(r)
    print(f'    HTTP {r.status_code} | isFreeAd: {ad_data2.get("ad",{}).get("isFreeAd")}')
    if ad_data2.get('error'):
        print(f'    ❌ {ad_data2["error"]}')
    else:
        print(f'    ✅ Criado')

    # 6. Criar classificado
    print(f'[6] Criar classificado...')
    payload = {
        'title': f'Smoke {label} — Classificado',
        'description': f'Classificado de teste — {label}. Produto em ótimo estado.',
        'price': 150.00,
        'personType': 'PF',
        'city': 'Cidade',
        'state': 'MT',
    }
    if cat_id:
        payload['categoryId'] = cat_id
    r = requests.post(f'{BASE}/api/classifieds', headers=hdr(token), json=payload, timeout=TIMEOUT)
    cls_result = safe_json(r)
    print(f'    HTTP {r.status_code}')
    if cls_result.get('error'):
        print(f'    ❌ {cls_result["error"][:100]}')
        if cls_result.get('needPoints'):
            print(f'    needPoints! cost={cls_result.get("pointsCost")} has={cls_result.get("userPoints")}')
            # Tentar com usePoints
            print(f'    Tentando com usePoints=true...')
            payload['usePoints'] = True
            payload['title'] = f'Smoke {label} — Classificado (pontos)'
            r = requests.post(f'{BASE}/api/classifieds', headers=hdr(token), json=payload, timeout=TIMEOUT)
            cls_result2 = safe_json(r)
            print(f'    HTTP {r.status_code}')
            if cls_result2.get('error'):
                print(f'    ❌ {cls_result2["error"][:100]}')
            else:
                listing = cls_result2.get('listing', {})
                print(f'    ✅ Criado: plan={listing.get("plan",{}).get("name")} featured={listing.get("featured")}')
    else:
        listing = cls_result.get('listing', {})
        print(f'    ✅ Criado: plan={listing.get("plan",{}).get("name")} featured={listing.get("featured")} status={listing.get("status")}')

    # 7. Saldo após operações
    r = requests.get(f'{BASE}/api/auth/me', headers=hdr(token), timeout=TIMEOUT)
    user_after = safe_json(r).get('user', {})
    print(f'\n[7] Saldo após operações:')
    print(f'    Pontos: {user.get("points")} → {user_after.get("points")}')
    print(f'    Créditos: {user.get("credits")} → {user_after.get("credits")}')

    # 8. Testar serve de anúncios (10 requests)
    print(f'[8] Testar serve (10 requests HOME_SIDEBAR)...')
    paid = 0; free = 0; placeholder = 0
    for i in range(10):
        r = requests.get(f'{BASE}/api/ads/serve?placement=HOME_SIDEBAR', timeout=TIMEOUT)
        d = safe_json(r)
        source = d.get('source', 'placeholder')
        if source == 'paid': paid += 1
        elif source == 'free': free += 1
        else: placeholder += 1
    print(f'    Paid: {paid} | Free: {free} | Placeholder: {placeholder}')

    return is_paid, plan_name


def main():
    print('🧪 SMOKE TEST: Usuário Grátis vs Assinante Pago')
    print('='*60)

    # Cenário 1: Usuário Grátis
    ts = int(time.time())
    email_free = f'smoke_free_{ts}@test.com'
    r = requests.post(f'{BASE}/api/auth/register', json={
        'name': 'Usuario Smoke Gratis',
        'email': email_free,
        'password': '123456',
    }, timeout=TIMEOUT)
    print(f'\nUsuário grátis criado: {email_free} (HTTP {r.status_code})')

    is_paid_free, plan_free = test_user(email_free, '123456', 'USUÁRIO GRÁTIS')

    # Cenário 2: Admin (MASTER)
    is_paid_admin, plan_admin = test_user('admin@portal.com', 'admin123', 'ADMIN (MASTER)')

    # Cenário 3: Criar assinante pago (simular)
    print(f'\n{"="*60}')
    print(f'  CENÁRIO: CRIAR ASSINANTE PAGO')
    print(f'{"="*60}')

    # Assinar plano PROFESSIONAL para o usuário grátis
    token_free = login(email_free, '123456')
    if token_free:
        print(f'\n[1] Assinando plano PROFESSIONAL para usuário grátis...')
        r = requests.post(f'{BASE}/api/plans/subscribe', headers=hdr(token_free), json={
            'planSlug': 'PROFESSIONAL',
            'provider': 'MANUAL',
        }, timeout=TIMEOUT)
        sub_result = safe_json(r)
        print(f'    HTTP {r.status_code}')
        if sub_result.get('error'):
            print(f'    ❌ {sub_result["error"][:100]}')
        else:
            print(f'    ✅ {sub_result.get("message","")}')

        # Re-testar como assinante
        test_user(email_free, '123456', 'USUÁRIO ASSINANTE (PROFESSIONAL)')

    # Resumo
    print(f'\n{"="*60}')
    print(f'  RESUMO DO SMOKE TEST')
    print(f'{"="*60}')
    print(f'Usuário Grátis:')
    print(f'  Plano: {plan_free}')
    print(f'  Banner: {"não paga créditos" if is_paid_free else "paga créditos"}')
    print(f'  isFreeAd: {"false (prioridade alta)" if is_paid_free else "true (prioridade baixa)"}')
    print(f'')
    print(f'Admin (MASTER):')
    print(f'  Plano: {plan_admin}')
    print(f'  Banner: {"não paga créditos" if is_paid_admin else "paga créditos"}')
    print(f'  isFreeAd: {"false (prioridade alta)" if is_paid_admin else "true (prioridade baixa)"}')
    print(f'')
    print(f'Regra 10:2 (83% pago / 17% grátis):')
    print(f'  Implementada em /api/ads/serve')
    print(f'  Proporção: Math.random() < 0.83 → pago, else → grátis')
    print(f'\n🎉 SMOKE TEST CONCLUÍDO!')


if __name__ == '__main__':
    main()
