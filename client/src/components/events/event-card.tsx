import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, Navigation } from "lucide-react";
import { EventWithHost } from "@shared/schema";
import { SPORTS } from "@/lib/constants";
import { formatDateForDisplay } from "@/lib/dateUtils";

interface EventCardProps {
  event: EventWithHost;
  onJoin: (eventId: number) => void;
  onOpenChat?: (eventId: number, receiverId?: string) => void;
  onCancel?: (eventId: number) => void;
  onModify?: (eventId: number) => void;
  currentUserId?: string;
  userLocation?: { lat: number; lng: number } | null;
  userBookingStatus?: 'requested' | 'accepted' | 'rejected' | 'cancelled' | null;
}

export default function EventCard({ event, onJoin, onOpenChat, onCancel, onModify, currentUserId, userLocation, userBookingStatus }: EventCardProps) {
  const sport = SPORTS.find(s => s.id === event.sport);
  const sportColor = sport?.color || 'sport-badminton';
  
  const formatDateTime = (date: Date) => {
    return formatDateForDisplay(date);
  };

  const currentPlayers = event.currentPlayers || 0;
  const isEventFull = currentPlayers >= event.maxPlayers;
  const spotsRemaining = event.maxPlayers - currentPlayers;
  const isHost = currentUserId === event.hostId;

  // Calculate distance if user location is available
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distance = userLocation && event.latitude && event.longitude 
    ? calculateDistance(userLocation.lat, userLocation.lng, parseFloat(event.latitude), parseFloat(event.longitude))
    : null;

  return (
    <Card className="card-hover bg-white border border-gray-200">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 bg-${sportColor} rounded-full flex items-center justify-center`}>
              <div className="w-5 h-5 text-white">
                {/* Sport icon placeholder */}
                <div className="w-full h-full bg-current rounded-sm" />
              </div>
            </div>
            <span className={`text-sm font-medium text-${sportColor}`}>
              {sport?.name || event.sport}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Navigation className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-600">
              {distance ? `${distance.toFixed(1)} mi` : 'Distance N/A'}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {event.title}
        </h3>

        <div className="space-y-2 mb-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{formatDateTime(event.startTime)}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4" />
            <span className="truncate">{event.location}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>
              {event.currentPlayers || 1} / {event.maxPlayers} players
              {spotsRemaining > 0 && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} left
                </Badge>
              )}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-4 h-4 flex items-center justify-center">
              {event.genderMix === 'mens' ? '♂' : event.genderMix === 'womens' ? '♀' : '⚥'}
            </div>
            <span className="capitalize">
              {event.genderMix === 'mens' ? 'Men only' : 
               event.genderMix === 'womens' ? 'Women only' : 
               'Mixed gender'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={event.host.profileImageUrl || undefined} />
              <AvatarFallback>
                {event.host.firstName?.[0] || event.host.email?.[0] || 'H'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {event.host.firstName && event.host.lastName 
                  ? `${event.host.firstName} ${event.host.lastName.charAt(0)}.`
                  : event.host.email?.split('@')[0]
                }
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {event.skillLevel} level
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">
              ${parseFloat(event.pricePerPerson).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500">per person</p>
          </div>
        </div>

        <div className="flex space-x-2">
          {isHost ? (
            <>
              <Button 
                onClick={() => onModify?.(event.id)}
                variant="outline"
                className="flex-1"
              >
                Modify
              </Button>
              <Button 
                onClick={() => onCancel?.(event.id)}
                variant="destructive"
                className="flex-1"
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
                    <Button disabled className="flex-1">
                      Event Full
                    </Button>
                  );
                }
                
                // User has different booking statuses
                switch (userBookingStatus) {
                  case 'requested':
                    return (
                      <Button disabled className="flex-1 bg-yellow-500">
                        Request Sent
                      </Button>
                    );
                  case 'accepted':
                    return (
                      <Button disabled className="flex-1 bg-green-600">
                        Accepted
                      </Button>
                    );
                  case 'rejected':
                    return (
                      <Button disabled className="flex-1 bg-red-600">
                        Rejected
                      </Button>
                    );
                  case 'cancelled':
                    return (
                      <Button disabled className="flex-1 bg-gray-500">
                        Cancelled
                      </Button>
                    );
                  default:
                    // User can join
                    return (
                      <Button 
                        onClick={() => onJoin(event.id)}
                        className="flex-1 bg-everest-blue hover:bg-blue-700"
                      >
                        Join & Pay
                      </Button>
                    );
                }
              })()}
            </>
          )}
          
          {!isHost && onOpenChat && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onOpenChat(event.id, event.hostId)}
              className="px-3"
            >
              Chat
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
