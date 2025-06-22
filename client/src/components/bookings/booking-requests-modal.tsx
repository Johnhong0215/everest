import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MapPin, Users, CheckCircle, X, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { BookingWithEventAndUser } from "@shared/schema";
import { SPORTS } from "@/lib/constants";
import { format } from "date-fns";

interface BookingRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookingRequestsModal({ isOpen, onClose }: BookingRequestsModalProps) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending booking requests for events hosted by current user
  const { data: pendingRequests = [], isLoading } = useQuery<BookingWithEventAndUser[]>({
    queryKey: ['/api/pending-bookings'],
    enabled: isAuthenticated && isOpen,
    retry: false,
  });

  // Accept booking mutation
  const acceptBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'accepted' }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to accept booking');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking Accepted",
        description: "The player has been added to your event.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept booking request.",
        variant: "destructive",
      });
    },
  });

  // Reject booking mutation
  const rejectBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected' }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to reject booking');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking Rejected",
        description: "The booking request has been declined.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pending-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject booking request.",
        variant: "destructive",
      });
    },
  });

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Booking Requests</DialogTitle>
          <DialogDescription>
            Review and manage join requests for your events.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Requests</h3>
            <p className="text-gray-500">You don't have any pending booking requests at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <Card key={request.id} className="border border-gray-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Event Info */}
                      <div className="flex items-center mb-4">
                        {getSportIcon(request.event.sport)}
                        <div className="ml-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {request.event.title}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {format(new Date(request.event.startTime), 'MMM d, yyyy h:mm a')}
                            </div>
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {request.event.location}
                            </div>
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {request.event.currentPlayers || 1} / {request.event.maxPlayers} players
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* User Info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={request.user.profileImageUrl || undefined} />
                            <AvatarFallback>
                              {request.user.firstName?.[0] || request.user.email?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {request.user.firstName && request.user.lastName 
                                ? `${request.user.firstName} ${request.user.lastName}`
                                : request.user.email?.split('@')[0]
                              }
                            </p>
                            <p className="text-xs text-gray-500">
                              Requested {request.createdAt ? format(new Date(request.createdAt as string), 'MMM d, h:mm a') : 'Recently'}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => acceptBookingMutation.mutate(request.id)}
                            disabled={acceptBookingMutation.isPending || rejectBookingMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            onClick={() => rejectBookingMutation.mutate(request.id)}
                            disabled={acceptBookingMutation.isPending || rejectBookingMutation.isPending}
                            variant="destructive"
                            size="sm"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>

                      {/* Event Details */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <Badge variant="outline" className="capitalize">
                              {request.event.skillLevel} level
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {request.event.genderMix}
                            </Badge>
                          </div>
                          <div className="text-lg font-bold text-gray-900">
                            ${parseFloat(request.event.pricePerPerson).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}