import { z } from 'zod'

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional()
const dateText = z.string().trim().refine(value => !Number.isNaN(Date.parse(value)), 'Data inválida').nullable().optional()
const externalUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}, 'URL inválida')
const mediaUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}, 'URL de mídia inválida')

export const USER_ROLES = ['MASTER', 'ADMIN', 'EDITOR', 'READER'] as const
export const AD_STATUSES = ['PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'REJECTED'] as const
export const AD_PLACEMENTS = [
  'HEADER_BANNER', 'HOME_TOP', 'HOME_SIDEBAR', 'HOME_MIDDLE',
  'ARTICLE_TOP', 'ARTICLE_MIDDLE', 'ARTICLE_SIDEBAR', 'FOOTER_BANNER',
] as const

export const adminAdSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().max(10_000).default(''),
  imageUrl: mediaUrl.optional().default(''),
  linkUrl: externalUrl.optional().default(''),
  placement: z.enum(AD_PLACEMENTS),
  status: z.enum(AD_STATUSES).default('ACTIVE'),
  categoryId: nullableText(100),
  startAt: dateText,
  endAt: dateText,
}).strict().superRefine((data, ctx) => {
  if (data.startAt && data.endAt && new Date(data.endAt) < new Date(data.startAt)) {
    ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'Data final deve ser posterior à inicial' })
  }
})

export const adminAdUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  content: z.string().max(10_000).optional(),
  imageUrl: mediaUrl.optional(),
  linkUrl: externalUrl.optional(),
  placement: z.enum(AD_PLACEMENTS).optional(),
  status: z.enum(AD_STATUSES).optional(),
  categoryId: nullableText(100),
  startAt: dateText,
  endAt: dateText,
}).strict()

const headerSlideSchema = z.object({
  url: mediaUrl.refine(value => value.length > 0, 'Imagem obrigatÃ³ria'),
  link: externalUrl.optional().nullable(),
}).strict()

function parseHeaderImages(value: unknown) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('[')) return trimmed
  try { return JSON.parse(trimmed) } catch { return value }
}

export const headerAdSchema = z.object({
  name: z.string().trim().min(1).max(160),
  type: z.enum(['static', 'slider']),
  images: z.preprocess(parseHeaderImages, z.union([
    mediaUrl.refine(value => value.length > 0, 'Imagem obrigatÃ³ria'),
    z.array(headerSlideSchema).min(1).max(20),
  ])),
  linkUrl: externalUrl.optional().nullable(),
  animation: z.enum(['none', 'fade', 'slide', 'kenburns']).default('fade'),
  slideInterval: z.coerce.number().int().min(1_000).max(120_000).default(5_000),
  position: z.enum(['above-brand', 'below-brand', 'below-nav', 'replace-ticker']).default('below-nav'),
  startAt: dateText,
  endAt: dateText,
  daysOfWeek: z.string().regex(/^[0-6](?:,[0-6])*$/, 'Dias da semana invÃ¡lidos').nullable().optional(),
  hourRange: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/, 'Faixa de horÃ¡rio invÃ¡lida').nullable().optional(),
  isActive: z.boolean().default(true),
  priority: z.coerce.number().int().min(-10_000).max(10_000).default(0),
  openNewTab: z.boolean().default(true),
  widthHint: z.coerce.number().int().min(1).max(4_000).default(728),
  heightHint: z.coerce.number().int().min(1).max(2_000).default(90),
}).strict().superRefine((data, ctx) => {
  if (data.type === 'static' && typeof data.images !== 'string') {
    ctx.addIssue({ code: 'custom', path: ['images'], message: 'AnÃºncio estÃ¡tico aceita uma imagem' })
  }
  if (data.type === 'slider' && !Array.isArray(data.images)) {
    ctx.addIssue({ code: 'custom', path: ['images'], message: 'Slider exige uma lista de imagens' })
  }
  if (data.startAt && data.endAt && new Date(data.endAt) < new Date(data.startAt)) {
    ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'Data final deve ser posterior Ã  inicial' })
  }
})

