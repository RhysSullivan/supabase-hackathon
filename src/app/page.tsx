'use client'

import { useChat } from 'ai/react'
import ChatInput from '~/components/ChatInput'
import MessageList from '~/components/MessageList'
import { Card } from '~/components/ui/card'


export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat()

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <div className="flex flex-col h-[600px]">
          <MessageList messages={messages} />
          <ChatInput
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleSubmit}
          />
        </div>
      </Card>
    </div>
  )
}

