'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Heart, 
  Send, 
  Settings, 
  Moon, 
  Sun, 
  Copy, 
  Trash2, 
  LogOut,
  MessageSquare,
  Loader2,
  Sparkles,
  Plus,
  User,
  Key,
  Menu,
  MessageCircle,
  Users,
  Bot,
  ArrowLeft,
  ArrowRight,
  Edit3,
  X,
  Check,
  CheckCircle,
  Smartphone,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  MessageSquare as ChatIcon
} from 'lucide-react'
import { cn, formatTimestamp, copyToClipboard, validateApiKey, generateId, saveChatHistory, loadChatHistory, getAllChatHistoryCookies, clearChatHistory } from '@/lib/utils'
import { AI_PERSONALITIES } from '@/lib/personalities'
import type { Message, Person, ChatMessage, ChatConversation, AIPersonality, PersonTab, PersonWithTabs, Model } from '@/types'

export default function DashboardPage() {
  const [selectedPerson, setSelectedPerson] = useState<PersonWithTabs | null>(null)
  const [selectedTab, setSelectedTab] = useState<PersonTab | null>(null)
  const [people, setPeople] = useState<PersonWithTabs[]>([])
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [coachMessages, setCoachMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [selectedPersonality, setSelectedPersonality] = useState('long-term')
  const [selectedModel, setSelectedModel] = useState('mistralai/mistral-small-3.2-24b-instruct:free')
  const [availableModels, setAvailableModels] = useState<Model[]>([])
  const [modelMode, setModelMode] = useState<'free' | 'paid'>('free')
  const [isLoading, setIsLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [expandedPeople, setExpandedPeople] = useState<Set<string>>(new Set())
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()

  // Function to get the best free model (prioritize larger models)
  const getBestFreeModel = (models: Model[]): string => {
    const priorityModels = [
      'anthropic/claude-3-haiku',
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemini-flash-1.5',
      'mistralai/mistral-7b-instruct'
    ]
    
    // First try to find a priority free model
    for (const priorityId of priorityModels) {
      const found = models.find(m => m.id === priorityId && m.isFree)
      if (found) return found.id
    }
    
    // Fallback to first available free model
    const firstFreeModel = models.find(m => m.isFree)
    return firstFreeModel ? firstFreeModel.id : 'mistralai/mistral-7b-instruct'
  }

  // Load data from localStorage and check authentication
  useEffect(() => {
    const savedApiKey = localStorage.getItem('wingman-api-key')
    const savedPeople = localStorage.getItem('wingman-people')
    const savedConversations = localStorage.getItem('wingman-conversations')
    const savedCoachMessages = localStorage.getItem('wingman-coach-messages')
    const savedPersonality = localStorage.getItem('wingman-personality')
    const savedModel = localStorage.getItem('wingman-selected-model')
    const savedModelMode = localStorage.getItem('wingman-model-mode')
    const savedDarkMode = localStorage.getItem('wingman-dark-mode')
    const savedExpandedPeople = localStorage.getItem('wingman-expanded-people')

    if (!savedApiKey || !validateApiKey(savedApiKey)) {
      router.push('/')
      return
    }

    setApiKey(savedApiKey)

    // --- FIX: Robustly handle missing/corrupt/empty people structure ---
    let parsedPeople: PersonWithTabs[] = []
    if (savedPeople) {
      try {
        parsedPeople = JSON.parse(savedPeople)
        if (!Array.isArray(parsedPeople)) parsedPeople = []
      } catch {
        parsedPeople = []
      }
    }
    // If no people, initialize with a default person and tabs
    if (parsedPeople.length === 0) {
      const defaultTabs: PersonTab[] = [
        {
          id: generateId(),
          name: 'Coach',
          type: 'coach',
          isActive: true,
          lastActivity: new Date().toISOString()
        },
        {
          id: generateId(),
          name: 'Reply Generator',
          type: 'reply',
          isActive: false,
          lastActivity: new Date().toISOString()
        }
      ]
      parsedPeople = [
        {
          id: generateId(),
          name: 'New Girl',
          unreadCount: 0,
          isActive: true,
          tabs: defaultTabs
        }
      ]
    }
    setPeople(parsedPeople)
    // Only set selectedPerson/Tab if they exist
    if (parsedPeople[0]) {
      setSelectedPerson(parsedPeople[0])
      if (Array.isArray(parsedPeople[0].tabs) && parsedPeople[0].tabs.length > 0) {
        setSelectedTab(parsedPeople[0].tabs[0])
      }
    }

    // Load conversations from localStorage
    let parsedConversations: ChatConversation[] = []
    if (savedConversations) {
      try {
        parsedConversations = JSON.parse(savedConversations)
        if (!Array.isArray(parsedConversations)) parsedConversations = []
      } catch {
        parsedConversations = []
      }
    }

    // Load coach messages from localStorage
    let parsedCoachMessages: Message[] = []
    if (savedCoachMessages) {
      try {
        parsedCoachMessages = JSON.parse(savedCoachMessages)
        if (!Array.isArray(parsedCoachMessages)) parsedCoachMessages = []
      } catch {
        parsedCoachMessages = []
      }
    }

    // Load chat history from cookies and merge with localStorage data
    const cookieHistory = getAllChatHistoryCookies()
    
    // Merge coach messages from cookies if available
    if (cookieHistory['coach'] && cookieHistory['coach'].length > 0) {
      const cookieCoachMessages: Message[] = cookieHistory['coach'].map((msg, index) => ({
        id: generateId(),
        prompt: msg.role === 'user' ? msg.content : '',
        response: msg.role === 'assistant' ? msg.content : '',
        model: selectedModel,
        timestamp: new Date().toISOString(),
        isUser: msg.role === 'user'
      }))
      
      // If we have cookie data and no localStorage data, use cookie data
      if (parsedCoachMessages.length === 0) {
        parsedCoachMessages = cookieCoachMessages
      }
    }

    // Merge conversation data from cookies
    Object.keys(cookieHistory).forEach(conversationId => {
      if (conversationId !== 'coach') {
        const cookieMessages: ChatMessage[] = cookieHistory[conversationId].map((msg, index) => ({
          id: generateId(),
          text: msg.content,
          sender: msg.role === 'user' ? 'them' : 'ai',
          timestamp: new Date().toISOString(),
          isRead: true
        }))

        const existingConversation = parsedConversations.find(conv => conv.id === conversationId)
        if (existingConversation) {
          // Merge cookie data with existing conversation
          existingConversation.messages = [...existingConversation.messages, ...cookieMessages]
        } else {
          // Create new conversation from cookie data
          const [personId, tabId] = conversationId.split('-')
          const newConversation: ChatConversation = {
            id: conversationId,
            personId: personId,
            messages: cookieMessages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          parsedConversations.push(newConversation)
        }
      }
    })

    setConversations(parsedConversations)
    setCoachMessages(parsedCoachMessages)

    if (savedPersonality) {
      setSelectedPersonality(savedPersonality)
    }
    if (savedModel) {
      setSelectedModel(savedModel)
    }
    if (savedModelMode) {
      setModelMode(savedModelMode as 'free' | 'paid')
    }
    if (savedDarkMode) {
      setIsDarkMode(JSON.parse(savedDarkMode))
    }
    if (savedExpandedPeople) {
      setExpandedPeople(new Set(JSON.parse(savedExpandedPeople)))
    }
  }, [router])

  // Fetch available models and auto-select best one
  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey) return
      
      try {
        const response = await fetch(`/api/models?apiKey=${encodeURIComponent(apiKey)}`)
        if (response.ok) {
          const data = await response.json()
          setAvailableModels(data.models)
          
          // Auto-select best model if no model is currently selected
          if (!localStorage.getItem('wingman-selected-model')) {
            const bestModel = getBestFreeModel(data.models)
            setSelectedModel(bestModel)
            localStorage.setItem('wingman-selected-model', bestModel)
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error)
      }
    }

    fetchModels()
  }, [apiKey])

  // Save data to localStorage when it changes
  useEffect(() => {
    if (people.length > 0) {
      localStorage.setItem('wingman-people', JSON.stringify(people))
    }
  }, [people])

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('wingman-conversations', JSON.stringify(conversations))
    }
  }, [conversations])

  useEffect(() => {
    if (coachMessages.length > 0) {
      localStorage.setItem('wingman-coach-messages', JSON.stringify(coachMessages))
    }
  }, [coachMessages])

  useEffect(() => {
    localStorage.setItem('wingman-personality', selectedPersonality)
  }, [selectedPersonality])

  useEffect(() => {
    localStorage.setItem('wingman-selected-model', selectedModel)
  }, [selectedModel])

  useEffect(() => {
    localStorage.setItem('wingman-model-mode', modelMode)
  }, [modelMode])

  useEffect(() => {
    localStorage.setItem('wingman-dark-mode', JSON.stringify(isDarkMode))
  }, [isDarkMode])

  useEffect(() => {
    localStorage.setItem('wingman-expanded-people', JSON.stringify(Array.from(expandedPeople)))
  }, [expandedPeople])

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('wingman-conversations', JSON.stringify(conversations))
    }
  }, [conversations])

  useEffect(() => {
    if (coachMessages.length > 0) {
      localStorage.setItem('wingman-coach-messages', JSON.stringify(coachMessages))
    }
  }, [coachMessages])

  useEffect(() => {
    localStorage.setItem('wingman-personality', selectedPersonality)
  }, [selectedPersonality])

  useEffect(() => {
    localStorage.setItem('wingman-selected-model', selectedModel)
  }, [selectedModel])

  useEffect(() => {
    localStorage.setItem('wingman-dark-mode', JSON.stringify(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    localStorage.setItem('wingman-expanded-people', JSON.stringify(Array.from(expandedPeople)))
  }, [expandedPeople])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [coachMessages, conversations])





  const addPerson = () => {
    if (!newPersonName.trim()) return
    
    const defaultTabs: PersonTab[] = [
      {
        id: generateId(),
        name: 'Coach',
        type: 'coach',
        isActive: true,
        lastActivity: new Date().toISOString()
      },
      {
        id: generateId(),
        name: 'Reply Generator',
        type: 'reply',
        isActive: false,
        lastActivity: new Date().toISOString()
      }
    ]
    
    const newPerson: PersonWithTabs = {
      id: generateId(),
      name: newPersonName.trim(),
      unreadCount: 0,
      isActive: true,
      tabs: defaultTabs
    }
    
    setPeople(prev => [...prev, newPerson])
    setSelectedPerson(newPerson)
    setSelectedTab(defaultTabs[0])
    setExpandedPeople(prev => new Set(Array.from(prev).concat(newPerson.id)))
    setNewPersonName('')
    setShowAddPerson(false)
  }

  const addTab = (personId: string, type: 'coach' | 'reply') => {
    const person = people.find(p => p.id === personId)
    if (!person) return

    // Check if a tab of this type already exists
    const existingTab = person.tabs.find(tab => tab.type === type)
    if (existingTab) {
      // If tab exists, just select it instead of creating a new one
      selectTab(person, existingTab)
      return
    }

    const newTab: PersonTab = {
      id: generateId(),
      name: type === 'coach' ? 'Coach' : 'Reply Generator',
      type,
      isActive: true,
      lastActivity: new Date().toISOString()
    }

    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        // Deactivate other tabs
        const updatedTabs = person.tabs.map(tab => ({
          ...tab,
          isActive: false
        }))
        return {
          ...person,
          tabs: [...updatedTabs, newTab]
        }
      }
      return person
    })

    setPeople(updatedPeople)
    setSelectedPerson(updatedPeople.find(p => p.id === personId) || null)
    setSelectedTab(newTab)
  }

  const togglePersonExpansion = (personId: string) => {
    setExpandedPeople(prev => {
      const newSet = new Set(Array.from(prev))
      if (newSet.has(personId)) {
        newSet.delete(personId)
      } else {
        newSet.add(personId)
      }
      return newSet
    })
  }

  const selectTab = (person: PersonWithTabs, tab: PersonTab) => {
    // Update active tab for the person
    const updatedPeople = people.map(p => {
      if (p.id === person.id) {
        return {
          ...p,
          tabs: p.tabs.map(t => ({
            ...t,
            isActive: t.id === tab.id
          }))
        }
      }
      return p
    })

    setPeople(updatedPeople)
    setSelectedPerson(updatedPeople.find(p => p.id === person.id) || null)
    setSelectedTab(tab)
  }

  const sendCoachMessage = async () => {
    if (!inputValue.trim() || isLoading || !selectedTab || selectedTab.type !== 'coach') return

    const userMessage: Message = {
      id: generateId(),
      prompt: inputValue.trim(),
      response: '',
      model: selectedModel,
      timestamp: new Date().toISOString(),
      isUser: true
    }

    setCoachMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError('')

    // Convert coach messages to conversation history format
    const conversationHistory = coachMessages.map(msg => ({
      role: msg.isUser ? 'user' as const : 'assistant' as const,
      content: msg.isUser ? msg.prompt : msg.response
    }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.prompt,
          personality: selectedPersonality,
          model: selectedModel,
          apiKey: apiKey,
          conversationHistory: conversationHistory,
          conversationId: 'coach'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      const aiMessage: Message = {
        id: data.id,
        prompt: userMessage.prompt,
        response: data.response,
        model: data.model,
        timestamp: data.timestamp,
        isUser: false
      }

      setCoachMessages(prev => [...prev, aiMessage])

      // Save to cookie as backup
      const updatedHistory = [
        ...conversationHistory,
        { role: 'user' as const, content: userMessage.prompt },
        { role: 'assistant' as const, content: data.response }
      ]
      saveChatHistory('coach', updatedHistory)

    } catch (error: any) {
      console.error('Error sending message:', error)
      setError(error.message)
      setCoachMessages(prev => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }

  const generateReply = async (message: string) => {
    if (!selectedPerson || !selectedTab || selectedTab.type !== 'reply' || isLoading) return

    setIsLoading(true)
    setError('')

    // Get current conversation for history
    const conversationId = `${selectedPerson.id}-${selectedTab.id}`
    const currentConversation = conversations.find(conv => conv.id === conversationId)
    
    // Convert conversation messages to history format
    const conversationHistory = currentConversation?.messages.map(msg => ({
      role: msg.sender === 'them' ? 'user' as const : 'assistant' as const,
      content: msg.text
    })) || []

    try {
      const response = await fetch('/api/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          personality: selectedPersonality,
          context: `Conversation with ${selectedPerson.name}`,
          model: selectedModel,
          apiKey: apiKey,
          conversationHistory: conversationHistory,
          conversationId: conversationId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate reply')
      }

      // Add the reply to the existing conversation
      const replyMessage: ChatMessage = {
        id: generateId(),
        text: data.reply,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        isRead: true
      }

      setConversations(prevConversations => {
        return prevConversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              messages: [...conv.messages, replyMessage],
              updatedAt: new Date().toISOString()
            }
          }
          return conv
        })
      })

      // Save to cookie as backup
      const updatedHistory = [
        ...conversationHistory,
        { role: 'user' as const, content: message },
        { role: 'assistant' as const, content: data.reply }
      ]
      saveChatHistory(conversationId, updatedHistory)

    } catch (error: any) {
      console.error('Error generating reply:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const addMessageToConversation = (text: string, sender: 'user' | 'them' | 'ai') => {
    if (!selectedPerson || !selectedTab || selectedTab.type !== 'reply') return

    const newMessage: ChatMessage = {
      id: generateId(),
      text,
      sender,
      timestamp: new Date().toISOString(),
      isRead: true
    }
    


    const conversationId = `${selectedPerson.id}-${selectedTab.id}`
    const existingConversation = conversations.find(conv => conv.id === conversationId)
    
    if (existingConversation) {
      setConversations(prevConversations => {
        return prevConversations.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              messages: [...conv.messages, newMessage],
              updatedAt: new Date().toISOString()
            }
          }
          return conv
        })
      })
    } else {
      const newConversation: ChatConversation = {
        id: conversationId,
        personId: selectedPerson.id,
        messages: [newMessage],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setConversations(prev => [...prev, newConversation])
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (selectedTab?.type === 'coach') {
        sendCoachMessage()
      }
    }
  }

  const handleReplyGenerate = () => {
    if (!inputValue.trim() || isLoading || !selectedTab || selectedTab.type !== 'reply') return
    
    const message = inputValue.trim()
    setInputValue('')
    
    // Add their message to the conversation first
    addMessageToConversation(message, 'them')
    
    // Generate AI reply after a small delay to ensure the message is added
    setTimeout(() => {
      generateReply(message)
    }, 100)
  }

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all conversation history?')) {
      setCoachMessages([])
      setConversations([])
      localStorage.removeItem('wingman-coach-messages')
      localStorage.removeItem('wingman-conversations')
      
      // Clear all chat history cookies
      const cookieHistory = getAllChatHistoryCookies()
      Object.keys(cookieHistory).forEach(conversationId => {
        clearChatHistory(conversationId)
      })
    }
  }

  const clearCurrentChat = () => {
    if (!selectedPerson || !selectedTab) return
    
    if (selectedTab.type === 'coach') {
      if (confirm('Are you sure you want to clear the coach chat?')) {
        setCoachMessages([])
        localStorage.removeItem('wingman-coach-messages')
        clearChatHistory('coach')
      }
    } else if (selectedTab.type === 'reply') {
      if (confirm('Are you sure you want to clear this conversation?')) {
        const conversationId = `${selectedPerson.id}-${selectedTab.id}`
        const updatedConversations = conversations.filter(conv => conv.id !== conversationId)
        setConversations(updatedConversations)
        
        // Update localStorage
        const conversationsToSave = updatedConversations.map(conv => ({
          id: conv.id,
          personId: conv.personId,
          messages: conv.messages,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt
        }))
        localStorage.setItem('wingman-conversations', JSON.stringify(conversationsToSave))
        
        // Clear cookie for this conversation
        clearChatHistory(conversationId)
      }
    }
  }

  const handleCopyMessage = async (text: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      // Show temporary success indicator
      const button = document.activeElement as HTMLElement
      if (button) {
        const originalText = button.innerHTML
        button.innerHTML = '<Check className="w-4 h-4" />'
        button.classList.add('text-green-500')
        setTimeout(() => {
          button.innerHTML = originalText
          button.classList.remove('text-green-500')
        }, 2000)
      }
    }
  }

  const deletePerson = (personId: string) => {
    if (!confirm('Are you sure you want to delete this person and all their conversations?')) {
      return
    }
    
    // Remove person from people list
    const updatedPeople = people.filter(p => p.id !== personId)
    setPeople(updatedPeople)
    
    // Remove all conversations for this person
    const updatedConversations = conversations.filter(conv => conv.personId !== personId)
    setConversations(updatedConversations)
    
    // Note: Coach messages are kept since they're general advice, not person-specific
    
    // If the deleted person was selected, select the first person or clear selection
    if (selectedPerson?.id === personId) {
      if (updatedPeople.length > 0) {
        setSelectedPerson(updatedPeople[0])
        setSelectedTab(updatedPeople[0].tabs[0])
      } else {
        setSelectedPerson(null)
        setSelectedTab(null)
      }
    }
    
    // Remove from expanded people
    setExpandedPeople(prev => {
      const newSet = new Set(Array.from(prev))
      newSet.delete(personId)
      return newSet
    })
  }

  const deleteTab = (personId: string, tabId: string) => {
    if (!confirm('Are you sure you want to delete this tab and its conversations?')) {
      return
    }
    
    const person = people.find(p => p.id === personId)
    if (!person) return
    
    const tab = person.tabs.find(t => t.id === tabId)
    if (!tab) return
    
    // Remove tab from person
    const updatedTabs = person.tabs.filter(t => t.id !== tabId)
    const updatedPeople = people.map(p => 
      p.id === personId ? { ...p, tabs: updatedTabs } : p
    )
    
    // If no tabs left, delete the person
    if (updatedTabs.length === 0) {
      deletePerson(personId)
      return
    }
    
    // If the deleted tab was active, select the first remaining tab
    if (tab.isActive) {
      const firstTab = updatedTabs[0]
      updatedPeople.forEach(p => {
        if (p.id === personId) {
          p.tabs.forEach(t => {
            t.isActive = t.id === firstTab.id
          })
        }
      })
      setSelectedTab(firstTab)
    }
    
    setPeople(updatedPeople)
    setSelectedPerson(updatedPeople.find(p => p.id === personId) || null)
    
    // Remove conversations for this person (since conversations are person-specific, not tab-specific)
    const updatedConversations = conversations.filter(conv => conv.personId !== personId)
    setConversations(updatedConversations)
    
    // Note: Coach messages are kept since they're general advice, not tab-specific
  }

  const logout = () => {
    localStorage.removeItem('wingman-api-key')
    router.push('/')
  }

  const getCurrentConversation = () => {
    if (!selectedPerson || !selectedTab || selectedTab.type !== 'reply') return null
    const conversationId = `${selectedPerson.id}-${selectedTab.id}`
    return conversations.find(conv => conv.id === conversationId)
  }

  const currentConversation = getCurrentConversation()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left Sidebar - Simplified & Clear */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Wingman AI</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Your Dating Coach</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel - Collapsible */}
        {showSettings && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  AI Model Selection
                </label>
                
                {/* Model Mode Toggle */}
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Model Type:</span>
                    <div className="flex bg-gray-200 dark:bg-gray-600 rounded-lg p-1">
                      <button
                        onClick={() => {
                          setModelMode('free')
                          // Auto-select first free model if current model is paid
                          const currentModel = availableModels.find(m => m.id === selectedModel)
                          if (currentModel && !currentModel.isFree) {
                            const firstFreeModel = availableModels.find(m => m.isFree)
                            if (firstFreeModel) {
                              setSelectedModel(firstFreeModel.id)
                            }
                          }
                        }}
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-all",
                          modelMode === 'free'
                            ? "bg-green-500 text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        Free Models
                      </button>
                      <button
                        onClick={() => {
                          setModelMode('paid')
                          // Auto-select first paid model if current model is free
                          const currentModel = availableModels.find(m => m.id === selectedModel)
                          if (currentModel && currentModel.isFree) {
                            const firstPaidModel = availableModels.find(m => !m.isFree)
                            if (firstPaidModel) {
                              setSelectedModel(firstPaidModel.id)
                            }
                          }
                        }}
                        className={cn(
                          "px-3 py-1 text-xs font-medium rounded-md transition-all",
                          modelMode === 'paid'
                            ? "bg-purple-500 text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        Paid Models
                      </button>
                    </div>
                  </div>
                  
                  {/* Models List - Only show selected mode */}
                  <div className="space-y-1">
                    {availableModels
                      .filter(model => modelMode === 'free' ? model.isFree : !model.isFree)
                      .map(model => (
                        <label key={model.id} className={cn(
                          "flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors",
                          modelMode === 'paid' && "border border-gray-200 dark:border-gray-600"
                        )}>
                          <input
                            type="radio"
                            name="model"
                            value={model.id}
                            checked={selectedModel === model.id}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className={cn(
                              "focus:ring-2",
                              modelMode === 'free' ? "text-green-500 focus:ring-green-500" : "text-purple-500 focus:ring-purple-500"
                            )}
                          />
                          <div className="flex-1">
                            <div className="text-xs font-medium text-gray-900 dark:text-white">{model.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{model.provider}</div>
                          </div>
                          <div className="flex items-center space-x-1">
                            {modelMode === 'paid' && (
                              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Paid</span>
                            )}
                            {selectedModel === model.id && (
                              <CheckCircle className={cn(
                                "w-4 h-4",
                                modelMode === 'free' ? "text-green-500" : "text-purple-500"
                              )} />
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
              </div>
              
              {/* Current Model Info */}
              {selectedModel && (
                <div className="p-3 bg-gray-50 dark:bg-gray-600 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        modelMode === 'free' ? "bg-green-500" : "bg-purple-500"
                      )}></div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Current Model
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs font-medium px-2 py-1 rounded",
                      modelMode === 'free' 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
                    )}>
                      {modelMode === 'free' ? 'Free Mode' : 'Paid Mode'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <div className="font-medium">
                      {availableModels.find(m => m.id === selectedModel)?.name || selectedModel}
                    </div>
                    <div>
                      {availableModels.find(m => m.id === selectedModel)?.provider || 'Unknown Provider'}
                    </div>
                    <div className={cn(
                      "font-medium",
                      modelMode === 'free' 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-purple-600 dark:text-purple-400"
                    )}>
                      {modelMode === 'free' ? 'Free Model' : 'Paid Model (Requires Credits)'}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-2">
                <button
                  onClick={clearHistory}
                  className="flex-1 px-3 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Clear History
                </button>
                <button
                  onClick={logout}
                  className="flex-1 px-3 py-2 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Add New Person Button */}
            <button
              onClick={() => setShowAddPerson(true)}
              className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Girl</span>
            </button>

            {/* People List - Simplified */}
            <div className="space-y-2">
              {people.map(person => {
                const isSelected = selectedPerson?.id === person.id
                const isExpanded = expandedPeople.has(person.id)
                
                return (
                  <div key={person.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    {/* Person Header - Always visible */}
                    <div
                      onClick={() => togglePersonExpansion(person.id)}
                      className={cn(
                        "flex items-center space-x-3 p-3 cursor-pointer transition-colors",
                        isSelected
                          ? "bg-pink-50 dark:bg-pink-900/20 border-b border-pink-200 dark:border-pink-800"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                      )}
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-red-400 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {person.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {Array.isArray(person.tabs) ? person.tabs.length : 0} conversations
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {person.unreadCount > 0 && (
                          <div className="w-5 h-5 bg-pink-500 text-white text-xs rounded-full flex items-center justify-center">
                            {person.unreadCount}
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deletePerson(person.id)
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete person"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Tabs - Only show when expanded */}
                    {isExpanded && Array.isArray(person.tabs) && (
                      <div className="bg-gray-50 dark:bg-gray-700 p-2 space-y-1">
                        {person.tabs.map(tab => (
                          <div
                            key={tab.id}
                            onClick={() => selectTab(person, tab)}
                            className={cn(
                              "flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors text-sm",
                              selectedTab?.id === tab.id
                                ? "bg-white dark:bg-gray-600 shadow-sm border border-pink-200 dark:border-pink-800"
                                : "hover:bg-white dark:hover:bg-gray-600"
                            )}
                          >
                            {tab.type === 'coach' ? (
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                <Bot className="w-3 h-3 text-white" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <ChatIcon className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{tab.name}</span>
                            <div className="ml-auto flex items-center space-x-1">
                              {selectedTab?.id === tab.id && (
                                <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteTab(person.id, tab.id)
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Delete tab"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Add Tab Buttons - Clear and prominent */}
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => addTab(person.id, 'coach')}
                              className="px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-1"
                            >
                              <Bot className="w-3 h-3" />
                              <span>Coach</span>
                            </button>
                            <button
                              onClick={() => addTab(person.id, 'reply')}
                              className="px-3 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center space-x-1"
                            >
                              <ChatIcon className="w-3 h-3" />
                              <span>Reply</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Empty State */}
            {people.length === 0 && (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No girls added yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Click "Add New Girl" to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {!selectedPerson || !selectedTab ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Girl & Chat</p>
              <p className="text-gray-500 dark:text-gray-400">Choose someone from the sidebar and select a chat to start</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-pink-400 to-red-400 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-medium text-gray-900 dark:text-white">
                      {selectedPerson.name} - {selectedTab.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedTab.type === 'coach' ? 'Dating Coach' : 'Reply Generator'}
                    </p>
                  </div>
                </div>
                
                {/* Quick Settings */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={clearCurrentChat}
                    className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                    title="Clear current chat"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                  
                  <select
                    value={selectedPersonality}
                    onChange={(e) => setSelectedPersonality(e.target.value)}
                    className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    {AI_PERSONALITIES.map(personality => (
                      <option key={personality.id} value={personality.id}>
                        {personality.name}
                      </option>
                    ))}
                  </select>
                  
                  {/* Model Selection with Mode Toggle */}
                  <div className="flex items-center space-x-2">
                    {/* Mode Toggle */}
                    <div className="flex bg-gray-200 dark:bg-gray-600 rounded-lg p-0.5">
                      <button
                        onClick={() => {
                          setModelMode('free')
                          const currentModel = availableModels.find(m => m.id === selectedModel)
                          if (currentModel && !currentModel.isFree) {
                            const firstFreeModel = availableModels.find(m => m.isFree)
                            if (firstFreeModel) {
                              setSelectedModel(firstFreeModel.id)
                            }
                          }
                        }}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded transition-all",
                          modelMode === 'free'
                            ? "bg-green-500 text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        Free
                      </button>
                      <button
                        onClick={() => {
                          setModelMode('paid')
                          const currentModel = availableModels.find(m => m.id === selectedModel)
                          if (currentModel && currentModel.isFree) {
                            const firstPaidModel = availableModels.find(m => !m.isFree)
                            if (firstPaidModel) {
                              setSelectedModel(firstPaidModel.id)
                            }
                          }
                        }}
                        className={cn(
                          "px-2 py-1 text-xs font-medium rounded transition-all",
                          modelMode === 'paid'
                            ? "bg-purple-500 text-white shadow-sm"
                            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        )}
                      >
                        Paid
                      </button>
                    </div>
                    
                    {/* Model Dropdown */}
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      {availableModels
                        .filter(model => modelMode === 'free' ? model.isFree : !model.isFree)
                        .map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-4 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                {selectedTab.type === 'coach' ? (
                  /* Coach Chat */
                  <div className="space-y-4">
                    {coachMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <Bot className="w-12 h-12 mx-auto mb-4 text-pink-300 dark:text-pink-600" />
                          <p className="text-lg font-medium">Your AI Dating Coach is Ready!</p>
                          <p className="text-sm mb-6">Ask me anything about dating, relationships, or attraction</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                            {AI_PERSONALITIES.map(personality => (
                              <div
                                key={personality.id}
                                onClick={() => setSelectedPersonality(personality.id)}
                                className={cn(
                                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                                  selectedPersonality === personality.id
                                    ? `border-${personality.color.split('-')[1]}-500 bg-${personality.color.split('-')[1]}-50 dark:bg-${personality.color.split('-')[1]}-900/20`
                                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                                )}
                              >
                                <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                                  {personality.name}
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {personality.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {coachMessages.map((message) => (
                          <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                            {message.isUser ? (
                              /* User Message Container */
                              <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-gradient-to-r from-pink-500 to-red-500 text-white">
                                <div className="flex items-start space-x-2">
                                  <div className="flex-1">
                                    <p className="whitespace-pre-wrap text-white">{message.prompt}</p>
                                  </div>
                                </div>
                                <div className="mt-2 text-xs opacity-70 text-white">
                                  {formatTimestamp(message.timestamp)}
                                </div>
                              </div>
                            ) : (
                              /* AI Reply Container */
                              <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600">
                                <div className="flex items-start space-x-2">
                                  <div className="flex-1">
                                    <p className="whitespace-pre-wrap">{message.prompt}</p>
                                    {message.response && (
                                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                        <p className="whitespace-pre-wrap">{message.response}</p>
                                      </div>
                                    )}
                                  </div>
                                  {message.response && (
                                    <button
                                      onClick={() => handleCopyMessage(message.response)}
                                      className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                                <div className="mt-2 text-xs opacity-70">
                                  {formatTimestamp(message.timestamp)}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center space-x-2">
                                <Loader2 className="w-4 h-4 animate-spin text-pink-500 dark:text-pink-400" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">Your coach is thinking...</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Reply Generator Chat */
                  <div className="space-y-4">
                    {!currentConversation || !currentConversation.messages || currentConversation.messages.length === 0 ? (
                      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-green-300 dark:text-green-600" />
                          <p className="text-lg font-medium">Reply Generator Ready!</p>
                          <p className="text-sm mb-6">Paste their message below and I'll generate a perfect reply</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                            {AI_PERSONALITIES.map(personality => (
                              <div
                                key={personality.id}
                                onClick={() => setSelectedPersonality(personality.id)}
                                className={cn(
                                  "p-4 rounded-lg border-2 cursor-pointer transition-all",
                                  selectedPersonality === personality.id
                                    ? `border-${personality.color.split('-')[1]}-500 bg-${personality.color.split('-')[1]}-50 dark:bg-${personality.color.split('-')[1]}-900/20`
                                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                                )}
                              >
                                <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                                  {personality.name}
                                </h3>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {personality.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {currentConversation.messages.map((message) => (
                          <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {message.sender === 'them' ? (
                              /* Their Message Container */
                              <div className="max-w-[70%] rounded-2xl px-4 py-3 shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600">
                                <p className="text-sm">{message.text}</p>
                                <p className="text-xs opacity-70 mt-1">
                                  {formatTimestamp(message.timestamp)}
                                </p>
                              </div>
                            ) : message.sender === 'ai' ? (
                              /* AI Reply Container */
                              <div className="max-w-[70%] rounded-2xl px-4 py-3 shadow-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                <div className="flex items-start space-x-2">
                                  <div className="flex-1">
                                    <p className="text-sm">{message.text}</p>
                                    <p className="text-xs opacity-70 mt-1">
                                      {formatTimestamp(message.timestamp)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleCopyMessage(message.text)}
                                    className="text-white/70 hover:text-white transition-colors"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* User Message Container */
                              <div className="max-w-[70%] rounded-2xl px-4 py-3 shadow-sm bg-gradient-to-r from-pink-500 to-red-500 text-white">
                                <p className="text-sm">{message.text}</p>
                                <p className="text-xs opacity-70 mt-1">
                                  {formatTimestamp(message.timestamp)}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {isLoading && (
                          <div className="flex justify-start">
                            <div className="max-w-[70%] rounded-2xl px-4 py-3 shadow-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                              <div className="flex items-center space-x-2">
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span className="text-sm text-white">Generating reply...</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="max-w-4xl mx-auto">
                {selectedTab.type === 'coach' ? (
                  /* Coach Input */
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask your AI dating coach for advice... (Press Enter to send)"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        rows={3}
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      onClick={sendCoachMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      <span>Send</span>
                    </button>
                  </div>
                ) : (
                  /* Reply Generator Input */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Their Message
                      </label>
                      <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleReplyGenerate()
                          }
                        }}
                        placeholder="Paste their message here and press Enter to generate a reply..."
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        rows={2}
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={handleReplyGenerate}
                        disabled={!inputValue.trim() || isLoading}
                        className="flex-1 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <MessageCircle className="w-5 h-5" />
                        )}
                        <span>Generate Reply</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add Person Modal */}
      {showAddPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add New Girl</h3>
              <button
                onClick={() => setShowAddPerson(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Enter her name..."
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  onKeyPress={(e) => e.key === 'Enter' && addPerson()}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAddPerson(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addPerson}
                  disabled={!newPersonName.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Girl
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-w-sm">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
} 