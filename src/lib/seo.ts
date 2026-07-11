import { db } from './db'

export async function getSeoSettings(): Promise<Record<string, string>> {
  const rows = await db.seoSetting.findMany()
  const result: Record<string, string> = {}
  for (const r of rows) result[r.key] = r.value
  return result
}

export async function getSeoSetting(key: string): Promise<string | null> {
  const row = await db.seoSetting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function setSeoSetting(key: string, value: string) {
  return db.seoSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

export async function setSeoSettings(map: Record<string, string>) {
  for (const [k, v] of Object.entries(map)) {
    await setSeoSetting(k, v)
  }
}

// Points & Credits helpers
export async function getPointsConfig() {
  const settings = await getSeoSettings()
  return {
    pointsPerRead: parseInt(settings.points_per_read || '10', 10),
    maxReadsPerPost: parseInt(settings.max_reads_per_post || '50', 10),
    pointsPerReaction: parseInt(settings.points_per_reaction || '5', 10),
    maxReactionsPerPost: parseInt(settings.max_reactions_per_post || '30', 10),
    creditsConversionRate: parseInt(settings.credits_conversion_rate || '10', 10),
    freeAdCostCredits: parseInt(settings.free_ad_cost_credits || '20', 10),
  }
}
