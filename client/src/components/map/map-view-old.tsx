import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngBounds, divIcon } from 'leaflet';
import { EventWithHost } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, DollarSign } from 'lucide-react';
import { formatDateForDisplay } from '@/lib/dateUtils';
import { SPORTS } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapViewProps {
  events: EventWithHost[];
  userLocation?: { lat: number; lng: number } | null;
  onEventClick?: (event: EventWithHost) => void;
  onJoin: (eventId: number) => void;
  onOpenChat: (eventId: number) => void;
  onCancel: (eventId: number) => void;
  onModify: (eventId: number) => void;
  currentUserId: string;
}

interface EventCluster {
  position: [number, number];
  events: EventWithHost[];
  count: number;
}

// Component to fit map bounds to markers
function MapBounds({ events, userLocation }: { events: EventWithHost[]; userLocation?: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (events.length === 0) return;

    const bounds = new LatLngBounds([]);
    
    // Add event locations to bounds
    events.forEach(event => {
      if (event.latitude && event.longitude) {
        bounds.extend([parseFloat(event.latitude), parseFloat(event.longitude)]);
      }
    });
    
    // Add user location to bounds if available
    if (userLocation) {
      bounds.extend([userLocation.lat, userLocation.lng]);
    }
    
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [events, userLocation, map]);

  return null;
}

