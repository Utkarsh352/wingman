import { NextRequest, NextResponse } from 'next/server'
import { AI_PERSONALITIES } from '@/lib/personalities'
import { generateId } from '@/lib/utils'
import { loadChatHistoryFromCookie, saveChatHistoryToCookie } from '@/lib/cookies'
import type { CoachRequest, ApiError, ConversationMessage } from '@/types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export async function POST(request: NextRequest) {
  try {
    const body: CoachRequest = await request.json()
    const { message, personality, context, apiKey, model = 'mistralai/mistral-7b-instruct', conversationHistory = [], conversationId = 'coach' } = body

    if (!message || !personality || !apiKey) {
      return NextResponse.json<ApiError>({
        error: 'Missing required fields: message, personality, apiKey'
      }, { status: 400 })
    }

    const selectedPersonality = AI_PERSONALITIES.find(p => p.id === personality)
    if (!selectedPersonality) {
      return NextResponse.json<ApiError>({
        error: 'Invalid personality selected'
      }, { status: 400 })
    }

    // Load chat history from cookies if not provided
    let finalConversationHistory = conversationHistory
    if (conversationHistory.length === 0) {
      finalConversationHistory = loadChatHistoryFromCookie(request, conversationId)
    }

    const systemPrompt = `You are a dating coach. I'll tell you about the girl, analyze and guide me on it.

Personality: ${selectedPersonality.name}
${selectedPersonality.systemPrompt}

IMPORTANT:
- Give practical, actionable advice
- Be direct and honest
- Analyze the situation clearly
- Provide specific guidance
- Stay true to the ${selectedPersonality.name} approach
- Remember our previous conversation and build on it

Context: ${context || 'No additional context provided'}

Previous conversation:
${finalConversationHistory.length > 0 ? finalConversationHistory.map(msg => `${msg.role === 'user' ? 'You' : 'Coach'}: ${msg.content}`).join('\n') : 'No previous conversation'}

My question: "${message}"

Analyze and guide me:`

    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://wingman-ai.vercel.app',
        'X-Title': 'Wingman AI'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          ...finalConversationHistory,
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('OpenRouter API error:', errorData)
      return NextResponse.json<ApiError>({
        error: errorData.error?.message || 'Failed to get response from AI'
      }, { status: response.status })
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    // Create response object
    const responseObj = NextResponse.json({
      id: generateId(),
      response: aiResponse,
      model: model,
      timestamp: new Date().toISOString()
    })

    // Save updated conversation history to cookie
    const updatedHistory: ConversationMessage[] = [
      ...finalConversationHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: aiResponse }
    ]
    saveChatHistoryToCookie(responseObj, conversationId, updatedHistory)

    return responseObj

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json<ApiError>({
      error: 'Internal server error'
    }, { status: 500 })
  }
} 