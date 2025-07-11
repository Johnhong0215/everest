import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MapPin, Users, Star, MessageCircle, Edit, X, CheckCircle, Clock, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { EventWithHost, BookingWithEventAndUser } from "@shared/schema";
import { SPORTS } from "@/lib/constants";
import { format } from "date-fns";

interface MyBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: (eventId: number, receiverId?: string) => void;
}

interface Earnings {
  total: number;
  thisMonth: number;
  pending: number;
  nextPayoutDate: Date | null;
}

export default function MyBookingsModal({ isOpen, onClose, onOpenChat }: MyBookingsModalProps) {
  const [activeTab, setActiveTab] = useState("hosting");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch hosted events
  const { data: allHostedEvents = [], isLoading: hostingLoading } = useQuery<EventWithHost[]>({
    queryKey: ['/api/my-events'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Filter hosted events based on active/past toggle
  const hostedEvents = allHostedEvents.filter(event => {
    const eventDate = new Date(event.startTime);
    const now = new Date();
    const isActive = eventDate >= now;
    
    return showActiveOnly ? isActive : !isActive;
  });

  // Fetch joined bookings
  const { data: allJoinedBookings = [], isLoading: bookingsLoading } = useQuery<BookingWithEventAndUser[]>({
    queryKey: ['/api/my-bookings'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Filter bookings based on active/past toggle
  const joinedBookings = allJoinedBookings.filter(booking => {
    const eventDate = new Date(booking.event.startTime);
    const now = new Date();
    const isActive = eventDate >= now;
    
    return showActiveOnly ? isActive : !isActive;
  });

  // Fetch earnings
  const { data: earnings, isLoading: earningsLoading } = useQuery<Earnings>({
    queryKey: ['/api/my-earnings'],
    enabled: isAuthenticated && activeTab === "hosting",
    retry: false,
  });

  // Cancel event mutation
  const cancelEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return await apiRequest('DELETE', `/api/events/${eventId}`);
    },
    onSuccess: () => {
      toast({
        title: "Event Cancelled",
        description: "The event has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/my-events'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to cancel event. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('DELETE', `/api/bookings/${bookingId}`, {});
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getEventStatus = (event: EventWithHost) => {
    const now = new Date();
    const eventDate = new Date(event.startTime);
    
    if (event.status === 'cancelled') return { label: 'Cancelled', variant: 'destructive' as const };
    if (event.status === 'completed') return { label: 'Completed', variant: 'default' as const };
    if (eventDate < now) return { label: 'Past Event', variant: 'secondary' as const };
    if ((event.currentPlayers || 1) >= event.maxPlayers) return { label: 'Full', variant: 'default' as const };
    if (event.currentPlayers === 0) return { label: 'Waiting for Players', variant: 'outline' as const };
    return { label: 'Confirmed', variant: 'default' as const };
  };

  const getBookingStatus = (booking: BookingWithEventAndUser) => {
    switch (booking.status) {
      case 'requested': return { label: 'Request Sent', variant: 'outline' as const };
      case 'accepted': return { label: 'Accepted', variant: 'default' as const };
      case 'rejected': return { label: 'Rejected', variant: 'destructive' as const };
      case 'cancelled': return { label: 'Cancelled', variant: 'secondary' as const };
      default: return { label: booking.status || 'Unknown', variant: 'outline' as const };
    }
  };

  const getSportIcon = (sportId: string) => {
    const sport = SPORTS.find(s => s.id === sportId);
    return sport ? (
      <div className={`w-8 h-8 bg-${sport.color} rounded-full flex items-center justify-center`}>
        <div className="w-4 h-4 text-white">
          <div className="w-full h-full bg-current rounded-sm" />
        </div>
      </div>
    ) : null;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">My Bookings</DialogTitle>
          <DialogDescription>
            View your event bookings, earnings, and manage your sports activities.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hosting" className="data-[state=active]:bg-everest-blue data-[state=active]:text-white">
              Hosting
            </TabsTrigger>
            <TabsTrigger value="joined" className="data-[state=active]:bg-everest-blue data-[state=active]:text-white">
              Joined
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hosting" className="space-y-6">
            {/* Earnings Widget */}
            {earnings && (
              <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-blue-100 text-sm">Total Earned</p>
                      <p className="text-2xl font-bold">
                        ${earnings.total.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm">This Month</p>
                      <p className="text-2xl font-bold">
                        ${earnings.thisMonth.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm">Pending</p>
                      <p className="text-2xl font-bold">
                        ${earnings.pending.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-blue-100 text-sm">Next Payout</p>
                      <p className="text-lg font-semibold">
                        {earnings.nextPayoutDate 
                          ? format(new Date(earnings.nextPayoutDate), 'MMM d')
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hosted Events */}
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Your Events</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowActiveOnly(true)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          showActiveOnly
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Active ({allHostedEvents.filter(e => new Date(e.startTime) >= new Date()).length})
                      </button>
                      <button
                        onClick={() => setShowActiveOnly(false)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          !showActiveOnly
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Past ({allHostedEvents.filter(e => new Date(e.startTime) < new Date()).length})
                      </button>
                    </div>
                  </div>
                </div>
                {hostingLoading ? (
                  <div className="p-6">
                    <div className="animate-pulse space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded" />
                      ))}
                    </div>
                  </div>
                ) : hostedEvents.length === 0 ? (
                  <div className="p-6 text-center">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {showActiveOnly ? 'No active events found.' : 'No past events found.'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {showActiveOnly 
                        ? 'Create some events to see them here.' 
                        : 'Your completed events will appear here.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="w-full">
                    <table className="w-full table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-1/4 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Event
                          </th>
                          <th className="w-1/6 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date/Time
                          </th>
                          <th className="w-1/5 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Location
                          </th>
                          <th className="w-1/8 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Players
                          </th>
                          <th className="w-1/8 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="w-1/6 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {hostedEvents.map((event) => {
                          const status = getEventStatus(event);
                          return (
                            <tr key={event.id}>
                              <td className="px-3 py-4 w-1/4">
                                <div className="flex items-center">
                                  {getSportIcon(event.sport)}
                                  <div className="ml-2 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {event.title}
                                    </div>
                                    <div className="text-xs text-gray-500 capitalize">
                                      {event.sport}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-4 w-1/6 text-xs text-gray-900">
                                {format(new Date(event.startTime), 'MMM d')}<br/>
                                {format(new Date(event.startTime), 'h:mm a')}
                              </td>
                              <td className="px-3 py-4 w-1/5 text-xs text-gray-900">
                                <div className="flex items-center">
                                  <MapPin className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0" />
                                  <span className="truncate">{event.location.substring(0, 20)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-4 w-1/8 text-xs text-gray-900">
                                <div className="flex items-center">
                                  <Users className="w-3 h-3 text-gray-400 mr-1" />
                                  {event.currentPlayers || 1} / {event.maxPlayers}
                                </div>
                              </td>
                              <td className="px-3 py-4 w-1/8">
                                <Badge variant={status.variant} className="text-xs">
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="px-3 py-4 w-1/6 text-xs font-medium">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenChat(event.id)}
                                  className="text-everest-blue hover:text-blue-700"
                                >
                                  <MessageCircle className="w-4 h-4 mr-1" />
                                  Chat
                                </Button>
                                {event.status === 'published' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelEventMutation.mutate(event.id)}
                                    disabled={cancelEventMutation.isPending}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="joined" className="space-y-6">
            <Card>
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Your Bookings</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowActiveOnly(true)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          showActiveOnly
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Active ({allJoinedBookings.filter(b => new Date(b.event.startTime) >= new Date()).length})
                      </button>
                      <button
                        onClick={() => setShowActiveOnly(false)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                          !showActiveOnly
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        Past ({allJoinedBookings.filter(b => new Date(b.event.startTime) < new Date()).length})
                      </button>
                    </div>
                  </div>
                </div>
                {bookingsLoading ? (
                  <div className="p-6">
                    <div className="animate-pulse space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded" />
                      ))}
                    </div>
                  </div>
                ) : joinedBookings.length === 0 ? (
                  <div className="p-6 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {showActiveOnly ? 'No active bookings found.' : 'No past bookings found.'}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      {showActiveOnly 
                        ? 'Join some events to see your bookings here.' 
                        : 'Your completed bookings will appear here.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Event
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Host
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date/Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {joinedBookings.map((booking) => {
                          const status = getBookingStatus(booking);
                          return (
                            <tr key={booking.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {getSportIcon(booking.event.sport)}
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900">
                                      {booking.event.title}
                                    </div>
                                    <div className="text-sm text-gray-500 capitalize">
                                      {booking.event.sport}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <Avatar className="w-6 h-6 mr-2">
                                    <AvatarImage src={booking.event.host.profileImageUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {booking.event.host.firstName?.[0] || booking.event.host.email?.[0] || 'H'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-900">
                                      {booking.event.host.firstName && booking.event.host.lastName 
                                        ? `${booking.event.host.firstName} ${booking.event.host.lastName.charAt(0)}.`
                                        : booking.event.host.email?.split('@')[0]
                                      }
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {format(new Date(booking.event.startTime), 'MMM d, yyyy')}<br/>
                                {format(new Date(booking.event.startTime), 'h:mm a')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <div className="flex items-center">
                                  <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                                  ${booking.amountPaid ? parseFloat(booking.amountPaid).toFixed(0) : parseFloat(booking.event.pricePerPerson).toFixed(0)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onOpenChat(booking.event.id, booking.event.hostId)}
                                  className="text-everest-blue hover:text-blue-700"
                                >
                                  <MessageCircle className="w-4 h-4 mr-1" />
                                  Chat
                                </Button>
                                {booking.status === 'accepted' && new Date(booking.event.startTime) > new Date() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => cancelBookingMutation.mutate(booking.id)}
                                    disabled={cancelBookingMutation.isPending}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <X className="w-4 h-4 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