// Create custom cluster icon
function createClusterIcon(count: number) {
  return divIcon({
    html: `<div class="cluster-icon">
      <div class="cluster-inner">
        ${count}
      </div>
    </div>`,
    className: 'custom-div-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

// Create single event icon based on sport
function createEventIcon(sport: string) {
  const sportConfig = SPORTS.find(s => s.id === sport);
  const icon = sportConfig?.icon || '🏃';
  
  return divIcon({
    html: `<div class="event-icon">
      <div class="event-inner">
        ${icon}
      </div>
    </div>`,
    className: 'custom-div-icon',
    iconSize: [35, 35],
    iconAnchor: [17.5, 35],
  });
}

export default function MapView({ events, userLocation, onEventClick, onJoin, onOpenChat, onCancel, onModify, currentUserId }: MapViewProps) {
  const [selectedEvent, setSelectedEvent] = React.useState<EventWithHost | null>(null);
  // Group events by location (within ~100m radius)
  const eventClusters = useMemo(() => {
    const clusters: EventCluster[] = [];
    const processed = new Set<number>();
    
    events.forEach((event, index) => {
      if (processed.has(index) || !event.latitude || !event.longitude) return;
      
      const eventLat = parseFloat(event.latitude);
      const eventLng = parseFloat(event.longitude);
      const eventLocation = [eventLat, eventLng] as [number, number];
      const nearbyEvents = [event];
      processed.add(index);
      
      // Find other events within ~100m (roughly 0.001 degrees)
      events.forEach((otherEvent, otherIndex) => {
        if (processed.has(otherIndex) || !otherEvent.latitude || !otherEvent.longitude) return;
        
        const otherLat = parseFloat(otherEvent.latitude);
        const otherLng = parseFloat(otherEvent.longitude);
        const distance = Math.sqrt(
          Math.pow(eventLat - otherLat, 2) +
          Math.pow(eventLng - otherLng, 2)
        );
        
        if (distance < 0.001) { // About 100m
          nearbyEvents.push(otherEvent);
          processed.add(otherIndex);
        }
      });
      
      clusters.push({
        position: eventLocation,
        events: nearbyEvents,
        count: nearbyEvents.length
      });
    });
    
    return clusters;
  }, [events]);

  // Default center (USA center)
  const defaultCenter: [number, number] = [39.8283, -98.5795];

  // Map center logic
  const mapCenter: [number, number] = useMemo(() => {
    if (userLocation) {
      return [userLocation.lat, userLocation.lng];
    }
    if (events.length > 0 && events[0].latitude && events[0].longitude) {
      return [parseFloat(events[0].latitude), parseFloat(events[0].longitude)];
    }
    return defaultCenter;
  }, [userLocation, events]);

  const getEventStatus = (event: EventWithHost) => {
    const now = new Date();
    const eventDate = new Date(event.startTime);
    const acceptedBookings = event.bookings?.filter(b => b.status === 'accepted') || [];
    const currentPlayers = acceptedBookings.length + 1; // +1 for host
    
    if (eventDate < now) return 'completed';
    if (currentPlayers >= event.maxPlayers) return 'full';
    return 'open';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'full': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'full': return 'Full';
      case 'completed': return 'Completed';
      default: return 'Open';
    }
  };

  // Create event details component
  const EventDetails = ({ event }: { event: EventWithHost }) => {
    const isOwnEvent = event.hostId === currentUserId;
    const sportData = SPORTS.find(s => s.id === event.sport);
    const now = new Date();
    const eventDate = new Date(event.startTime);
    const isPastEvent = eventDate < now;
    
    const getEventStatus = () => {
      if (isPastEvent) return 'past';
      if ((event.currentPlayers || 0) >= event.maxPlayers) return 'full';
      return 'active';
    };

    const renderActionButton = () => {
      if (isOwnEvent) {
        return (
          <div className="flex gap-2">
            <Button 
              onClick={() => onModify(event.id)}
              variant="outline"
              className="flex-1"
            >
              Modify
            </Button>
            <Button 
              onClick={() => onCancel(event.id)}
              variant="destructive"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        );
      }

      const status = getEventStatus();
      if (status === 'past') {
        return (
          <Button disabled className="w-full">
            Event Completed
          </Button>
        );
      }
      
      if (status === 'full') {
        return (
          <Button disabled className="w-full">
            Event Full ({event.currentPlayers || 0}/{event.maxPlayers})
          </Button>
        );
      }

      return (
        <div className="flex gap-2">
          <Button 
            onClick={() => onJoin(event.id)}
            className="flex-1"
          >
            Join & Pay ${event.pricePerPerson}
          </Button>
          <Button 
            onClick={() => onOpenChat(event.id)}
            variant="outline"
            className="flex-1"
          >
            Chat
          </Button>
        </div>
      );
    };

    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full bg-${sportData?.color || 'gray'}-500`}></div>
                <Badge variant="secondary" className="text-xs">
                  {sportData?.name || event.sport}
                </Badge>
                {isOwnEvent && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Your Event
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{event.title}</h3>
              <p className="text-sm text-gray-600">{event.host.email?.split('@')[0] || 'Host'}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedEvent(null)}
              className="p-1"
            >
              ×
            </Button>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>{formatDateForDisplay(event.startTime)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{event.location}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{event.currentPlayers || 0}/{event.maxPlayers} players</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <DollarSign className="w-4 h-4" />
              <span>${event.pricePerPerson} per person</span>
            </div>
          </div>

          <div className="text-sm text-gray-600 mb-4">
            <strong>Skill Level:</strong> {event.skillLevel} • <strong>Gender Mix:</strong> {event.genderMix}
          </div>

          {event.description && (
            <div className="text-sm text-gray-600 mb-4">
              <strong>Description:</strong> {event.description}
            </div>
          )}

          {renderActionButton()}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="relative w-full h-full flex">
      {/* Map Container */}
      <div className={`${selectedEvent ? 'lg:w-2/3' : 'w-full'} h-full relative`}>
      <style>{`
        .cluster-icon {
          background: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
        }
        
        .cluster-inner {
          color: white;
          font-weight: bold;
          font-size: 14px;
        }
        
        .event-icon {
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 35px;
          height: 35px;
        }
        
        .event-inner {
          font-size: 16px;
          line-height: 1;
        }
        
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
          padding: 0;
        }
        
        .leaflet-popup-content {
          margin: 0;
          width: 280px !important;
        }
        
        .custom-div-icon {
          background: none;
          border: none;
        }
      `}</style>
      
      <MapContainer
        center={mapCenter}
        zoom={userLocation ? 12 : 6}
        className="h-full w-full z-0"
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds events={events} userLocation={userLocation} />
        
        {/* User location marker */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={divIcon({
              html: '<div style="background: #ef4444; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
              className: 'custom-div-icon',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          >
            <Popup>
              <div className="p-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="font-medium text-sm">Your Location</span>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Event clusters */}
        {eventClusters.map((cluster, index) => (
          <Marker
            key={index}
            position={cluster.position}
            icon={cluster.count > 1 
              ? createClusterIcon(cluster.count)
              : createEventIcon(cluster.events[0].sport)
            }
          >
            <Popup>
              <div className="p-0">
                {cluster.count === 1 ? (
                  // Single event popup
                  <div className="w-full">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 leading-tight">
                            {cluster.events[0].title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            by {cluster.events[0].host.firstName || cluster.events[0].host.email}
                          </p>
                        </div>
                        <Badge className={getStatusColor(getEventStatus(cluster.events[0]))}>
                          {getStatusText(getEventStatus(cluster.events[0]))}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {formatDateForDisplay(cluster.events[0].startTime)}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4" />
                          {cluster.events[0].location}
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Users className="w-4 h-4" />
                          {(cluster.events[0].bookings?.filter(b => b.status === 'accepted').length || 0) + 1} / {cluster.events[0].maxPlayers} players
                        </div>
                        
                        {parseFloat(cluster.events[0].pricePerPerson || '0') > 0 && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <DollarSign className="w-4 h-4" />
                            ${cluster.events[0].pricePerPerson} per person
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        className="w-full" 
                        size="sm"
                        onClick={() => setSelectedEvent(cluster.events[0])}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Multiple events popup
                  <div className="w-full">
                    <div className="p-4">
                      <h3 className="font-semibold text-lg text-gray-900 mb-3">
                        {cluster.count} Events at this location
                      </h3>
                      
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {cluster.events.map((event) => (
                          <Card key={event.id} className="border border-gray-200">
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-medium text-sm text-gray-900 leading-tight">
                                  {event.title}
                                </h4>
                                <Badge className={`${getStatusColor(getEventStatus(event))} text-xs`}>
                                  {getStatusText(getEventStatus(event))}
                                </Badge>
                              </div>
                              
                              <div className="space-y-1 mb-3">
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Calendar className="w-3 h-3" />
                                  {formatDateForDisplay(event.startTime)}
                                </div>
                                
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Users className="w-3 h-3" />
                                  {(event.bookings?.filter(b => b.status === 'accepted').length || 0) + 1} / {event.maxPlayers}
                                </div>
                              </div>
                              
                              <Button 
                                className="w-full" 
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedEvent(event)}
                              >
                                View Details
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      </div>

      {/* Event Details Panel */}
      {selectedEvent && (
        <div className="lg:w-1/3 lg:block w-full absolute lg:relative bottom-0 lg:bottom-auto left-0 right-0 lg:left-auto lg:right-0 bg-white lg:bg-transparent p-4 lg:p-6 shadow-lg lg:shadow-none border-t lg:border-t-0 lg:border-l border-gray-200 max-h-80 lg:max-h-full overflow-y-auto z-[1000]">
          <EventDetails event={selectedEvent} />
        </div>
      )}
    </div>
  );
}