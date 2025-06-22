import { useState, useRef, useCallback, useEffect } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import EventGrid from "@/components/events/event-grid";
import CreateEventModal from "@/components/events/create-event-modal";
import MyBookingsModal from "@/components/bookings/my-bookings-modal";
import ChatModal from "@/components/chat/chat-modal";
import BookingRequestsModal from "@/components/notifications/booking-requests-modal";

export default function Home() {
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isBookingsOpen, setIsBookingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  // UI filters (for immediate display)
  const [uiFilters, setUiFilters] = useState({
    sports: [] as string[],
    date: '',
    skillLevel: '',
    location: '',
    radius: 5,
    priceMax: 100,
    search: '',
  });

  // Committed filters (for API queries)
  const [committedFilters, setCommittedFilters] = useState({
    sports: [] as string[],
    date: '',
    skillLevel: '',
    location: '',
    radius: 5,
    priceMax: 100,
    search: '',
  });

  const filterTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounced filter update function
  const handleFiltersChange = useCallback((newFilters: typeof uiFilters) => {
    // Immediately update UI state
    setUiFilters(newFilters);

    // For certain filters, commit immediately (sports, date, skillLevel)
    const hasImmediateChange = (
      JSON.stringify(newFilters.sports) !== JSON.stringify(uiFilters.sports) ||
      newFilters.date !== uiFilters.date ||
      newFilters.skillLevel !== uiFilters.skillLevel
    );

    if (hasImmediateChange) {
      setCommittedFilters(newFilters);
      return;
    }

    // For location, radius, priceMax, and search - use debouncing
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }

    filterTimeoutRef.current = setTimeout(() => {
      setCommittedFilters(newFilters);
    }, 800);
  }, [uiFilters]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        onCreateEvent={() => setIsCreateEventOpen(true)}
        onOpenBookings={() => setIsBookingsOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenRequests={() => setIsRequestsOpen(true)}
      />
      
      <div className="flex">
        <aside className="w-80 bg-white shadow-sm border-r border-gray-200 hidden lg:block">
          <Sidebar 
            filters={uiFilters}
            onFiltersChange={handleFiltersChange}
          />
        </aside>
        
        <main className="flex-1 lg:pl-0">
          <EventGrid 
            filters={committedFilters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCreateEvent={() => setIsCreateEventOpen(true)}
            onFiltersChange={handleFiltersChange}
            onOpenChat={(eventId) => {
              setActiveEventId(eventId);
              setIsChatOpen(true);
            }}
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
        onOpenChat={(eventId) => {
          setActiveEventId(eventId);
          setIsChatOpen(true);
        }}
      />
      
      <ChatModal 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        eventId={activeEventId}
      />
      
      <BookingRequestsModal 
        isOpen={isRequestsOpen}
        onClose={() => setIsRequestsOpen(false)}
      />
    </div>
  );
}
