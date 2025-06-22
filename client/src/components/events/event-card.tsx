import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, Star } from "lucide-react";
import { EventWithHost } from "@shared/schema";
import { SPORTS } from "@/lib/constants";
import { format } from "date-fns";

interface EventCardProps {
  event: EventWithHost;
  onJoin: (eventId: number) => void;
  onOpenChat?: (eventId: number) => void;
}

export default function EventCard({ event, onJoin, onOpenChat }: EventCardProps) {
  const sport = SPORTS.find(s => s.id === event.sport);
  const sportColor = sport?.color || 'sport-badminton';
  
  const formatDateTime = (date: Date) => {
    return format(date, 'PPp');
  };

  const isEventFull = event.currentPlayers >= event.maxPlayers;
  const spotsRemaining = event.maxPlayers - event.currentPlayers;

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
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="text-sm text-gray-600">4.8</span>
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
              {event.currentPlayers} / {event.maxPlayers} players
              {spotsRemaining > 0 && spotsRemaining <= 2 && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} left
                </Badge>
              )}
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
          {isEventFull ? (
            <Button disabled className="flex-1">
              Event Full
            </Button>
          ) : (
            <Button 
              onClick={() => onJoin(event.id)}
              className="flex-1 bg-everest-blue hover:bg-blue-700"
            >
              Join & Pay
            </Button>
          )}
          
          {onOpenChat && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onOpenChat(event.id)}
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
