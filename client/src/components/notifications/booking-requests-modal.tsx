import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Users, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BookingWithEventAndUser } from "@shared/schema";
import { format } from "date-fns";

interface BookingRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: number;
}

export default function BookingRequestsModal({ isOpen, onClose, eventId }: BookingRequestsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get pending bookings for host's events
  const { data: pendingBookings = [], isLoading } = useQuery<BookingWithEventAndUser[]>({
    queryKey: ['/api/pending-bookings'],
    enabled: isOpen,
  });

  // Approve booking mutation
  const approveBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('PUT', `/api/bookings/${bookingId}/status`, {
        status: 'confirmed'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking Approved",
        description: "Player has been added to the event.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve booking.",
        variant: "destructive",
      });
    },
  });

  // Reject booking mutation
  const rejectBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest('PUT', `/api/bookings/${bookingId}/status`, {
        status: 'cancelled'
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking Rejected",
        description: "Player request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pending-bookings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject booking.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Join Requests</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading requests...</p>
            </div>
          ) : pendingBookings.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pending join requests</p>
            </div>
          ) : (
            pendingBookings.map((booking) => (
              <div key={booking.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={booking.user.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {booking.user.firstName?.[0] || booking.user.email?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {booking.user.firstName && booking.user.lastName 
                          ? `${booking.user.firstName} ${booking.user.lastName}`
                          : booking.user.email?.split('@')[0]
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        Requested {booking.createdAt ? format(new Date(booking.createdAt), 'MMM d, h:mm a') : 'recently'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <h4 className="font-medium mb-2">{booking.event.title}</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {format(new Date(booking.event.startTime), 'PPP p')}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      {booking.event.location}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {booking.event.currentPlayers || 0}/{booking.event.maxPlayers} players
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => approveBookingMutation.mutate(booking.id)}
                    disabled={approveBookingMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => rejectBookingMutation.mutate(booking.id)}
                    disabled={rejectBookingMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}