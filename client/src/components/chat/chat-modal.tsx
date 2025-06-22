import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Send, MapPin, Calendar, Paperclip, CheckCircle, X, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { EventWithHost, ChatMessageWithSender } from "@shared/schema";
import { SPORTS } from "@/lib/constants";
import { format } from "date-fns";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number | null;
}

interface EventChat {
  eventId: number;
  event: EventWithHost;
  lastMessage: ChatMessageWithSender;
  unreadCount: number;
}

export default function ChatModal({ isOpen, onClose, eventId }: ChatModalProps) {
  const [activeEventId, setActiveEventId] = useState<number | null>(eventId);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Safely handle socket connection with fallback
  const socketHook = useSocket();
  const { isConnected, sendMessage, messages: socketMessages } = socketHook || { 
    isConnected: false, 
    sendMessage: () => {}, 
    messages: [] 
  };
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Set active event when eventId prop changes
  useEffect(() => {
    if (eventId) {
      setActiveEventId(eventId);
    }
  }, [eventId]);

  // Fetch user's event chats
  const { data: eventChats = [], isLoading: chatsLoading } = useQuery<EventChat[]>({
    queryKey: ['/api/my-chats'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch active event details
  const { data: activeEvent } = useQuery<EventWithHost>({
    queryKey: ['/api/events', activeEventId],
    enabled: !!activeEventId,
    retry: false,
  });

  // Fetch messages for active event
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessageWithSender[]>({
    queryKey: ['/api/events', activeEventId, 'messages'],
    enabled: !!activeEventId,
    retry: false,
  });

  // Mark event as played mutation (for hosts)
  const markPlayedMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return await apiRequest('PUT', `/api/events/${eventId}`, { status: 'completed' });
    },
    onSuccess: () => {
      toast({
        title: "Event Marked as Played",
        description: "The event has been marked as completed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-events'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to mark event as played. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Cancel event mutation (for hosts)
  const cancelEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return await apiRequest('PUT', `/api/events/${eventId}`, { status: 'cancelled' });
    },
    onSuccess: () => {
      toast({
        title: "Event Cancelled",
        description: "The event has been cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-events'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to cancel event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, socketMessages]);

  // Handle sending messages
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeEventId || !isConnected) return;

    sendMessage(activeEventId, messageInput.trim());
    setMessageInput("");
  };

  const getSportIcon = (sportId: string) => {
    const sport = SPORTS.find(s => s.id === sportId);
    return sport ? (
      <div className={`w-8 h-8 bg-${sport.color} rounded-full flex items-center justify-center`}>
        <div className="w-4 h-4 text-white">
          <div className="w-full h-full bg-current rounded-sm" />
        </div>
      </div>
    ) : null;
  };

  const filteredChats = eventChats.filter(chat =>
    chat.event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.event.sport.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isHost = activeEvent && user && typeof user === 'object' && 'id' in user && activeEvent.hostId === (user as any).id;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-gray-200">
          <DialogTitle className="text-lg font-semibold text-gray-900">Messages</DialogTitle>
          <DialogDescription>
            Chat with other participants about your events and coordinate activities.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Chat List Sidebar */}
          <div className="w-1/3 border-r border-gray-200 flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Chat List */}
            <ScrollArea className="flex-1">
              {chatsLoading ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4" />
                          <div className="h-3 bg-gray-200 rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-gray-500 text-sm">No conversations found.</p>
                </div>
              ) : (
                <div>
                  {filteredChats.map((chat) => (
                    <button
                      key={chat.eventId}
                      onClick={() => setActiveEventId(chat.eventId)}
                      className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 text-left transition-colors ${
                        activeEventId === chat.eventId ? 'bg-blue-50 border-l-4 border-l-everest-blue' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {getSportIcon(chat.event.sport)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {chat.event.title}
                            </p>
                            <span className="text-xs text-gray-500">
                              {chat.lastMessage?.createdAt ? 
                                format(new Date(chat.lastMessage.createdAt), 'h:mm a') : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {chat.lastMessage?.content || 'No messages yet'}
                          </p>
                        </div>
                        {chat.unreadCount > 0 && (
                          <Badge variant="destructive" className="ml-auto">
                            {chat.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 flex flex-col">
            {activeEvent ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getSportIcon(activeEvent.sport)}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {activeEvent.title}
                        </h4>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {activeEvent.startTime ? format(new Date(activeEvent.startTime), 'MMM d, h:mm a') : 'TBD'}
                          </div>
                          <div className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {activeEvent.location.substring(0, 30)}
                            {activeEvent.location.length > 30 && '...'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View Event
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messagesLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="flex items-start space-x-3">
                              <div className="w-8 h-8 bg-gray-200 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-1/4" />
                                <div className="h-12 bg-gray-200 rounded w-3/4" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages.map((message): React.ReactNode => {
                        const isOwnMessage = user && typeof user === 'object' && 'id' in user && message.senderId === (user as any).id;
                        return (
                          <div
                            key={message.id}
                            className={`flex items-start space-x-3 ${
                              isOwnMessage ? 'justify-end' : ''
                            }`}
                          >
                            {!isOwnMessage && (
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={message.sender.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {message.sender.firstName?.[0] || message.sender.email?.[0] || 'U'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className={`flex-1 ${isOwnMessage ? 'max-w-xs ml-auto' : 'max-w-xs'}`}>
                              {!isOwnMessage && (
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900">
                                    {message.sender.firstName && message.sender.lastName 
                                      ? `${message.sender.firstName} ${message.sender.lastName.charAt(0)}.`
                                      : message.sender.email?.split('@')[0]
                                    }
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {message.createdAt ? format(new Date(message.createdAt), 'h:mm a') : ''}
                                  </span>
                                </div>
                              )}
                              <div
                                className={`rounded-lg p-3 ${
                                  isOwnMessage
                                    ? 'bg-everest-blue text-white'
                                    : 'bg-gray-100 text-gray-900'
                                }`}
                              >
                                <p className="text-sm">{message.content}</p>
                              </div>
                              {isOwnMessage ? (
                                <div className="text-xs text-gray-500 mt-1 text-right">
                                  {message.createdAt ? format(new Date(message.createdAt), 'h:mm a') : ''}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200">
                  <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className="pr-12"
                        disabled={!isConnected}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                      >
                        <Paperclip className="w-4 h-4 text-gray-400" />
                      </Button>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-everest-blue hover:bg-blue-700 h-9 w-9 p-0"
                      disabled={!messageInput.trim() || !isConnected}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                  
                  {!isConnected && (
                    <p className="text-xs text-red-500 mt-2">
                      Connection lost. Trying to reconnect...
                    </p>
                  )}

                  {/* Host Controls */}
                  {((isHost && activeEvent.status === 'published') ? (
                    <div className="mt-3 flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => markPlayedMutation.mutate(activeEvent.id)}
                        disabled={markPlayedMutation.isPending}
                        className="bg-everest-green hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark as Played
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => cancelEventMutation.mutate(activeEvent.id)}
                        disabled={cancelEventMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel Event
                      </Button>
                    </div>
                  ) : null) as React.ReactNode}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <p>Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
