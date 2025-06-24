import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import EventGrid from "@/components/events/event-grid";
import CreateEventModal from "@/components/events/create-event-modal";
import MyBookingsModal from "@/components/bookings/my-bookings-modal";
import ChatModal from "@/components/chat/chat-modal";
import BookingRequestsModal from "@/components/bookings/booking-requests-modal";

export default function Home() {
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isBookingsOpen, setIsBookingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(null);

  // Get total unread message count for notification
  const { data: myChats = [] } = useQuery({
    queryKey: ['/api/my-chats'],
    retry: false,
  });

  const totalUnreadCount = myChats.reduce((total: number, chat: any) => total + (chat.unreadCount || 0), 0);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  // Applied filters (for API queries - what's actually being searched)
  const [appliedFilters, setAppliedFilters] = useState({
    sports: [] as string[],
    date: '',
    skillLevels: [] as string[],
    genders: [] as string[],
    location: '',
    radius: 5,
    priceMax: 100,
  });

  // Pending filters (what's currently being edited in the sidebar)
  const [pendingFilters, setPendingFilters] = useState({
    location: '',
    radius: 5,
    priceMax: 100,
  });

  // Handle immediate filter changes (sports, date, skill level apply immediately)
  const handleImmediateFiltersChange = useCallback((key: string, value: any) => {
    setAppliedFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Handle pending filter changes (location, distance, price)
  const handlePendingFiltersChange = useCallback((key: string, value: any) => {
    setPendingFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Apply button handler for pending filters
  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(prev => ({
      ...prev,
      ...pendingFilters
    }));
  }, [pendingFilters]);

  // Remove all filters handler
  const handleRemoveFilters = useCallback(() => {
    const defaultFilters = {
      sports: [] as string[],
      date: '',
      skillLevels: [] as string[],
      genders: [] as string[],
      location: '',
      radius: 5,
      priceMax: 100,
    };
    const defaultPending = {
      location: '',
      radius: 5,
      priceMax: 100,
    };
    
    setAppliedFilters(defaultFilters);
    setPendingFilters(defaultPending);
  }, []);

  // Handle opening chat with specific receiver
  const handleOpenChat = (eventId: number, receiverId?: string) => {
    setActiveEventId(eventId);
    setSelectedReceiverId(receiverId || null);
    setIsChatOpen(true);
  };

  // Check if there are pending filter changes
  const hasPendingChanges = useMemo(() => (
    pendingFilters.location !== appliedFilters.location ||
    pendingFilters.radius !== appliedFilters.radius ||
    pendingFilters.priceMax !== appliedFilters.priceMax
  ), [pendingFilters, appliedFilters]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <Navigation 
          onCreateEvent={() => setIsCreateEventOpen(true)}
          onOpenBookings={() => setIsBookingsOpen(true)}
          onOpenChat={() => setIsChatOpen(true)}
          onOpenRequests={() => setIsRequestsOpen(true)}
        />
      </div>
      
      <div className="flex pt-16">
        <aside className="w-80 bg-white shadow-sm border-r border-gray-200 hidden lg:block fixed left-0 top-16 bottom-0 z-40 overflow-y-auto">
          <Sidebar 
            appliedFilters={appliedFilters}
            pendingFilters={pendingFilters}
            onImmediateFilterChange={handleImmediateFiltersChange}
            onPendingFilterChange={handlePendingFiltersChange}
            onApplyFilters={handleApplyFilters}
            onRemoveFilters={handleRemoveFilters}
            hasPendingChanges={hasPendingChanges}
          />
        </aside>
        
        <main className="flex-1 lg:ml-80">
          <EventGrid 
            filters={appliedFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCreateEvent={() => setIsCreateEventOpen(true)}
            onFiltersChange={() => {}}
            onOpenChat={handleOpenChat}
          />
        </main>
      </div>

      <CreateEventModal 
        isOpen={isCreateEventOpen}
        onClose={() => setIsCreateEventOpen(false)}
      />
      
      <MyBookingsModal 
        isOpen={isBookingsOpen}
        onClose={() => setIsBookingsOpen(false)}
        onOpenChat={handleOpenChat}
      />
      
      <ChatModal 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        eventId={activeEventId}
        receiverId={selectedReceiverId}
      />
      
      <BookingRequestsModal 
        isOpen={isRequestsOpen}
        onClose={() => setIsRequestsOpen(false)}
      />
    </div>
  );
}
