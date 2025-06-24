import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Send, MapPin, Calendar, Paperclip, CheckCircle, X, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { EventWithHost, ChatMessageWithSender } from "@shared/schema";
import { SPORTS } from "@/lib/constants";
import { format, isToday, isYesterday, isSameDay } from "date-fns";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: number | null;
  receiverId?: string | null;
}

interface EventChat {
  eventId: number;
  event: EventWithHost;
  lastMessage: any;
  unreadCount: number;
  otherParticipant: any;
}

export default function ChatModal({ isOpen, onClose, eventId, receiverId }: ChatModalProps) {
  const [activeEventId, setActiveEventId] = useState<number | null>(eventId);
  const [messageInput, setMessageInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessageWithSender[]>([]);
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

  // Fetch user's event chats
  const { data: eventChats = [], isLoading: chatsLoading } = useQuery<EventChat[]>({
    queryKey: ['/api/my-chats'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Set active event when eventId prop changes
  useEffect(() => {
    if (eventId) {
      setActiveEventId(eventId);
      
      // If receiverId is provided, find the correct chat conversation
      if (receiverId && eventChats.length > 0) {
        const targetChat = eventChats.find(chat => 
          chat.eventId === eventId && chat.otherParticipant?.id === receiverId
        );
        if (targetChat) {
          setActiveEventId(targetChat.eventId);
        }
      }
    }
  }, [eventId, receiverId, eventChats]);

  // Fetch active event details directly with error handling
  const { data: activeEvent, error: eventError } = useQuery<EventWithHost>({
    queryKey: [`/api/events/${activeEventId}`],
    enabled: !!activeEventId,
    retry: false,
  });

  // Get the active chat to determine the other participant
  const activeChat = eventChats.find(chat => chat.eventId === activeEventId);
  const otherParticipantId = activeChat?.otherParticipant?.id || receiverId;

  // Fetch messages for active event with specific participant
  const { data: messagesData = [], isLoading: messagesLoading } = useQuery<ChatMessageWithSender[]>({
    queryKey: [`/api/events/${activeEventId}/messages`, otherParticipantId],
    queryFn: async () => {
      if (!activeEventId) return [];
      
      // Try with otherParticipantId first, fallback to all messages
      let url = `/api/events/${activeEventId}/messages`;
      if (otherParticipantId) {
        url += `?otherUserId=${otherParticipantId}`;
      }
      
      console.log(`Fetching messages from: ${url}`);
      const response = await apiRequest('GET', url);
      const messages = Array.isArray(response) ? response : [];
      console.log(`Received ${messages.length} messages:`, messages);
      
      return messages;
    },
    enabled: !!activeEventId && isAuthenticated,
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Ensure messages is always an array
  const messages = Array.isArray(messagesData) ? messagesData : [];

  // Combine real messages with optimistic messages
  const allMessages = useMemo(() => {
    const combined = [...messages, ...optimisticMessages]
      .filter(msg => msg && msg.createdAt)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
    
    console.log(`Total combined messages: ${combined.length} (real: ${messages.length}, optimistic: ${optimisticMessages.length})`);
    return combined;
  }, [messages, optimisticMessages]);

  // Auto scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, socketMessages, activeEventId]);

  // Auto scroll to bottom when opening a chat or messages load
  useEffect(() => {
    if (activeEventId) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  }, [activeEventId, messages]);

  // Listen for real-time messages and refresh immediately
  useEffect(() => {
    if (Array.isArray(socketMessages) && socketMessages.length > 0) {
      const newMessage = socketMessages[socketMessages.length - 1];
      
      // Always refresh chat list for unread counts and new conversations
      queryClient.invalidateQueries({ queryKey: ['/api/my-chats'] });
      
      // If message is for active chat, refresh messages and clear optimistic
      if (newMessage.eventId === activeEventId) {
        queryClient.invalidateQueries({ queryKey: [`/api/events/${activeEventId}/messages`] });
        setOptimisticMessages(prev => prev.filter(msg => !msg.isPending));
      }
    }
  }, [socketMessages, activeEventId, queryClient]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageContent = messageInput.trim();
    if (!messageContent || !activeEventId || !user) return;

    // Create temporary optimistic message
    const tempId = Date.now();
    const tempMessage: ChatMessageWithSender = {
      id: tempId as any,
      eventId: activeEventId,
      senderId: (user as any).id,
      receiverId: otherParticipantId || null,
      content: messageContent,
      messageType: "text",
      metadata: null,
      readBy: [(user as any).id],
      createdAt: new Date().toISOString(),
      sender: {
        id: (user as any).id,
        firstName: (user as any).firstName || null,
        lastName: (user as any).lastName || null,
        email: (user as any).email || null,
        profileImageUrl: (user as any).profileImageUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
      isPending: true
    };

    // Add optimistic message at the end
    setOptimisticMessages(prev => [...prev, tempMessage]);
    setMessageInput("");

    // Get the other participant ID (receiver)
    const receiverIdToUse = otherParticipantId || (activeEvent?.hostId === (user as any).id ? 
      activeChat?.otherParticipant?.id : activeEvent?.hostId);

    if (!receiverIdToUse) {
      toast({
        title: "Error",
        description: "Cannot determine message recipient",
        variant: "destructive",
      });
      return;
    }

    console.log(`Sending message: "${messageContent}" to ${receiverIdToUse} for event ${activeEventId}`);

    // Send via HTTP API only (more reliable than WebSocket)
    try {
      const response = await apiRequest('POST', `/api/events/${activeEventId}/messages`, {
        content: messageContent,
        receiverId: receiverIdToUse,
        messageType: 'text'
      });
      console.log('Message sent via HTTP API:', response);
      
      // Remove optimistic message and refresh
      setTimeout(() => {
        setOptimisticMessages(prev => prev.filter(msg => msg.id !== tempId));
        queryClient.invalidateQueries({ queryKey: [`/api/events/${activeEventId}/messages`] });
        queryClient.invalidateQueries({ queryKey: ['/api/my-chats'] });
      }, 200);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove failed optimistic message
      setOptimisticMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      if (isUnauthorizedError(error as Error)) {
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
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages: ChatMessageWithSender[]) => {
    const groups: { date: string; messages: ChatMessageWithSender[] }[] = [];
    let currentDate = '';
    let currentGroup: ChatMessageWithSender[] = [];

    messages.forEach(message => {
      const messageDate = format(new Date(message.createdAt!), 'yyyy-MM-dd');
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
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

  const filteredChats = Array.isArray(eventChats) ? eventChats.filter(chat =>
    chat.event?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.event?.sport?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.otherParticipant?.firstName && chat.otherParticipant?.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (chat.otherParticipant?.lastName && chat.otherParticipant?.lastName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (chat.otherParticipant?.email && chat.otherParticipant?.email.toLowerCase().includes(searchQuery.toLowerCase()))
  ) : [];

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
                  className="pl-10"
                />
              </div>
            </div>

            {/* Chat List */}
            <ScrollArea className="flex-1">
              <div className="p-2">
                {chatsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-gray-500">Loading conversations...</div>
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-sm text-gray-500">No conversations yet</div>
                    <div className="text-xs text-gray-400 mt-1">Start by booking an event!</div>
                  </div>
                ) : (
                  filteredChats.map((chat) => (
                    <div
                      key={chat.eventId}
                      onClick={() => setActiveEventId(chat.eventId)}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-50 mb-1 ${
                        activeEventId === chat.eventId ? 'bg-blue-50 border border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={chat.otherParticipant?.profileImageUrl} />
                          <AvatarFallback>
                            {chat.otherParticipant?.firstName?.[0]}{chat.otherParticipant?.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {chat.otherParticipant?.firstName} {chat.otherParticipant?.lastName}
                            </p>
                            {chat.unreadCount > 0 && (
                              <Badge variant="default" className="bg-blue-500 text-white text-xs">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {chat.event?.title} • {chat.event?.sport}
                          </p>
                          {chat.lastMessage && (
                            <p className="text-xs text-gray-400 truncate mt-1">
                              {chat.lastMessage.content}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col">
            {activeEventId && activeEvent ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getSportIcon(activeEvent.sport)}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{activeEvent.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {format(new Date(activeEvent.dateTime), 'MMM d, yyyy h:mm a')}
                          </div>
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {activeEvent.location}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this chatroom?")) {
                          // Add delete chatroom functionality here
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-sm text-gray-500">Loading messages...</div>
                    </div>
                  ) : allMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-sm text-gray-500">No messages yet</div>
                      <div className="text-xs text-gray-400 mt-1">Start the conversation!</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupMessagesByDate(allMessages).map((group, groupIndex) => (
                        <div key={groupIndex}>
                          {/* Date Separator */}
                          <div className="flex items-center my-4">
                            <Separator className="flex-1" />
                            <span className="px-3 text-xs text-gray-500 bg-white">
                              {isToday(new Date(group.date)) ? 'Today' :
                               isYesterday(new Date(group.date)) ? 'Yesterday' :
                               format(new Date(group.date), 'MMM d, yyyy')}
                            </span>
                            <Separator className="flex-1" />
                          </div>

                          {/* Messages for this date */}
                          {group.messages.map((message, messageIndex) => {
                            const isOwnMessage = message.senderId === (user as any)?.id;
                            const showAvatar = !isOwnMessage && (
                              messageIndex === 0 || 
                              group.messages[messageIndex - 1]?.senderId !== message.senderId
                            );
                            const isPending = message.isPending;

                            return (
                              <div
                                key={`${message.id}-${messageIndex}`}
                                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-2`}
                              >
                                <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                                  {showAvatar && !isOwnMessage && (
                                    <Avatar className="w-8 h-8">
                                      <AvatarImage src={message.sender?.profileImageUrl} />
                                      <AvatarFallback className="text-xs">
                                        {message.sender?.firstName?.[0]}{message.sender?.lastName?.[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                  <div className={`rounded-lg px-3 py-2 ${
                                    isOwnMessage 
                                      ? 'bg-blue-500 text-white' 
                                      : 'bg-gray-100 text-gray-900'
                                  } ${isPending ? 'opacity-60' : ''}`}>
                                    <p className="text-sm break-words">
                                      {message.content}
                                      {isPending && ' (Sending...)'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
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
                        disabled={!user}
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
                      disabled={!messageInput.trim() || !user}
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
                  {isHost && activeEvent?.status === 'published' && (
                    <div className="mt-3 flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (confirm("Are you sure you want to mark this event as played?")) {
                            // Add mark as played functionality here
                          }
                        }}
                        className="bg-everest-green hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Mark as Played
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Are you sure you want to cancel this event?")) {
                            // Add cancel event functionality here
                          }
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel Event
                      </Button>
                    </div>
                  )}
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