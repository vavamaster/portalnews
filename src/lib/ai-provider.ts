import { db } from './db'

// ============= AI PROVIDER INTERFACE =============
// Supports: ZAI (default), OpenAI, Google Gemini, Anthropic Claude, Ollama (local), Custom

export interface AIProviderConfig {
  id: string
  provider: string // ZAI | OPENAI | GEMINI | CLAUDE | OLLAMA | CUSTOM
  displayName: string
  baseUrl?: string | null
  apiKey?: string | null
  model: string
  maxTokens: number
  temperature: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

// ============= Get active/default provider config from DB =============
export async function getActiveProvider(): Promise<AIProviderConfig | null> {
  // Try default first
  let config = await db.aIConfig.findFirst({
    where: { isDefault: true, isEnabled: true },
  })
  // Fallback to any enabled
  if (!config) {
    config = await db.aIConfig.findFirst({
      where: { isEnabled: true },
    })
  }
  if (!config) return null
  return {
    id: config.id,
    provider: config.provider,
    displayName: config.displayName,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
  }
}

// ============= Unified chat completion =============
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; json?: boolean }
): Promise<AIResponse> {
  const provider = await getActiveProvider()
  if (!provider) {
    throw new Error('Nenhum provider de IA configurado. Configure no painel administrativo.')
  }

  switch (provider.provider) {
    case 'ZAI':
      return chatZAI(provider, messages, options)
    case 'OPENAI':
    case 'CUSTOM':
      return chatOpenAICompatible(provider, messages, options)
    case 'GEMINI':
      return chatGemini(provider, messages, options)
    case 'CLAUDE':
      return chatClaude(provider, messages, options)
    case 'OLLAMA':
      return chatOllama(provider, messages, options)
    default:
      // Try OpenAI-compatible as fallback
      return chatOpenAICompatible(provider, messages, options)
  }
}

// ============= ZAI (z-ai-web-dev-sdk) =============

// A13 fix: cache ZAI client to avoid re-importing and re-creating on every call
let _zaiClient: Promise<any> | null = null
async function getZaiClient() {
  if (!_zaiClient) {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    _zaiClient = ZAI.create()
  }
  return _zaiClient
}

async function chatZAI(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; json?: boolean }
): Promise<AIResponse> {
  const zai = await getZaiClient()

  // Convert messages: ZAI uses 'assistant' role for system prompt
  const zaiMessages = messages.map(m => ({
    role: m.role === 'system' ? 'assistant' : m.role,
    content: m.content,
  }))

  // A5 fix: pass maxTokens and temperature (were being ignored)
  const completion = await zai.chat.completions.create({
    messages: zaiMessages as any,
    thinking: { type: 'disabled' },
    max_tokens: options?.maxTokens || provider.maxTokens,
    temperature: options?.temperature ?? provider.temperature,
  } as any)

  return {
    content: completion.choices[0]?.message?.content || '',
    usage: completion.usage ? {
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
    } : undefined,
  }
}

// ============= OpenAI-compatible (OpenAI, Azure, Ollama, vLLM, etc) =============
async function chatOpenAICompatible(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; json?: boolean }
): Promise<AIResponse> {
  const baseUrl = provider.baseUrl || 'https://api.openai.com/v1'
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`
  }

  const body: any = {
    model: provider.model,
    messages,
    max_tokens: options?.maxTokens || provider.maxTokens,
    temperature: options?.temperature ?? provider.temperature,
  }
  if (options?.json) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${errText.substring(0, 500)}`)
  }

  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  }
}

// ============= Google Gemini =============
async function chatGemini(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; json?: boolean }
): Promise<AIResponse> {
  const baseUrl = provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
  const model = provider.model
  const apiKey = provider.apiKey

  if (!apiKey) throw new Error('Gemini requires API key')

  // Convert messages to Gemini format
  const systemMsg = messages.find(m => m.role === 'system')
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const body: any = {
    contents,
    generationConfig: {
      maxOutputTokens: options?.maxTokens || provider.maxTokens,
      temperature: options?.temperature ?? provider.temperature,
    },
  }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  }
  if (options?.json) {
    body.generationConfig.responseMimeType = 'application/json'
  }

  const res = await fetch(`${baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${errText.substring(0, 500)}`)
  }

  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
  return { content, usage: data.usageMetadata ? {
    promptTokens: data.usageMetadata.promptTokenCount,
    completionTokens: data.usageMetadata.candidatesTokenCount,
    totalTokens: data.usageMetadata.totalTokenCount,
  } : undefined }
}

