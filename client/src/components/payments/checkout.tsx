import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { EventWithHost } from "@shared/schema";
import { SPORTS } from "@/lib/constants";
import { format } from "date-fns";
import { Calendar, MapPin, Users, DollarSign, Shield, Clock, Info } from "lucide-react";

// Temporarily disabled Stripe for development

interface CheckoutProps {
  eventId: number;
  onClose: () => void;
}

interface CheckoutFormProps {
  event: EventWithHost;
  onClose: () => void;
}

const CheckoutForm = ({ event, onClose }: CheckoutFormProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      // Simulate payment processing for development
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Booking Confirmed",
        description: "Your booking has been confirmed! (Development mode - no payment processed)",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Booking Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const eventPrice = parseFloat(event.pricePerPerson);
  const platformFee = eventPrice * 0.05; // 5% platform fee
  const totalAmount = eventPrice + platformFee;

  const sport = SPORTS.find(s => s.id === event.sport);

  return (
    <div className="space-y-6">
      {/* Event Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-4">
            {sport && (
              <div className={`w-12 h-12 bg-${sport.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                <div className="w-6 h-6 text-white">
                  <div className="w-full h-full bg-current rounded-sm" />
                </div>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {event.title}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="w-4 h-4 mr-2" />
                  {format(new Date(event.startTime), 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-2" />
                  {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="w-4 h-4 mr-2" />
                  {event.location}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="w-4 h-4 mr-2" />
                  {(event.currentPlayers || 0) + 1} / {event.maxPlayers} players
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-2">
                <Badge variant="outline" className="capitalize">
                  {event.skillLevel} level
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {event.genderMix.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Summary */}
      <Card>
        <CardContent className="p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Payment Summary</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Event fee</span>
              <span className="text-gray-900">${eventPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Platform fee (5%)</span>
              <span className="text-gray-900">${platformFee.toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Secure Escrow Payment</p>
                <p className="text-xs mt-1">
                  Your payment is held securely until the event is completed. 
                  Automatic refund if the event is cancelled.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Development Notice */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Development Mode</h4>
              <p className="text-sm text-gray-600 mb-3">
                Payment processing is temporarily disabled. You can still create bookings for testing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isProcessing}
            className="flex-1 bg-everest-blue hover:bg-blue-700"
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Confirming...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>Confirm Booking (${totalAmount.toFixed(2)})</span>
              </div>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default function Checkout({ eventId, onClose }: CheckoutProps) {
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

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery<EventWithHost>({
    queryKey: ['/api/events', eventId],
    enabled: !!eventId && isAuthenticated,
    retry: false,
  });

  const handleClose = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    queryClient.invalidateQueries({ queryKey: ['/api/my-bookings'] });
    onClose();
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Complete Your Booking</DialogTitle>
        </DialogHeader>

        {eventLoading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-4 border-everest-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading event details...</p>
          </div>
        ) : !event ? (
          <div className="py-12 text-center">
            <p className="text-gray-600 mb-4">Event not found or unavailable.</p>
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
          </div>
        ) : (
          <CheckoutForm event={event} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
