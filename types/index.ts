export interface Message {
  id: string;
  prompt: string;
  response: string;
  model: string;
  timestamp: string;
  isUser: boolean;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  isFree?: boolean;
}

export interface ModelsResponse {
  models: Model[];
  message?: string;
}

export interface ApiError {
  error: string;
}

// New types for the enhanced dating app
export interface Person {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isActive: boolean;
}

export interface Conversation {
  id: string;
  personId: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface AIPersonality {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  color: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ReplyRequest {
  message: string;
  personality: string;
  context?: string;
  apiKey: string;
  model?: string;
  conversationHistory?: ConversationMessage[];
  conversationId?: string;
}

export interface CoachRequest {
  message: string;
  personality: string;
  context?: string;
  apiKey: string;
  model?: string;
  conversationHistory?: ConversationMessage[];
  conversationId?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'them' | 'ai';
  timestamp: string;
  isRead: boolean;
}

export interface ChatConversation {
  id: string;
  personId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// New types for multiple tabs per person
export interface PersonTab {
  id: string;
  name: string;
  type: 'coach' | 'reply';
  isActive: boolean;
  lastActivity: string;
}

export interface PersonWithTabs extends Person {
  tabs: PersonTab[];
} 