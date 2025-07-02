import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngBounds, divIcon } from 'leaflet';
import { EventWithHost } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, DollarSign, Clock, Trophy } from 'lucide-react';
import { formatDateForDisplay, calculateDuration } from '@/lib/dateUtils';
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
  onJoin?: (eventId: number) => void;
  onOpenChat?: (eventId: number, receiverId?: string) => void;
  onCancel?: (eventId: number) => void;
  onModify?: (eventId: number) => void;
  currentUserId?: string;
  userBookingStatusMap?: Record<number, string>;
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

// Helper functions for event status and actions
function getEventStatus(event: EventWithHost) {
  const now = new Date();
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);

  if (event.status === 'cancelled') return 'cancelled';
  if (now > eventEnd) return 'completed';
  if (now >= eventStart && now <= eventEnd) return 'active';
  return 'upcoming';
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-gray-500 text-white';
    case 'active': return 'bg-green-500 text-white';
    case 'cancelled': return 'bg-red-500 text-white';
    default: return 'bg-blue-500 text-white';
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'active': return 'Live';
    case 'cancelled': return 'Cancelled';
    default: return 'Upcoming';
  }
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

export default function MapView({ 
  events, 
  userLocation, 
  onEventClick, 
  onJoin, 
  onOpenChat, 
  onCancel, 
  onModify, 
  currentUserId,
  userBookingStatusMap = {}
}: MapViewProps) {
  const [detailViewEvent, setDetailViewEvent] = useState<EventWithHost | null>(null);
  const popupRefs = useRef<Map<string, any>>(new Map());

  // Event action handlers
  const handleViewDetails = (event: EventWithHost, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDetailViewEvent(event);
  };

  const handleBackToSummary = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDetailViewEvent(null);
  };

  // Render detailed event view
  const renderDetailedEventView = (event: EventWithHost) => {
    const sport = SPORTS.find(s => s.id === event.sport);
    const sportColor = sport?.color || 'sport-badminton';
    const currentPlayers = event.currentPlayers || 0;
    const isEventFull = currentPlayers >= event.maxPlayers;
    const spotsRemaining = event.maxPlayers - currentPlayers;
    const isHost = currentUserId === event.hostId;
    const userBookingStatus = userBookingStatusMap[event.id];

    return (
      <div className="w-full max-w-md">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900 leading-tight mb-1">
                {event.title}
              </h3>
              <p className="text-sm text-gray-600">
                by {event.host.firstName || event.host.email}
              </p>
            </div>
            <Badge className={getStatusColor(getEventStatus(event))}>
              {getStatusText(getEventStatus(event))}
            </Badge>
          </div>

          {/* Event Details */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>{formatDateForDisplay(event.startTime)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-500" />
              <span>{calculateDuration(new Date(event.startTime), new Date(event.endTime))}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span className="line-clamp-2">{event.location}</span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-gray-500" />
              <span>{currentPlayers} / {event.maxPlayers} players</span>
              {spotsRemaining > 0 && (
                <span className="text-green-600 font-medium">
                  ({spotsRemaining} spots left)
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-gray-500" />
              <span className="capitalize">{event.skillLevel}</span>
            </div>
            
            {parseFloat(event.pricePerPerson) > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span>${event.pricePerPerson} per person</span>
              </div>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {isHost ? (
              <>
                <Button 
                  onClick={() => onModify?.(event.id)}
                  variant="outline"
                  className="flex-1"
                  size="sm"
                >
                  Modify
                </Button>
                <Button 
                  onClick={() => onCancel?.(event.id)}
                  variant="destructive"
                  className="flex-1"
                  size="sm"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {(() => {
                  // Event is full
                  if (isEventFull) {
                    return (
                      <Button disabled className="flex-1" size="sm">
                        Event Full
                      </Button>
                    );
                  }
                  
                  // User has different booking statuses
                  switch (userBookingStatus) {
                    case 'requested':
                      return (
                        <Button disabled className="flex-1 bg-yellow-500" size="sm">
                          Request Sent
                        </Button>
                      );
                    case 'accepted':
                      return (
                        <Button disabled className="flex-1 bg-green-600" size="sm">
                          Accepted
                        </Button>
                      );
                    case 'rejected':
                      return (
                        <Button disabled className="flex-1 bg-red-600" size="sm">
                          Rejected
                        </Button>
                      );
                    case 'cancelled':
                      return (
                        <Button disabled className="flex-1 bg-gray-500" size="sm">
                          Cancelled
                        </Button>
                      );
                    default:
                      // User can join
                      return (
                        <Button 
                          onClick={() => onJoin?.(event.id)}
                          className="flex-1 bg-everest-blue hover:bg-blue-700"
                          size="sm"
                        >
                          Join & Pay
                        </Button>
                      );
                  }
                })()}
                
                {onOpenChat && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onOpenChat(event.id, event.hostId)}
                    className="px-3"
                  >
                    Chat
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Back Button */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={(e) => handleBackToSummary(e)}
            className="w-full mt-3 text-gray-600"
          >
            ← Back to summary
          </Button>
        </div>
      </div>
    );
  };
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

  return (
    <div className="h-full w-full relative">
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
          width: 320px !important;
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
            <Popup closeOnClick={false}>
              <div className="p-0">
                {cluster.count === 1 ? (
                  // Single event popup with conditional detailed view
                  detailViewEvent && detailViewEvent.id === cluster.events[0].id ? (
                    renderDetailedEventView(detailViewEvent)
                  ) : (
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
                          onClick={(e) => handleViewDetails(cluster.events[0], e)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  // Multiple events popup with detailed view support
                  detailViewEvent && cluster.events.some(e => e.id === detailViewEvent.id) ? (
                    renderDetailedEventView(detailViewEvent)
                  ) : (
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
                                  onClick={(e) => handleViewDetails(event, e)}
                                >
                                  View Details
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}