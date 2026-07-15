'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Newspaper, Eye, Users, Megaphone, FileText, TrendingUp, ArrowRight,
  DollarSign, CreditCard, Wallet, Crown, ShoppingBag, BadgeCheck, Clock,
  AlertCircle, CheckCircle, Store,
} from 'lucide-react'
import { ArticleCard } from '@/components/portal/ArticleCard'
import { cn, formatDate, formatBRL } from '@/lib/utils'

export function AdminDashboard() {
  const { setView, user } = useAppStore()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data) {
    return <div className="text-zinc-500">Carregando dashboard...</div>
  }

  if (data.error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{data.error}</div>
  }

  const { stats, recentPosts, topPosts, byCategory, postsByDay, financial, moderation } = data
  const isMasterOrAdmin = !!user && ['MASTER', 'ADMIN'].includes(user.role)

  return (
    <div className="space-y-6">
      {/* === Moderation queue alert === */}
      {(moderation?.pendingVerifications > 0 || moderation?.pendingPosts > 0 || moderation?.pendingClassifieds > 0 || moderation?.pendingAds > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-amber-900 text-sm mb-2">Itens aguardando moderação</div>
              <div className="flex flex-wrap gap-2">
                {moderation.pendingVerifications > 0 && (
                  <button onClick={() => setView({ name: 'admin', section: 'verifications' })} className="inline-flex items-center gap-1.5 bg-white border border-amber-300 rounded-md px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
                    <BadgeCheck className="h-3.5 w-3.5" /> {moderation.pendingVerifications} verificação(ões) CPF/CNPJ
                  </button>
                )}
                {moderation.pendingPosts > 0 && (
                  <button onClick={() => setView({ name: 'admin', section: 'review' })} className="inline-flex items-center gap-1.5 bg-white border border-amber-300 rounded-md px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
                    <FileText className="h-3.5 w-3.5" /> {moderation.pendingPosts} notícia(s) para revisar
                  </button>
                )}
                {moderation.pendingClassifieds > 0 && (
                  <button onClick={() => setView({ name: 'admin', section: 'classifieds' })} className="inline-flex items-center gap-1.5 bg-white border border-amber-300 rounded-md px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
                    <Store className="h-3.5 w-3.5" /> {moderation.pendingClassifieds} classificado(s)
                  </button>
                )}
                {moderation.pendingAds > 0 && (
                  <button onClick={() => setView({ name: 'admin', section: 'ads' })} className="inline-flex items-center gap-1.5 bg-white border border-amber-300 rounded-md px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">
                    <Megaphone className="h-3.5 w-3.5" /> {moderation.pendingAds} anúncio(s)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Content stat cards === */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={Newspaper} label="Total de Notícias" value={stats.postsCount} color="bg-blue-50 text-blue-600" onClick={() => setView({ name: 'admin', section: 'posts' })} />
        <StatCard icon={FileText} label="Publicadas" value={stats.publishedCount} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={FileText} label="Rascunhos" value={stats.draftsCount} color="bg-amber-50 text-amber-600" />
        <StatCard icon={Eye} label="Total de Visualizações" value={stats.totalViews} color="bg-purple-50 text-purple-600" />
        {isMasterOrAdmin && <StatCard icon={Users} label="Usuários" value={stats.usersCount} color="bg-rose-50 text-rose-600" onClick={() => setView({ name: 'admin', section: 'users' })} />}
        {isMasterOrAdmin && <StatCard icon={Megaphone} label="Anúncios" value={stats.adsCount} color="bg-cyan-50 text-cyan-600" onClick={() => setView({ name: 'admin', section: 'ads' })} />}
      </div>

      {/* === Financial section === */}
      {financial && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" /> Métricas Financeiras
            </h2>
            <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
              {financial.activeSubscriptions} assinatura(s) ativa(s)
            </Badge>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <FinancialCard
              icon={DollarSign}
              label="MRR (receita mensal)"
              value={formatBRL(financial.mrrCents)}
              sublabel="Soma das assinaturas ativas"
              color="emerald"
            />
            <FinancialCard
              icon={Wallet}
              label="Receita total"
              value={formatBRL(financial.totalRevenueCents)}
              sublabel={`${financial.paidTxCount} transações pagas`}
              color="blue"
            />
            <FinancialCard
              icon={TrendingUp}
              label="Receita 30 dias"
              value={formatBRL(financial.revenue30dCents)}
              sublabel={`${financial.paidTx30dCount} transações no período`}
              color="purple"
            />
            <FinancialCard
              icon={CreditCard}
              label="ARPU (ticket médio)"
              value={formatBRL(financial.arpuCents)}
              sublabel="Por assinatura ativa"
              color="amber"
            />
          </div>

          {/* Revenue chart + plans breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Receita por dia (últimos 14 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-40">
                  {financial.revenueByDay.map((d: any) => {
                    const max = Math.max(...financial.revenueByDay.map((x: any) => x.cents), 1)
                    const height = (d.cents / max) * 100
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="text-[10px] font-bold text-zinc-700 opacity-0 group-hover:opacity-100">
                          {d.cents > 0 ? formatBRL(d.cents) : ''}
                        </div>
                        <div className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors" style={{ height: `${Math.max(height, 2)}%`, minHeight: '2px' }} />
                        <div className="text-[9px] text-zinc-500">{new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit' })}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 text-xs text-zinc-500 text-center">
                  Total no período: <strong className="text-emerald-700">{formatBRL(financial.revenueByDay.reduce((s: number, d: any) => s + d.cents, 0))}</strong>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-600" /> Assinaturas por plano
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {financial.planAggregation.map((p: any) => {
                    const maxCount = Math.max(...financial.planAggregation.map((x: any) => x.activeCount), 1)
                    const pct = (p.activeCount / maxCount) * 100
                    return (
                      <div key={p.planId} className="flex items-center gap-3">
                        <div className="text-sm font-medium text-zinc-700 w-28 truncate">{p.planName}</div>
                        <div className="flex-1 bg-zinc-100 rounded h-7 overflow-hidden relative">
                          <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-full transition-all" style={{ width: `${pct}%` }} />
                          <div className="absolute inset-0 flex items-center justify-between px-2">
                            <span className="text-[10px] font-bold text-zinc-700">{p.activeCount} ativa(s)</span>
                            <span className="text-[10px] font-bold text-emerald-700">{formatBRL(p.monthlyRevenueCents)}/mês</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {financial.planAggregation.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-4">Nenhuma assinatura ativa.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Transactions table + breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Transações recentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto">
                  {financial.recentTransactions.length === 0 ? (
                    <div className="text-center py-8 text-sm text-zinc-500">
                      <CreditCard className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                      Nenhuma transação registrada ainda.
                    </div>
                  ) : (
                    financial.recentTransactions.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-3 p-2.5 hover:bg-zinc-50">
                        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                          t.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                          t.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {t.status === 'PAID' ? <CheckCircle className="h-4 w-4" /> : t.status === 'PENDING' ? <Clock className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-900 truncate">{t.description || t.type}</div>
                          <div className="text-xs text-zinc-500">
                            {t.user?.name} · {formatDate(t.createdAt, 'datetime')} · {t.provider}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-zinc-900">{formatBRL(t.amountCents)}</div>
                          {t.discountCents > 0 && (
                            <div className="text-[10px] text-amber-600">- {formatBRL(t.discountCents)} desc.</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Por tipo</CardTitle></CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {financial.txByType.map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600">{t.typeLabel}</span>
                      <div className="text-right">
                        <div className="font-bold text-zinc-900">{formatBRL(t.totalCents)}</div>
                        <div className="text-[10px] text-zinc-500">{t.count} trans.</div>
                      </div>
                    </div>
                  ))}
                  {financial.txByType.length === 0 && <p className="text-xs text-zinc-400 text-center py-2">Sem dados</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Por gateway</CardTitle></CardHeader>
                <CardContent className="p-3 space-y-1.5">
                  {financial.txByProvider.map((t: any) => (
                    <div key={t.provider} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600">{t.providerLabel}</span>
                      <div className="text-right">
                        <div className="font-bold text-zinc-900">{formatBRL(t.totalCents)}</div>
                        <div className="text-[10px] text-zinc-500">{t.count} trans.</div>
                      </div>
                    </div>
                  ))}
                  {financial.txByProvider.length === 0 && <p className="text-xs text-zinc-400 text-center py-2">Sem dados</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* === Content charts === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posts por dia (últimos 7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {postsByDay.map((d: any) => {
                const max = Math.max(...postsByDay.map((x: any) => x.count), 1)
                const height = (d.count / max) * 100
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs font-bold text-zinc-700">{d.count}</div>
                    <div className="w-full bg-primary rounded-t" style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }} />
                    <div className="text-[10px] text-zinc-500">{new Date(d.date).toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Posts por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {byCategory.map((c: any) => {
                const max = Math.max(...byCategory.map((x: any) => x.count), 1)
                const pct = (c.count / max) * 100
                return (
                  <div key={c.name} className="flex items-center gap-2">
                    <div className="text-xs font-medium text-zinc-700 w-20 truncate">{c.name}</div>
                    <div className="flex-1 bg-zinc-100 rounded h-5 overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs font-bold text-zinc-900 w-6 text-right">{c.count}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Posts Recentes</span>
            <button onClick={() => setView({ name: 'admin', section: 'posts' })} className="text-xs text-primary hover:underline flex items-center">
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentPosts.map((p: any) => (
              <div
                key={p.id}
                onClick={() => setView({ name: 'admin', section: 'editor', postId: p.id })}
                className="flex items-center gap-3 p-2 hover:bg-zinc-50 rounded cursor-pointer"
              >
                <div className="w-12 h-12 rounded bg-zinc-100 overflow-hidden flex-shrink-0">
                  {p.coverImage && <img src={p.coverImage} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 line-clamp-1">{p.title}</div>
                  <div className="text-xs text-zinc-500">{p.category.name} · {p.author.name}</div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded font-bold ${p.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {p.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Mais Lidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topPosts.map((p: any) => (
              <ArticleCard key={p.id} post={p} variant="compact" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} onClick={onClick}>
      <CardContent className="pt-5">
        <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${color} mb-2`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-bold text-2xl text-zinc-900">{value.toLocaleString('pt-BR')}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </CardContent>
    </Card>
  )
}

function FinancialCard({ icon: Icon, label, value, sublabel, color }: { icon: any; label: string; value: string; sublabel: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  return (
    <div className={cn('rounded-lg border p-4', colors[color])}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-5 w-5 opacity-70" />
      </div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-medium opacity-80 mt-0.5">{label}</div>
      <div className="text-[10px] opacity-60 mt-0.5">{sublabel}</div>
    </div>
  )
}
