import React, { useEffect, useRef, useState } from 'react';
import { EventWithHost } from '@shared/schema';
import { SPORTS } from '@/lib/constants';

interface MapProps {
  events: EventWithHost[];
  userLocation?: { lat: number; lng: number } | null;
  onEventSelect?: (event: EventWithHost) => void;
  className?: string;
}

interface MapEvent extends EventWithHost {
  lat: number;
  lng: number;
}

export default function InteractiveMap({ events, userLocation, onEventSelect, className = '' }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapEvents, setMapEvents] = useState<MapEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);
  const [zoom, setZoom] = useState(12);
  const [center, setCenter] = useState({ lat: 40.7128, lng: -74.0060 }); // Default to NYC

  useEffect(() => {
    // Process events with valid coordinates
    const validEvents = events
      .filter(event => event.latitude && event.longitude)
      .map(event => ({
        ...event,
        lat: parseFloat(event.latitude!),
        lng: parseFloat(event.longitude!)
      }));
    
    setMapEvents(validEvents);

    // Set center to user location or first event
    if (userLocation) {
      setCenter(userLocation);
    } else if (validEvents.length > 0) {
      setCenter({ lat: validEvents[0].lat, lng: validEvents[0].lng });
    }
  }, [events, userLocation]);

  const handleEventClick = (event: MapEvent) => {
    setSelectedEvent(event);
    onEventSelect?.(event);
  };

  const getSportColor = (sport: string) => {
    const sportConfig = SPORTS.find(s => s.id === sport);
    return sportConfig?.color || 'blue';
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return (
    <div className={`relative w-full h-full bg-gray-100 rounded-lg overflow-hidden ${className}`}>
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full relative">
        {/* Simple Map Visualization */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100">
          {/* Grid overlay to simulate map tiles */}
          <div className="absolute inset-0 opacity-20">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="absolute border-gray-300 border-r border-b w-20 h-20" 
                   style={{ 
                     left: `${(i % 10) * 10}%`, 
                     top: `${Math.floor(i / 10) * 50}%` 
                   }} />
            ))}
          </div>

          {/* User Location Marker */}
          {userLocation && (
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
              style={{
                left: '50%',
                top: '50%'
              }}
            >
              <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-lg animate-pulse" />
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                Your Location
              </div>
            </div>
          )}

          {/* Event Markers */}
          {mapEvents.map((event, index) => {
            const distance = userLocation 
              ? calculateDistance(userLocation.lat, userLocation.lng, event.lat, event.lng)
              : 0;
            
            // Position markers relative to center and distance
            const offsetX = userLocation ? (event.lng - userLocation.lng) * 1000 : (index % 5) * 100 - 200;
            const offsetY = userLocation ? (userLocation.lat - event.lat) * 1000 : Math.floor(index / 5) * 100 - 200;
            
            return (
              <div
                key={event.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
                style={{
                  left: `calc(50% + ${Math.max(-200, Math.min(200, offsetX))}px)`,
                  top: `calc(50% + ${Math.max(-200, Math.min(200, offsetY))}px)`
                }}
                onClick={() => handleEventClick(event)}
              >
                <div className={`w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform ${
                  selectedEvent?.id === event.id ? 'ring-2 ring-red-300' : ''
                }`}>
                  <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                    {SPORTS.find(s => s.id === event.sport)?.name?.charAt(0) || 'E'}
                  </div>
                </div>
                
                {selectedEvent?.id === event.id && (
                  <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-48 z-30">
                    <div className="text-sm font-semibold text-gray-900 mb-1">{event.title}</div>
                    <div className="text-xs text-gray-600 mb-1">{event.sport}</div>
                    <div className="text-xs text-gray-500">
                      {userLocation && `${distance.toFixed(1)} mi away`}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      ${(event as any).price || 0} • {event.maxPlayers - (event.currentPlayers || 0)} spots left
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
          <button
            onClick={() => setZoom(Math.min(zoom + 1, 18))}
            className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 text-gray-700 font-bold"
          >
            +
          </button>
          <button
            onClick={() => setZoom(Math.max(zoom - 1, 8))}
            className="w-10 h-10 bg-white border border-gray-300 rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 text-gray-700 font-bold"
          >
            −
          </button>
        </div>

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 bg-white border border-gray-200 rounded-lg p-3 shadow-lg z-20">
          <div className="text-xs font-semibold text-gray-900 mb-2">Legend</div>
          <div className="flex items-center space-x-2 mb-1">
            <div className="w-3 h-3 bg-blue-600 rounded-full" />
            <span className="text-xs text-gray-600">Your Location</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span className="text-xs text-gray-600">Sports Events</span>
          </div>
        </div>

        {/* Event Count */}
        <div className="absolute top-4 left-4 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg z-20">
          <div className="text-sm font-semibold text-gray-900">
            {mapEvents.length} Event{mapEvents.length !== 1 ? 's' : ''} Found
          </div>
        </div>
      </div>
    </div>
  );
}