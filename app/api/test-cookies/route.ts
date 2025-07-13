import { NextRequest, NextResponse } from 'next/server'
import { getAllChatHistoryFromCookies, saveChatHistoryToCookie } from '@/lib/cookies'

export async function GET(request: NextRequest) {
  try {
    const allHistory = getAllChatHistoryFromCookies(request)
    
    return NextResponse.json({
      success: true,
      cookieCount: Object.keys(allHistory).length,
      conversations: allHistory
    })
  } catch (error) {
    console.error('Test cookies error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to read cookies'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, messages } = body
    
    const response = NextResponse.json({
      success: true,
      message: 'Test cookie saved'
    })
    
    saveChatHistoryToCookie(response, conversationId, messages)
    
    return response
  } catch (error) {
    console.error('Test cookies error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to save test cookie'
    }, { status: 500 })
  }
} 