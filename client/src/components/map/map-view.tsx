import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, AlertCircle } from "lucide-react";
import { EventWithHost } from "@shared/schema";
import EventCard from "@/components/events/event-card";
import InteractiveMap from "@/components/ui/interactive-map";

interface MapViewProps {
  events: EventWithHost[];
  onJoin: (eventId: number) => void;
  onOpenChat: (eventId: number) => void;
  onCancel?: (eventId: number) => void;
  onModify?: (eventId: number) => void;
  currentUserId?: string;
}

interface UserLocation {
  lat: number;
  lng: number;
}

export default function MapView({ events, onJoin, onOpenChat, onCancel, onModify, currentUserId }: MapViewProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [selectedEvent, setSelectedEvent] = useState<EventWithHost | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const requestLocation = () => {
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLocationPermission('granted');
        setIsLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationPermission('denied');
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    if ('geolocation' in navigator) {
      requestLocation();
    } else {
      setLocationPermission('denied');
    }
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const eventsWithLocation = events.filter(event => event.latitude && event.longitude);
  const eventsWithDistance = userLocation 
    ? eventsWithLocation.map(event => ({
        ...event,
        distance: calculateDistance(
          userLocation.lat, 
          userLocation.lng, 
          parseFloat(event.latitude!), 
          parseFloat(event.longitude!)
        )
      })).sort((a, b) => (a as any).distance - (b as any).distance)
    : eventsWithLocation;

  if (locationPermission === 'denied') {
    return (
      <div className="h-96 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Location Access Required</h3>
          <p className="text-gray-600 mb-4">
            To show nearby events on the map, we need access to your location. Please enable location permissions in your browser.
          </p>
          <Button onClick={requestLocation} className="bg-everest-blue hover:bg-blue-700">
            <Navigation className="w-4 h-4 mr-2" />
            Enable Location
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !userLocation) {
    return (
      <div className="h-96 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-everest-blue mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Getting Your Location</h3>
          <p className="text-gray-600">Finding events near you...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Interactive Map with Event Pins */}
      <InteractiveMap
        events={events}
        userLocation={userLocation}
        onEventClick={(event) => {
          setSelectedEvent(event);
        }}
      />

      {/* Nearby Events List */}
      {eventsWithDistance.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Nearby Events {userLocation && `(sorted by distance)`}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventsWithDistance.slice(0, 6).map((event) => (
              <div key={event.id} className="relative">
                <EventCard
                  event={event}
                  onJoin={onJoin}
                  onOpenChat={onOpenChat}
                  onCancel={onCancel}
                  onModify={onModify}
                  currentUserId={currentUserId}
                />
                {(event as any).distance !== undefined && (
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-600">
                    {(event as any).distance.toFixed(1)} mi
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}