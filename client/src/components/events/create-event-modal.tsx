import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LocationSearch from "@/components/ui/location-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { insertEventSchema } from "@shared/schema";
import { SPORTS, SPORT_CONFIGS, SKILL_LEVELS, GENDER_MIX } from "@/lib/constants";
import { toLocalDateTimeString, fromLocalDateTimeString } from "@/lib/dateUtils";
import { z } from "zod";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const createEventFormSchema = insertEventSchema.omit({
  hostId: true, // We'll add this in the submit handler
  description: true, // Remove description requirement
}).extend({
  sportConfig: z.record(z.string(), z.any()),
  startTime: z.string(),
  endTime: z.string(),
  maxPlayers: z.coerce.number().min(2).max(22),
  pricePerPerson: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  location: z.string().min(1, "Location is required"),
});

type CreateEventFormData = z.infer<typeof createEventFormSchema>;

export default function CreateEventModal({ isOpen, onClose }: CreateEventModalProps) {
  const [selectedSport, setSelectedSport] = useState<string>('badminton');
  const [locationCoords, setLocationCoords] = useState<{lat: string, lng: string} | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // Get user location for proximity-based search
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation not available:', error);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
      );
    }
  }, []);

  const handleLocationChange = (location: string, coordinates?: { lat: number; lng: number }) => {
    form.setValue('location', location);
    if (coordinates) {
      setLocationCoords({ lat: coordinates.lat.toString(), lng: coordinates.lng.toString() });
    }
  };

  // Function to add one hour to a datetime string
  const addOneHour = (dateString: string) => {
    const date = new Date(fromLocalDateTimeString(dateString));
    date.setHours(date.getHours() + 1);
    return toLocalDateTimeString(date);
  };

  // Calculate default start time (tomorrow, rounded to nearest 5 minutes)
  const getDefaultStartTime = () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const minutes = tomorrow.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    tomorrow.setMinutes(roundedMinutes);
    tomorrow.setSeconds(0);
    tomorrow.setMilliseconds(0);
    return toLocalDateTimeString(tomorrow);
  };

  const getDefaultEndTime = () => {
    const startTime = getDefaultStartTime();
    return addOneHour(startTime);
  };

  const form = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: '',
      sport: 'badminton',
      skillLevel: 'intermediate',
      genderMix: 'mixed',
      startTime: getDefaultStartTime(),
      endTime: getDefaultEndTime(),
      location: '',
      maxPlayers: 4,
      pricePerPerson: '12.00',
      sportConfig: {},
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('Sending data to API:', data);
      const response = await apiRequest('POST', '/api/events', data);
      return response;
    },
    onSuccess: (data) => {
      console.log('Event created successfully:', data);
      toast({
        title: "Event Created",
        description: "Your event has been created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-events'] });
      onClose();
      form.reset();
      setSelectedSport('badminton');
    },
    onError: (error: any) => {
      console.error('Create event error:', error);
      const errorMessage = error.message || "Failed to create event. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const selectedSportData = SPORTS.find(s => s.id === selectedSport);
  const sportConfig = selectedSport ? SPORT_CONFIGS[selectedSport as keyof typeof SPORT_CONFIGS] : null;

  const onSubmit = async (data: CreateEventFormData) => {
    console.log('Form data submitted:', data);
    
    if (!isAuthenticated || !user || typeof user !== 'object' || !('id' in user)) {
      toast({
        title: "Error",
        description: "You must be logged in to create an event",
        variant: "destructive",
      });
      return;
    }

    // Handle "Current Location" by reverse geocoding
    let finalLocation = data.location;
    if (data.location === 'Current Location' && locationCoords) {
      try {
        const response = await fetch(`/api/reverse-geocode?lat=${locationCoords.lat}&lng=${locationCoords.lng}`);
        if (response.ok) {
          const { address } = await response.json();
          finalLocation = address;
        } else {
          // Fallback to coordinates if reverse geocoding fails
          finalLocation = `${parseFloat(locationCoords.lat).toFixed(6)}, ${parseFloat(locationCoords.lng).toFixed(6)}`;
        }
      } catch (error) {
        console.error('Error getting address:', error);
        // Fallback to coordinates if reverse geocoding fails
        finalLocation = `${parseFloat(locationCoords.lat).toFixed(6)}, ${parseFloat(locationCoords.lng).toFixed(6)}`;
      }
    }
    
    // Ensure proper data types and format
    const eventData = {
      ...data,
      location: finalLocation,
      hostId: String((user as any).id), // Add the required hostId field
      maxPlayers: Number(data.maxPlayers),
      startTime: fromLocalDateTimeString(data.startTime),
      endTime: fromLocalDateTimeString(data.endTime),
      sportConfig: data.sportConfig || {},
      currentPlayers: 1, // Host counts as first player
      description: '', // No description field
      latitude: locationCoords?.lat || null,
      longitude: locationCoords?.lng || null,
    };
    
    console.log('Sending to API:', eventData);
    createEventMutation.mutate(eventData as any);
  };

  const handleSportSelect = (sportId: string) => {
    setSelectedSport(sportId);
    form.setValue('sport', sportId as any);
    // Reset sport config when changing sports
    form.setValue('sportConfig', {});
  };

  // Function to round time to nearest 5-minute interval
  const roundToNearestFiveMinutes = (dateString: string) => {
    const date = new Date(dateString);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return toLocalDateTimeString(date);
  };

  // Handle start time change
  const handleStartTimeChange = (value: string) => {
    const roundedStartTime = roundToNearestFiveMinutes(value);
    const endTime = addOneHour(roundedStartTime);
    
    form.setValue('startTime', roundedStartTime);
    form.setValue('endTime', endTime);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="create-event-description">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Create New Event</DialogTitle>
          <DialogDescription id="create-event-description">
            Fill in the details below to create a new sports event for others to join.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              console.log('Form validation failed:', errors);
              toast({
                title: "Form Error",
                description: "Please fill in all required fields",
                variant: "destructive",
              });
            })} 
            className="space-y-6"
          >
            {/* Sport Selection */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Select Sport</Label>
              <div className="grid grid-cols-3 gap-3">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => handleSportSelect(sport.id)}
                    className={`flex flex-col items-center p-4 border-2 rounded-lg transition-colors ${
                      selectedSport === sport.id
                        ? `border-${sport.color} bg-${sport.color} bg-opacity-10`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-8 h-8 bg-${sport.color} rounded-full flex items-center justify-center mb-2`}>
                      <div className="w-5 h-5 text-white">
                        <div className="w-full h-full bg-current rounded-sm" />
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${
                      selectedSport === sport.id ? `text-${sport.color}` : 'text-gray-600'
                    }`}>
                      {sport.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Event Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Evening Doubles Badminton" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />



            {/* Sport-Specific Configuration */}
            {selectedSport && sportConfig && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-700 mb-4">
                  {selectedSportData?.name} Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(sportConfig).map(([key, options]) => (
                    <div key={key}>
                      <Label className="text-sm font-medium mb-2 block capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <Select
                        onValueChange={(value) => {
                          const currentConfig = form.getValues('sportConfig') || {};
                          form.setValue('sportConfig', { ...currentConfig, [key]: value });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${key}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {(options as string[]).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date & Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date & Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <LocationSearch
                      value={field.value}
                      onChange={handleLocationChange}
                      placeholder="Search for venue or address..."
                      userLocation={userLocation}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Players & Settings */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="maxPlayers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Players</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2}
                        max={22}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skillLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill Level</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SKILL_LEVELS.map((level) => (
                          <SelectItem key={level.value} value={level.value}>
                            {level.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="genderMix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender Mix</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GENDER_MIX.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cost */}
            <FormField
              control={form.control}
              name="pricePerPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost per Person</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500">$</span>
                      <Input
                        placeholder="12.00"
                        className="pl-8"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <p className="text-sm text-gray-500">
                    This covers court rental split among players + 5% platform fee
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />



            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-everest-blue hover:bg-blue-700"
                disabled={createEventMutation.isPending}
                onClick={(e) => {
                  console.log('Submit button clicked');
                  console.log('Form state:', form.formState);
                  console.log('Form values:', form.getValues());
                }}
              >
                {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
