import { useState } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import EventGrid from "@/components/events/event-grid";
import CreateEventModal from "@/components/events/create-event-modal";
import MyBookingsModal from "@/components/bookings/my-bookings-modal";
import ChatModal from "@/components/chat/chat-modal";

export default function Home() {
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isBookingsOpen, setIsBookingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState({
    sports: [] as string[],
    date: '',
    skillLevel: '',
    location: '',
    radius: 5,
    priceMax: 100,
    search: '',
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation 
        onCreateEvent={() => setIsCreateEventOpen(true)}
        onOpenBookings={() => setIsBookingsOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
      />
      
      <div className="flex">
        <Sidebar 
          filters={filters}
          onFiltersChange={setFilters}
        />
        
        <main className="flex-1 lg:pl-0">
          <EventGrid 
            filters={filters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCreateEvent={() => setIsCreateEventOpen(true)}
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
    </div>
  );
}