export const headerAdUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['static', 'slider']).optional(),
  images: z.preprocess(parseHeaderImages, z.union([
    mediaUrl.refine(value => value.length > 0, 'Imagem obrigatÃ³ria'),
    z.array(headerSlideSchema).min(1).max(20),
  ]).optional()),
  linkUrl: externalUrl.optional().nullable(),
  animation: z.enum(['none', 'fade', 'slide', 'kenburns']).optional(),
  slideInterval: z.coerce.number().int().min(1_000).max(120_000).optional(),
  position: z.enum(['above-brand', 'below-brand', 'below-nav', 'replace-ticker']).optional(),
  startAt: dateText,
  endAt: dateText,
  daysOfWeek: z.string().regex(/^[0-6](?:,[0-6])*$/, 'Dias da semana invÃ¡lidos').nullable().optional(),
  hourRange: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/, 'Faixa de horÃ¡rio invÃ¡lida').nullable().optional(),
  isActive: z.boolean().optional(),
  priority: z.coerce.number().int().min(-10_000).max(10_000).optional(),
  openNewTab: z.boolean().optional(),
  widthHint: z.coerce.number().int().min(1).max(4_000).optional(),
  heightHint: z.coerce.number().int().min(1).max(2_000).optional(),
}).strict()

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido'),
  description: nullableText(500),
  color: nullableText(30),
  icon: nullableText(60),
  parentId: nullableText(100),
  order: z.coerce.number().int().min(0).max(10_000).optional(),
}).strict()
export const categoryUpdateSchema = categoryCreateSchema.partial().extend({ id: z.string().min(1).max(100) }).strict()

export const quoteProductSchema = z.object({
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  shortName: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(60),
  unit: z.string().trim().min(1).max(30).optional(),
  icon: z.string().trim().min(1).max(60).optional(),
  color: z.string().trim().min(1).max(30).optional(),
  sourceId: z.string().min(1).max(100),
  externalCode: z.string().trim().max(100).optional().nullable(),
  decimals: z.coerce.number().int().min(0).max(6).optional(),
  isActive: z.boolean().optional(),
  order: z.coerce.number().int().min(0).max(10_000).optional(),
}).strict()

export const quoteSourceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  baseUrl: externalUrl.optional().nullable(),
  apiType: z.enum(['REST', 'JSON', 'XML', 'CSV', 'HTML', 'MOCK']).optional(),
  isActive: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(10_000).optional(),
  headers: z.record(z.string(), z.string().max(2_000)).optional().nullable(),
}).strict()

export const couponSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Código inválido'),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.coerce.number().positive().max(100_000_000),
  minAmountCents: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  maxRedemptions: z.coerce.number().int().min(-1).max(10_000_000).optional(),
  validFrom: z.union([z.literal(''), z.string().refine(value => !Number.isNaN(Date.parse(value)), 'Data inválida')]).optional(),
  validUntil: z.union([z.literal(''), z.string().refine(value => !Number.isNaN(Date.parse(value)), 'Data inválida')]).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(500).optional(),
  appliesTo: z.enum(['SUBSCRIPTION', 'BOOST', 'ALL']).optional(),
  firstTimeOnly: z.boolean().optional(),
}).strict().superRefine((data, ctx) => {
  if (data.type === 'PERCENT' && data.value > 100) ctx.addIssue({ code: 'custom', path: ['value'], message: 'Percentual não pode superar 100%' })
  if (data.validFrom && data.validUntil && new Date(data.validUntil) < new Date(data.validFrom)) {
    ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'Data final deve ser posterior à inicial' })
  }
})

export function validationError(error: z.ZodError) {
  return error.issues.map(issue => `${issue.path.join('.') || 'dados'}: ${issue.message}`).join('; ')
}