// ============= Anthropic Claude =============
async function chatClaude(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; json?: boolean }
): Promise<AIResponse> {
  const baseUrl = provider.baseUrl || 'https://api.anthropic.com/v1'
  const apiKey = provider.apiKey
  if (!apiKey) throw new Error('Claude requires API key')

  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }))

  const body: any = {
    model: provider.model,
    messages: chatMessages,
    max_tokens: options?.maxTokens || provider.maxTokens,
    temperature: options?.temperature ?? provider.temperature,
  }
  if (systemMsg) {
    body.system = systemMsg.content
  }

  const res = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Claude API error ${res.status}: ${errText.substring(0, 500)}`)
  }

  const data = await res.json()
  const content = data.content?.map((c: any) => c.text).join('') || ''
  return { content, usage: data.usage ? {
    promptTokens: data.usage.input_tokens,
    completionTokens: data.usage.output_tokens,
  } : undefined }
}

// ============= Ollama (local) =============
async function chatOllama(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number; json?: boolean }
): Promise<AIResponse> {
  const baseUrl = provider.baseUrl || 'http://localhost:11434'

  const body: any = {
    model: provider.model,
    messages,
    options: {
      num_predict: options?.maxTokens || provider.maxTokens,
      temperature: options?.temperature ?? provider.temperature,
    },
    stream: false,
  }
  if (options?.json) {
    body.format = 'json'
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Ollama API error ${res.status}: ${errText.substring(0, 500)}`)
  }

  const data = await res.json()
  return {
    content: data.message?.content || '',
    usage: data.eval_count ? { completionTokens: data.eval_count } : undefined,
  }
}

// ============= Test provider connection =============
export async function testProvider(config: AIProviderConfig): Promise<{ success: boolean; message: string; response?: string }> {
  try {
    const testMessages: ChatMessage[] = [
      { role: 'user', content: 'Responda apenas: "Conexão OK"' },
    ]

    // Temporarily set this config as active
    const response = await chatWithProvider(config, testMessages, { maxTokens: 50 })
    return {
      success: true,
      message: 'Conexão estabelecida com sucesso!',
      response: response.content.substring(0, 100),
    }
  } catch (e: any) {
    return {
      success: false,
      message: e.message || 'Erro ao conectar',
    }
  }
}

// Chat with a specific provider (for testing)
async function chatWithProvider(
  provider: AIProviderConfig,
  messages: ChatMessage[],
  options?: { maxTokens?: number }
): Promise<AIResponse> {
  switch (provider.provider) {
    case 'ZAI':
      return chatZAI(provider, messages, options)
    case 'OPENAI':
    case 'CUSTOM':
      return chatOpenAICompatible(provider, messages, options)
    case 'GEMINI':
      return chatGemini(provider, messages, options)
    case 'CLAUDE':
      return chatClaude(provider, messages, options)
    case 'OLLAMA':
      return chatOllama(provider, messages, options)
    default:
      return chatOpenAICompatible(provider, messages, options)
  }
}

// ============= Provider metadata =============
export const PROVIDER_PRESETS = [
  {
    provider: 'ZAI',
    displayName: 'ZAI (GLM-4)',
    description: 'IA brasileira da Z.ai. Padrão do sistema, sem necessidade de API key.',
    baseUrl: null,
    model: 'glm-4-plus',
    needsApiKey: false,
    icon: '🤖',
  },
  {
    provider: 'OPENAI',
    displayName: 'OpenAI (GPT-4)',
    description: 'GPT-4o, GPT-4 Turbo, GPT-3.5. Requer API key da OpenAI.',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    needsApiKey: true,
    icon: '🟢',
  },
  {
    provider: 'GEMINI',
    displayName: 'Google Gemini',
    description: 'Gemini 1.5 Pro/Flash. Requer API key do Google AI Studio.',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-1.5-pro',
    needsApiKey: true,
    icon: '🔵',
  },
  {
    provider: 'CLAUDE',
    displayName: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet/Opus. Requer API key da Anthropic.',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
    needsApiKey: true,
    icon: '🟠',
  },
  {
    provider: 'OLLAMA',
    displayName: 'Ollama (Local)',
    description: 'IA local gratuita. Requer Ollama instalado no servidor. Sem API key.',
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
    needsApiKey: false,
    icon: '🦙',
  },
  {
    provider: 'CUSTOM',
    displayName: 'Custom (OpenAI-compatible)',
    description: 'Qualquer API compatível com OpenAI: vLLM, LM Studio, Together, Groq, etc.',
    baseUrl: '',
    model: '',
    needsApiKey: true,
    icon: '⚙️',
  },
] as const
