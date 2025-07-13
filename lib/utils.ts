import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString()
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  } else {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      document.execCommand('copy')
      textArea.remove()
      return Promise.resolve(true)
    } catch (err) {
      textArea.remove()
      return Promise.resolve(false)
    }
  }
}

export function validateApiKey(apiKey: string): boolean {
  return apiKey.length > 0 && apiKey.startsWith('sk-')
}

export const DEFAULT_MODELS = [
  { id: 'mistralai/mistral-small-3.2-24b-instruct:free', name: 'Mistral Small 3.2 24B (Free)', provider: 'Mistral AI', isFree: true },
  { id: 'moonshotai/kimi-dev-72b:free', name: 'Kimi Dev 72B (Free)', provider: 'Moonshot AI', isFree: true },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', provider: 'DeepSeek', isFree: true },
  { id: 'qwen/qwen3-32b:free', name: 'Qwen 3 32B (Free)', provider: 'Qwen', isFree: true },
  { id: 'google/gemini-2.5-pro-exp-03-25', name: 'Gemini 2.5 Pro (Free)', provider: 'Google', isFree: true },
  { id: 'google/gemini-1.5-flash:free', name: 'Gemini 1.5 Flash (Free)', provider: 'Google', isFree: true }
]

export const PAID_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o (Paid)', provider: 'OpenAI', isFree: false },
  { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Paid)', provider: 'Anthropic', isFree: false },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Paid)', provider: 'OpenAI', isFree: false },
  { id: 'anthropic/claude-3-5-haiku', name: 'Claude 3.5 Haiku (Paid)', provider: 'Anthropic', isFree: false },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro (Paid)', provider: 'Google', isFree: false },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct (Paid)', provider: 'Meta', isFree: false },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo (Paid)', provider: 'OpenAI', isFree: false },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus (Paid)', provider: 'Anthropic', isFree: false },
  { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash (Paid)', provider: 'Google', isFree: false },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct (Paid)', provider: 'Meta', isFree: false }
] 

// Cookie utilities for chat history persistence
export const setCookie = (name: string, value: string, days: number = 30) => {
  if (typeof window === 'undefined') return
  
  const expires = new Date()
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000))
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

export const getCookie = (name: string): string | null => {
  if (typeof window === 'undefined') return null
  
  const nameEQ = name + "="
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length))
    }
  }
  return null
}

export const deleteCookie = (name: string) => {
  if (typeof window === 'undefined') return
  
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}

// Chat history cookie management
export const saveChatHistory = (conversationId: string, messages: any[]) => {
  try {
    const historyData = {
      conversationId,
      messages,
      timestamp: new Date().toISOString()
    }
    setCookie(`chat-history-${conversationId}`, JSON.stringify(historyData), 30)
  } catch (error) {
    console.error('Failed to save chat history to cookie:', error)
  }
}

export const loadChatHistory = (conversationId: string): any[] => {
  try {
    const cookieData = getCookie(`chat-history-${conversationId}`)
    if (cookieData) {
      const historyData = JSON.parse(cookieData)
      return historyData.messages || []
    }
  } catch (error) {
    console.error('Failed to load chat history from cookie:', error)
  }
  return []
}

export const clearChatHistory = (conversationId: string) => {
  deleteCookie(`chat-history-${conversationId}`)
}

// Get all chat history cookies
export const getAllChatHistoryCookies = (): { [key: string]: any[] } => {
  if (typeof window === 'undefined') return {}
  
  const history: { [key: string]: any[] } = {}
  const cookies = document.cookie.split(';')
  
  cookies.forEach(cookie => {
    const [name, value] = cookie.trim().split('=')
    if (name.startsWith('chat-history-')) {
      try {
        const conversationId = name.replace('chat-history-', '')
        const historyData = JSON.parse(decodeURIComponent(value))
        history[conversationId] = historyData.messages || []
      } catch (error) {
        console.error('Failed to parse chat history cookie:', error)
      }
    }
  })
  
  return history
} 