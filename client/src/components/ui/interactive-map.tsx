import { useState, useEffect } from "react";
import { MapPin, Navigation, Users } from "lucide-react";
import { EventWithHost } from "@shared/schema";
import { SPORTS } from "@/lib/constants";

interface InteractiveMapProps {
  events: EventWithHost[];
  userLocation: { lat: number; lng: number } | null;
  onEventClick?: (event: EventWithHost) => void;
}

export default function InteractiveMap({ events, userLocation, onEventClick }: InteractiveMapProps) {

  const [selectedEvent, setSelectedEvent] = useState<EventWithHost | null>(null);

  // Filter events that have location data
  const eventsWithLocation = events.filter(event => event.latitude && event.longitude);

  const handleEventClick = (event: EventWithHost) => {
    setSelectedEvent(event);
    onEventClick?.(event);
  };

  const getSportIcon = (sportId: string) => {
    const sportIcons: Record<string, string> = {
      'badminton': '🏸',
      'basketball': '🏀',
      'soccer': '⚽',
      'tennis': '🎾',
      'volleyball': '🏐',
      'tabletennis': '🏓'
    };
    return sportIcons[sportId] || "🏃";
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(date));
  };

  if (!userLocation) {
    return (
      <div className="h-96 bg-gray-50 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Navigation className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">Getting your location...</p>
        </div>
      </div>
    );
  }

  // Calculate map bounds to include all events and user location
  const allLatitudes = [userLocation.lat, ...eventsWithLocation.map(e => parseFloat(e.latitude!))];
  const allLongitudes = [userLocation.lng, ...eventsWithLocation.map(e => parseFloat(e.longitude!))];
  
  const minLat = Math.min(...allLatitudes) - 0.01;
  const maxLat = Math.max(...allLatitudes) + 0.01;
  const minLng = Math.min(...allLongitudes) - 0.01;
  const maxLng = Math.max(...allLongitudes) + 0.01;

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  return (
    <div className="relative h-96 bg-white rounded-lg border overflow-hidden">
      {/* Map iframe with markers */}
      <iframe
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${userLocation.lat},${userLocation.lng}`}
        width="100%"
        height="100%"
        frameBorder="0"
        style={{ border: 0 }}
        allowFullScreen
        title="Interactive Event Map"
      />

      {/* Event pins overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {eventsWithLocation.map((event) => {
          const lat = parseFloat(event.latitude!);
          const lng = parseFloat(event.longitude!);
          
          // Calculate position relative to map bounds
          const x = ((lng - minLng) / (maxLng - minLng)) * 100;
          const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
          
          return (
            <div
              key={event.id}
              className="absolute pointer-events-auto cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
              onClick={() => handleEventClick(event)}
            >
              <div className="relative group">
                <div className="w-8 h-8 bg-everest-blue rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-sm font-bold hover:scale-110 transition-transform">
                  {getSportIcon(event.sport)}
                </div>
                
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                    {event.title}
                    <div className="text-xs opacity-75">
                      {formatDateTime(event.startTime)}
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map controls */}
      <div className="absolute top-4 left-4 space-y-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md">
          <div className="flex items-center space-x-2 text-sm">
            <Navigation className="w-4 h-4 text-everest-blue" />
            <span className="font-medium">Your Location</span>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Events count */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md">
        <div className="text-center">
          <div className="text-lg font-bold text-everest-blue">{eventsWithLocation.length}</div>
          <div className="text-xs text-gray-600">Events</div>
        </div>
      </div>

      {/* Selected event details */}
      {selectedEvent && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4 border">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{selectedEvent.title}</h3>
              <p className="text-sm text-gray-600">{selectedEvent.location}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{selectedEvent.currentPlayers}/{selectedEvent.maxPlayers}</span>
                </div>
                <span>{formatDateTime(selectedEvent.startTime)}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}