import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, List, Map, Filter } from "lucide-react";
import EventCard from "./event-card";
import { EventWithHost } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface EventGridProps {
  filters: {
    sports: string[];
    date: string;
    skillLevel: string;
    location: string;
    radius: number;
    priceMax: number;
    search: string;
  };
  viewMode: 'list' | 'map';
  onViewModeChange: (mode: 'list' | 'map') => void;
  onCreateEvent: () => void;
  onOpenChat: (eventId: number) => void;
}

export default function EventGrid({ 
  filters, 
  viewMode, 
  onViewModeChange, 
  onCreateEvent, 
  onOpenChat 
}: EventGridProps) {
  const [searchQuery, setSearchQuery] = useState(filters.search);
  const [selectedEventForPayment, setSelectedEventForPayment] = useState<number | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading, error } = useQuery<EventWithHost[]>({
    queryKey: ['/api/events', filters],
    staleTime: 30000, // 30 seconds
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest('POST', '/api/bookings', {
        eventId,
        status: 'confirmed'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event Joined!",
        description: "You have successfully joined the event.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleJoinEvent = (eventId: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please log in to join events.",
        variant: "destructive",
      });
      return;
    }
    createBookingMutation.mutate(eventId);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update search filter
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Failed to load events. Please try again.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              <Filter className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Discover Events</h1>
          </div>
          <div className="flex items-center space-x-3">
            {/* View Toggle */}
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <Toggle
                pressed={viewMode === 'list'}
                onPressedChange={() => onViewModeChange('list')}
                size="sm"
                className="data-[state=on]:bg-white data-[state=on]:shadow-sm"
              >
                <List className="w-4 h-4 mr-1" />
                List
              </Toggle>
              <Toggle
                pressed={viewMode === 'map'}
                onPressedChange={() => onViewModeChange('map')}
                size="sm"
                className="data-[state=on]:bg-white data-[state=on]:shadow-sm"
              >
                <Map className="w-4 h-4 mr-1" />
                Map
              </Toggle>
            </div>
            <Button 
              onClick={onCreateEvent}
              className="bg-everest-blue hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Create Event</span>
            </Button>
          </div>
        </div>
        
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <Input
            placeholder="Search events by sport, location, or host..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        </form>
      </div>

      {/* Content */}
      <div className="p-6">
        {viewMode === 'map' ? (
          <div className="bg-gray-200 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-500">Map view coming soon!</p>
          </div>
        ) : (
          <>
            {/* Results Summary */}
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                {isLoading ? 'Loading...' : `${events.length} events found`}
              </p>
            </div>

            {/* Event Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <div className="max-w-sm mx-auto">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
                  <p className="text-gray-500 mb-4">
                    Try adjusting your filters or create a new event.
                  </p>
                  <Button onClick={onCreateEvent} className="bg-everest-blue hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Event
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onJoin={handleJoinEvent}
                    onOpenChat={onOpenChat}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
            {events.length > 0 && events.length % 18 === 0 && (
              <div className="mt-8 text-center">
                <Button variant="outline">
                  Load More Events
                </Button>
              </div>
            )}
          </>
        )}
      </div>


    </>
  );
}
