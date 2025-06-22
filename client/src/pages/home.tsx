import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
  // Applied filters (for API queries - what's actually being searched)
  const [appliedFilters, setAppliedFilters] = useState({
    sports: [] as string[],
    date: '',
    skillLevel: '',
    location: '',
    radius: 5,
    priceMax: 100,
    search: '',
  });

  // Pending filters (what's currently being edited in the sidebar)
  const [pendingFilters, setPendingFilters] = useState({
    location: '',
    radius: 5,
    priceMax: 100,
    search: '',
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

  // Check if there are pending filter changes
  const hasPendingChanges = useMemo(() => (
    pendingFilters.location !== appliedFilters.location ||
    pendingFilters.radius !== appliedFilters.radius ||
    pendingFilters.priceMax !== appliedFilters.priceMax ||
    pendingFilters.search !== appliedFilters.search
  ), [pendingFilters, appliedFilters]);

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
            appliedFilters={appliedFilters}
            pendingFilters={pendingFilters}
            onImmediateFilterChange={handleImmediateFiltersChange}
            onPendingFilterChange={handlePendingFiltersChange}
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
            onFiltersChange={() => {}}
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
