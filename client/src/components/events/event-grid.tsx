import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, List, Map, Filter, Navigation, AlertCircle } from "lucide-react";
import EventCard from "./event-card";
import MapView from "@/components/map/map-view";
import Sidebar from "@/components/layout/sidebar";
import EditEventModal from "./edit-event-modal";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { EventWithHost } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface EventGridProps {
  filters: {
    sports: string[];
    date: string;
    skillLevels: string[];
    genders: string[];
    location: string;
    radius: number;
    priceMax: number;
  };
  viewMode: 'list' | 'map';
  onViewModeChange: (mode: 'list' | 'map') => void;
  onCreateEvent: () => void;
  onOpenChat: (eventId: number) => void;
  onFiltersChange: (filters: any) => void;
}

export default function EventGrid({ 
  filters, 
  viewMode, 
  onViewModeChange, 
  onCreateEvent, 
  onOpenChat,
  onFiltersChange
}: EventGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventForPayment, setSelectedEventForPayment] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventWithHost | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Get user location on component mount
  useEffect(() => {
    if ('geolocation' in navigator && locationPermission === 'prompt') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationPermission('granted');
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationPermission('denied');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, [locationPermission]);

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationPermission('granted');
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationPermission('denied');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  const { data: rawEvents = [], isLoading, error } = useQuery<EventWithHost[]>({
    queryKey: ['/api/events', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.sports.length > 0) {
        params.append('sports', filters.sports.join(','));
      }
      if (filters.date) {
        params.append('date', filters.date);
      }
      if (filters.skillLevels.length > 0) {
        params.append('skillLevels', filters.skillLevels.join(','));
      }
      if (filters.location) {
        params.append('location', filters.location);
      }
      if (filters.radius) {
        params.append('radius', filters.radius.toString());
      }
      if (filters.priceMax) {
        params.append('priceMax', filters.priceMax.toString());
      }
      if (filters.genders.length > 0) {
        params.append('genders', filters.genders.join(','));
      }
      
      // Add user location for distance filtering
      if (userLocation) {
        params.append('userLat', userLocation.lat.toString());
        params.append('userLng', userLocation.lng.toString());
      }
      
      // Add user timezone for accurate date filtering
      params.append('userTimezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
      
      const url = `/api/events${params.toString() ? `?${params.toString()}` : ''}`;
      return fetch(url).then(res => {
        if (!res.ok) throw new Error('Failed to fetch events');
        return res.json();
      });
    },
    staleTime: 30000, // 30 seconds
  });

  // Filter out outdated events (events past today's date and time)
  const filteredEvents = rawEvents.filter(event => {
    const eventDate = new Date(event.startTime);
    const now = new Date();
    return eventDate >= now; // Only show future events
  });

  // Sort events by distance (closest first, then events without location data)
  const events = filteredEvents.sort((a, b) => {
    if (!userLocation) return 0; // No sorting if user location is not available
    
    const aHasLocation = a.latitude && a.longitude;
    const bHasLocation = b.latitude && b.longitude;
    
    // Events with location data come first
    if (aHasLocation && !bHasLocation) return -1;
    if (!aHasLocation && bHasLocation) return 1;
    if (!aHasLocation && !bHasLocation) return 0;
    
    // Both have location data, sort by distance
    const latA = typeof a.latitude === 'string' ? parseFloat(a.latitude) : a.latitude;
    const lonA = typeof a.longitude === 'string' ? parseFloat(a.longitude) : a.longitude;
    const latB = typeof b.latitude === 'string' ? parseFloat(b.latitude) : b.latitude;
    const lonB = typeof b.longitude === 'string' ? parseFloat(b.longitude) : b.longitude;
    
    const distanceA = calculateDistance(userLocation.lat, userLocation.lng, latA!, lonA!);
    const distanceB = calculateDistance(userLocation.lat, userLocation.lng, latB!, lonB!);
    
    return distanceA - distanceB;
  });

  // Fetch user bookings to determine status for each event
  const { data: userBookings = [] } = useQuery({
    queryKey: ['/api/my-bookings'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Create a map of event ID to booking status for quick lookup
  const userBookingStatusMap = (userBookings as any[]).reduce((map: Record<number, string>, booking: any) => {
    map[booking.eventId] = booking.status;
    return map;
  }, {});

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest('POST', '/api/bookings', {
        eventId
        // Status will be set to 'requested' automatically by the server
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Join Request Sent!",
        description: "Your request to join has been sent to the host for approval.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send join request. Please try again.",
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

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await apiRequest('DELETE', `/api/events/${eventId}`, {});
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Event Cancelled",
        description: "Your event has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCancelEvent = (eventId: number) => {
    if (confirm("Are you sure you want to cancel this event? This action cannot be undone.")) {
      deleteEventMutation.mutate(eventId);
    }
  };

  const handleModifyEvent = (eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setEditingEvent(event);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const searchTerm = formData.get('search') as string;
    // Update filters through parent component
    const newFilters = { ...filters, search: searchTerm };
    // This would need to be passed down from parent component
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
      {/* Location Permission Banner */}
      {locationPermission === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mx-4 mt-4">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-amber-800">Enable Location for Distance Calculations</h3>
              <p className="text-sm text-amber-700 mt-1">
                Allow location access to see accurate distances to events instead of "Distance N/A"
              </p>
            </div>
            <Button
              onClick={requestLocation}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Enable Location
            </Button>
          </div>
        </div>
      )}

      {/* Completely Fixed Header Region */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-sm">
        {/* Main Header Row */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden"
                  >
                    <Filter className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                  <div className="space-y-4">
                    <div className="border-b pb-4">
                      <h2 className="text-lg font-semibold">Filter Events</h2>
                      <p className="text-sm text-gray-600">Find the perfect game for you</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      Mobile filtering coming soon
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
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
          <form onSubmit={handleSearch} className="relative mb-4">
            <Input
              placeholder="Search events by sport, location, or host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          </form>


        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {viewMode === 'map' ? (
          <div className="h-[600px] bg-gray-50 rounded-lg border border-gray-200">
            {events.length > 0 ? (
              <MapView 
                events={events}
                userLocation={userLocation}
                onEventClick={(event) => {
                  console.log('Event clicked:', event);
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-8">
                  <Map className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Events to Show</h3>
                  <p className="text-gray-500">Create an event or adjust your filters to see events on the map.</p>
                </div>
              </div>
            )}
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
            ) : (viewMode as string) === 'map' ? (
              <MapView
                events={events}
                onJoin={handleJoinEvent}
                onOpenChat={onOpenChat}
                onCancel={handleCancelEvent}
                onModify={handleModifyEvent}
                currentUserId={user && typeof user === 'object' && 'id' in user ? (user as any).id : ''}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onJoin={handleJoinEvent}
                    onOpenChat={onOpenChat}
                    onCancel={handleCancelEvent}
                    onModify={handleModifyEvent}
                    currentUserId={user && typeof user === 'object' && 'id' in user ? (user as any).id : ''}
                    userLocation={userLocation}
                    userBookingStatus={userBookingStatusMap[event.id] as 'requested' | 'accepted' | 'rejected' | 'cancelled' | null}
                    isUserCreated={event.hostId === (user && typeof user === 'object' && 'id' in user ? (user as any).id : '')}
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

      {/* Edit Event Modal */}
      <EditEventModal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        event={editingEvent}
      />
    </>
  );
}
