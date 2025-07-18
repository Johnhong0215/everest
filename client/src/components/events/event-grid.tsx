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
  // Props for mobile sidebar
  pendingFilters?: {
    location: string;
    radius: number;
    priceMax: number;
  };
  onImmediateFilterChange?: (key: string, value: any) => void;
  onPendingFilterChange?: (key: string, value: any) => void;
  onApplyFilters?: () => void;
  onRemoveFilters?: () => void;
  hasPendingChanges?: boolean;
}

export default function EventGrid({ 
  filters, 
  viewMode, 
  onViewModeChange, 
  onCreateEvent, 
  onOpenChat,
  onFiltersChange,
  pendingFilters,
  onImmediateFilterChange,
  onPendingFilterChange,
  onApplyFilters,
  onRemoveFilters,
  hasPendingChanges
}: EventGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventForPayment, setSelectedEventForPayment] = useState<number | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventWithHost | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [locationLoading, setLocationLoading] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);

  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();



  // Force clear all cached location data and start fresh tracking
  useEffect(() => {
    // Enhanced geolocation availability check
    const isGeolocationAvailable = () => {
      return 'geolocation' in navigator && 
             typeof navigator.geolocation.getCurrentPosition === 'function' &&
             (window.location.protocol === 'https:' || 
              window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1' ||
              window.location.hostname.endsWith('.replit.dev'));
    };

    if (!isGeolocationAvailable()) {
      console.log('Geolocation not available - browser does not support it or not in secure context');
      setLocationPermission('denied');
      return;
    }

    // Check location permission status but always get fresh location
    try {
      const savedPermission = localStorage.getItem('locationPermission');
      
      if (savedPermission === 'granted') {
        console.log('Location permission previously granted, getting fresh location...');
        setLocationPermission('granted');
        // Immediately request fresh location and start tracking
        requestLocation();
      } else if (savedPermission === 'denied') {
        console.log('Location permission previously denied');
        setLocationPermission('denied');
        // Clear any cached location data when permission is denied
        localStorage.removeItem('userLocation');
        setUserLocation(null);
      } else {
        console.log('No location permission saved, user needs to grant permission');
        setLocationPermission('prompt');
        // Clear any cached location data
        localStorage.removeItem('userLocation');
        setUserLocation(null);
      }
    } catch (error) {
      console.warn('Failed to check saved permission:', error);
      // Clear all location data on error
      localStorage.removeItem('userLocation');
      localStorage.removeItem('locationPermission');
      setUserLocation(null);
      setLocationPermission('prompt');
    }

    // Cleanup function to stop tracking when component unmounts
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
    };
  }, []);

  // Stop tracking when permission is revoked
  useEffect(() => {
    if (locationPermission !== 'granted' && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  }, [locationPermission, watchId]);

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

  // Function to start continuous location tracking
  const startLocationTracking = () => {
    if (!('geolocation' in navigator)) {
      console.log('Geolocation not supported by browser');
      return;
    }
    
    if (watchId !== null) {
      console.log('Location tracking already active');
      return; // Already tracking
    }

    console.log('Starting continuous location tracking...');
    
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        console.log('Raw location update:', newLocation, 'accuracy:', position.coords.accuracy);
        
        // Update for any meaningful location change (more than ~5 meters) for real-time tracking
        const hasSignificantChange = !userLocation || 
          calculateDistance(userLocation.lat, userLocation.lng, newLocation.lat, newLocation.lng) > 0.005; // ~5 meters for more responsive tracking
        
        if (hasSignificantChange) {
          console.log('Location updated with significant change:', newLocation);
          setUserLocation(newLocation);
          
          // Update permission state to granted
          if (locationPermission !== 'granted') {
            setLocationPermission('granted');
            localStorage.setItem('locationPermission', 'granted');
          }
          
          // Save updated location to localStorage
          try {
            localStorage.setItem('userLocation', JSON.stringify(newLocation));
          } catch (error) {
            console.warn('Failed to save updated location:', error);
          }
          
          // Force refresh events data with new location
          queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        } else {
          console.log('Location update too small, skipping');
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
        
        // Handle different error types
        if (error.code === error.PERMISSION_DENIED) {
          console.log('Location permission denied by user');
          setLocationPermission('denied');
          localStorage.setItem('locationPermission', 'denied');
          
          // Stop tracking
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            setWatchId(null);
          }
          
          toast({
            title: "Location Access Denied",
            description: "Enable location access in browser settings to see distance to events.",
            variant: "destructive",
          });
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          console.log('Location position unavailable');
          // Don't change permission state for temporary issues
        } else if (error.code === error.TIMEOUT) {
          console.log('Location request timed out');
          // Don't change permission state for timeouts
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000, // 20 second timeout - match the manual request timeout
        maximumAge: 0 // No cache - always get fresh location for real-time updates
      }
    );
    
    setWatchId(id);
    console.log('Location tracking started with watchId:', id);
  };

  const requestLocation = () => {
    console.log('User requested location permission...');
    setLocationLoading(true);
    
    if (!('geolocation' in navigator)) {
      console.error('Geolocation not supported by this browser');
      setLocationPermission('denied');
      setLocationLoading(false);
      toast({
        title: "Location Not Supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return;
    }

    console.log('Attempting to get current location...');
    
    // Single, reliable location request with optimized settings
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Location request successful:', position);
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setUserLocation(location);
        setLocationPermission('granted');
        setLocationLoading(false);
        
        console.log('User location state updated:', location);
        
        // Save to localStorage for persistence
        try {
          localStorage.setItem('userLocation', JSON.stringify(location));
          localStorage.setItem('locationPermission', 'granted');
          console.log('Location saved successfully');
        } catch (error) {
          console.warn('Failed to save location:', error);
        }
        
        toast({
          title: "Location Enabled",
          description: "Your location has been enabled for distance calculations.",
        });

        // Start continuous location tracking
        startLocationTracking();
        
        // Force refresh events data with new location
        queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      },
      (error) => {
        console.error('Location request failed:', error);
        let errorMessage = "Unable to get your location.";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please allow location permissions in your browser.";
            setLocationPermission('denied');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location services are not available. Please check your device settings.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please ensure location services are enabled and try again.";
            break;
        }
        
        setLocationLoading(false);
        
        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,    // Try for best accuracy
        timeout: 20000,             // 20 second timeout - generous but not infinite
        maximumAge: 0               // No cache - always get fresh location
      }
    );
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

  // Filter out outdated events (events from previous days, but keep all events for today)
  const filteredEvents = rawEvents.filter(event => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const eventDate = new Date(event.startTime);
    const now = new Date();
    
    // Get date strings in user's timezone
    const eventDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(eventDate);
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(now);
    
    // Show events that are today or in the future (by date, not time)
    return eventDateStr >= todayStr;
  });

  // Sort events by date first, then by distance within each date
  const events = filteredEvents.sort((a, b) => {
    const dateA = new Date(a.startTime);
    const dateB = new Date(b.startTime);
    
    // First sort by date
    if (dateA.toDateString() !== dateB.toDateString()) {
      return dateA.getTime() - dateB.getTime();
    }
    
    // Same date, sort by distance if user location is available
    if (!userLocation) return 0;
    
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

  // Group events by date
  const groupEventsByDate = (events: EventWithHost[]) => {
    const groups: { [key: string]: EventWithHost[] } = {};
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Get today and tomorrow dates in user's timezone
    const today = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(today);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(tomorrow);
    
    events.forEach(event => {
      // Convert event UTC timestamp to user's timezone date
      const eventDate = new Date(event.startTime);
      const eventDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(eventDate);
      
      let groupKey: string;
      if (eventDateStr === todayStr) {
        groupKey = 'Today';
      } else if (eventDateStr === tomorrowStr) {
        groupKey = 'Tomorrow';
      } else {
        // Format as "Monday, Dec 25" in user's timezone
        groupKey = eventDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          month: 'short', 
          day: 'numeric',
          timeZone: userTimezone
        });
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(event);
    });
    
    return groups;
  };

  const eventGroups = groupEventsByDate(events);

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
      {(locationPermission === 'denied' || locationPermission === 'prompt') && !userLocation && (
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
              disabled={locationLoading}
              className="flex-shrink-0"
            >
              <Navigation className={`w-4 h-4 mr-2 ${locationLoading ? 'animate-spin' : ''}`} />
              {locationLoading ? 'Getting Location...' : 'Enable Location'}
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
                <SheetContent side="left" className="w-[300px] sm:w-[400px] flex flex-col">
                  <div className="border-b pb-4 flex-shrink-0">
                    <h2 className="text-lg font-semibold">Filter Events</h2>
                    <p className="text-sm text-gray-600">Find the perfect game for you</p>
                  </div>
                  <div className="flex-1 overflow-y-auto pt-4">
                    <Sidebar
                      appliedFilters={filters}
                      pendingFilters={pendingFilters || { location: '', radius: 5, priceMax: 100 }}
                      onImmediateFilterChange={onImmediateFilterChange || (() => {})}
                      onPendingFilterChange={onPendingFilterChange || (() => {})}
                      onApplyFilters={onApplyFilters || (() => {})}
                      onRemoveFilters={onRemoveFilters || (() => {})}
                      hasPendingChanges={hasPendingChanges || false}
                      className="border-0 shadow-none"
                    />
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
                onJoin={handleJoinEvent}
                onOpenChat={onOpenChat}
                onCancel={handleCancelEvent}
                onModify={handleModifyEvent}
                currentUserId={user && typeof user === 'object' && 'id' in user ? (user as any).id : ''}
                userBookingStatusMap={userBookingStatusMap}
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
              <div className="space-y-8">
                {Object.entries(eventGroups).map(([dateGroup, groupEvents]) => (
                  <div key={dateGroup} className="space-y-4">
                    {/* Date Header */}
                    <div className="border-b border-gray-200 pb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{dateGroup}</h3>
                      <p className="text-sm text-gray-500">{groupEvents.length} event{groupEvents.length !== 1 ? 's' : ''}</p>
                    </div>
                    
                    {/* Events Grid for this date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {groupEvents.map((event) => (
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
                  </div>
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
