"use client";

import { useEffect, useRef, useState } from "react";

interface TranscriptMessage {
  id: string;
  text: string;
  timestamp: Date;
  isPartial?: boolean;
  isError?: boolean;
}

interface TranscriptMessagesProps {
  messages: TranscriptMessage[];
  isLive?: boolean;
  isRecording?: boolean;
}

export default function TranscriptMessages({
  messages,
  isLive = false,
  isRecording = false,
}: TranscriptMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  // Check if user is at the bottom
  const isAtBottom = () => {
    if (!containerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Consider user at bottom if within 50px of the bottom
    return scrollHeight - scrollTop - clientHeight < 50;
  };

  // Auto-scroll to bottom when new messages arrive (only if user is at bottom)
  const scrollToBottom = () => {
    if (!isUserScrolledUp && containerRef.current) {
      // Scroll within the container, not the entire page
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  // Handle scroll event to detect if user scrolled up
  const handleScroll = () => {
    setIsUserScrolledUp(!isAtBottom());
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isUserScrolledUp]);

  if (messages.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No transcripts yet. Start recording to begin!</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Scroll to bottom button (appears when scrolled up) */}
      {isUserScrolledUp && (
        <button
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
              setIsUserScrolledUp(false);
            }
          }}
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-200"
        >
          ⬇️ Jump to Latest
        </button>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full flex flex-col overflow-y-auto bg-gray-50"
      >
        {/* Messages displayed in order (oldest to newest) */}
        <div className="flex flex-col gap-3 p-4 w-full">
          {/* Display messages in normal order (oldest first, newest last) */}
          {messages.map((message) => (
            <div
              key={message.id}
              className="flex gap-3 animate-fadeIn"
            >
              {/* Avatar/Icon */}
              <div className="flex-shrink-0">
                {message.isError ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100">
                    <span className="text-red-600">⚠️</span>
                  </div>
                ) : message.isPartial ? (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 animate-pulse">
                    <span className="text-blue-600">🎤</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                    <span className="text-green-600">✓</span>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-grow min-w-0">
                {/* Timestamp */}
                <div className="text-xs text-gray-500 mb-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </div>

                {/* Message Text */}
                <p
                  className={`text-sm break-words ${
                    message.isError
                      ? "text-red-700 font-medium"
                      : message.isPartial
                      ? "text-blue-700 italic"
                      : "text-gray-800"
                  }`}
                >
                  {message.text}
                  {message.isPartial && (
                    <span className="inline-block ml-1 animate-blink">▌</span>
                  )}
                </p>
              </div>

              {/* Status Indicator for Partial Messages */}
              {message.isPartial && (
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xs text-blue-600 font-medium">
                    Transcribing...
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Auto-scroll target - placed at the end */}
          <div ref={messagesEndRef} className="h-0" />
        </div>
      </div>
    </div>
  );
}
