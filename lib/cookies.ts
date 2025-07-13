import { NextRequest, NextResponse } from 'next/server'
import type { ConversationMessage } from '@/types'

// Server-side cookie utilities for chat history
export const getCookie = (request: NextRequest, name: string): string | null => {
  const cookie = request.cookies.get(name)
  return cookie ? decodeURIComponent(cookie.value) : null
}

export const setCookie = (response: NextResponse, name: string, value: string, days: number = 30): void => {
  const expires = new Date()
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000))
  
  response.cookies.set(name, encodeURIComponent(value), {
    expires,
    path: '/',
    sameSite: 'lax',
    httpOnly: false // Allow client-side access
  })
}

export const deleteCookie = (response: NextResponse, name: string): void => {
  response.cookies.set(name, '', {
    expires: new Date(0),
    path: '/'
  })
}

// Chat history cookie management for server-side
export const saveChatHistoryToCookie = (
  response: NextResponse, 
  conversationId: string, 
  messages: ConversationMessage[]
): void => {
  try {
    const historyData = {
      conversationId,
      messages,
      timestamp: new Date().toISOString()
    }
    setCookie(response, `chat-history-${conversationId}`, JSON.stringify(historyData), 30)
  } catch (error) {
    console.error('Failed to save chat history to cookie:', error)
  }
}

export const loadChatHistoryFromCookie = (
  request: NextRequest, 
  conversationId: string
): ConversationMessage[] => {
  try {
    const cookieData = getCookie(request, `chat-history-${conversationId}`)
    if (cookieData) {
      const historyData = JSON.parse(cookieData)
      return historyData.messages || []
    }
  } catch (error) {
    console.error('Failed to load chat history from cookie:', error)
  }
  return []
}

export const getAllChatHistoryFromCookies = (request: NextRequest): { [key: string]: ConversationMessage[] } => {
  const history: { [key: string]: ConversationMessage[] } = {}
  
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.startsWith('chat-history-')) {
      try {
        const conversationId = cookie.name.replace('chat-history-', '')
        const historyData = JSON.parse(decodeURIComponent(cookie.value))
        history[conversationId] = historyData.messages || []
      } catch (error) {
        console.error('Failed to parse chat history cookie:', error)
      }
    }
  })
  
  return history
}

export const clearChatHistoryCookie = (response: NextResponse, conversationId: string): void => {
  deleteCookie(response, `chat-history-${conversationId}`)
} 