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
  // UI filters (what user sees and can adjust)
  const [uiFilters, setUiFilters] = useState({
    sports: [] as string[],
    date: '',
    skillLevel: '',
    location: '',
    radius: 5,
    priceMax: 100,
    search: '',
  });

  // Applied filters (for API queries)
  const [appliedFilters, setAppliedFilters] = useState({
    sports: [] as string[],
    date: '',
    skillLevel: '',
    location: '',
    radius: 5,
    priceMax: 100,
    search: '',
  });

  // Handle immediate filter changes (sports, date, skill level apply immediately)
  const handleFiltersChange = useCallback((newFilters: typeof uiFilters) => {
    setUiFilters(newFilters);
    
    // For sports, date, and skill level - apply immediately
    const immediateFilters = {
      ...appliedFilters,
      sports: newFilters.sports,
      date: newFilters.date,
      skillLevel: newFilters.skillLevel,
    };
    
    setAppliedFilters(immediateFilters);
  }, [appliedFilters]);

  // Apply button handler for location, distance, and price filters
  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(uiFilters);
  }, [uiFilters]);

  // Check if there are pending filter changes
  const hasPendingChanges = (
    uiFilters.location !== appliedFilters.location ||
    uiFilters.radius !== appliedFilters.radius ||
    uiFilters.priceMax !== appliedFilters.priceMax ||
    uiFilters.search !== appliedFilters.search
  );

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
            onApplyFilters={handleApplyFilters}
            hasPendingChanges={hasPendingChanges}
          />
        </aside>
        
        <main className="flex-1 lg:pl-0">
          <EventGrid 
            filters={appliedFilters}
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
