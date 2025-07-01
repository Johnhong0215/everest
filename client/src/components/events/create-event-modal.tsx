import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { toLocalDateTimeString, fromLocalDateTimeString, roundToNearest5Minutes, addOneHour, calculateDuration, roundDateTimeStringTo5Minutes } from "@/lib/dateUtils";
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
  const [timeValidationError, setTimeValidationError] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // Fetch sports settings from database
  const { data: sportsSettings = {} } = useQuery({
    queryKey: ['/api/sports-settings'],
    enabled: isOpen, // Only fetch when modal is open
  });

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

  const form = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventFormSchema),
    defaultValues: {
      title: '',
      sport: 'badminton',
      skillLevel: 'intermediate',
      genderMix: 'mixed',
      startTime: toLocalDateTimeString(roundToNearest5Minutes(new Date(Date.now() + 24 * 60 * 60 * 1000))),
      endTime: toLocalDateTimeString(addOneHour(roundToNearest5Minutes(new Date(Date.now() + 24 * 60 * 60 * 1000)))),
      location: '',
      maxPlayers: 4,
      pricePerPerson: '12.00',
      sportConfig: {},
    },
  });

  // Helper function to handle start time changes
  const handleStartTimeChange = (newStartTime: string) => {
    if (!newStartTime) return;
    
    // Parse the datetime-local input value
    const inputDate = new Date(newStartTime);
    
    // Round to nearest 5 minutes
    const minutes = inputDate.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    inputDate.setMinutes(roundedMinutes, 0, 0);
    
    const roundedStartTime = toLocalDateTimeString(inputDate);
    form.setValue('startTime', roundedStartTime);
    
    // Automatically set end time to 1 hour after start time
    const endDate = addOneHour(inputDate);
    form.setValue('endTime', toLocalDateTimeString(endDate));
  };

  // Helper function to handle end time changes
  const handleEndTimeChange = (newEndTime: string) => {
    if (!newEndTime) return;
    
    // Parse the datetime-local input value and round to 5 minutes
    const inputDate = new Date(newEndTime);
    const minutes = inputDate.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    inputDate.setMinutes(roundedMinutes, 0, 0);
    
    const roundedEndTime = toLocalDateTimeString(inputDate);
    const startTime = form.getValues('startTime');
    
    if (startTime) {
      const startDate = new Date(startTime);
      
      // Ensure end time is after start time
      if (inputDate <= startDate) {
        const newEndDate = addOneHour(startDate);
        form.setValue('endTime', toLocalDateTimeString(newEndDate));
        setTimeValidationError("End time must be after start time. Set to 1 hour after start time.");
        setTimeout(() => setTimeValidationError(''), 3000);
        return;
      }
      
      // Ensure end time is within 4 hours of start time
      const maxEndDate = new Date(startDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours
      if (inputDate > maxEndDate) {
        form.setValue('endTime', toLocalDateTimeString(maxEndDate));
        setTimeValidationError("End time cannot be more than 4 hours after start time. Set to maximum 4 hours.");
        setTimeout(() => setTimeValidationError(''), 3000);
        return;
      }
    }
    
    setTimeValidationError('');
    form.setValue('endTime', roundedEndTime);
  };

  // Calculate duration for display
  const getDuration = () => {
    const startTime = form.watch('startTime');
    const endTime = form.watch('endTime');
    
    if (startTime && endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      
      if (endDate > startDate) {
        return calculateDuration(startDate, endDate);
      }
    }
    
    return '';
  };

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

  // Watch for form sport changes to keep selectedSport in sync
  const formSport = form.watch('sport');
  
  // Keep selectedSport in sync with form
  useEffect(() => {
    if (formSport && formSport !== selectedSport) {
      setSelectedSport(formSport);
    }
  }, [formSport, selectedSport]);

  const selectedSportData = SPORTS.find(s => s.id === selectedSport);
  const sportConfig = selectedSport && sportsSettings ? (sportsSettings as any)[selectedSport] : null;
  
  // Debug logging
  console.log('selectedSport:', selectedSport);
  console.log('formSport:', formSport);
  console.log('sportsSettings:', sportsSettings);
  console.log('sportConfig:', sportConfig);

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
            {selectedSport && sportConfig && Object.keys(sportConfig).length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {selectedSportData?.name} Settings
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(sportConfig).map(([key, options]) => {
                    const currentConfig = form.watch('sportConfig') || {};
                    const currentValue = currentConfig[key] || '';
                    
                    console.log(`Rendering ${key} with options:`, options, 'isArray:', Array.isArray(options));
                    
                    return (
                      <div key={`${selectedSport}-${key}`}>
                        <Label className="text-sm font-medium mb-2 block capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                        <select
                          value={currentValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            console.log(`Setting ${key} to ${value}`);
                            const updatedConfig = { ...currentConfig, [key]: value };
                            form.setValue('sportConfig', updatedConfig);
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Choose {key.replace(/([A-Z])/g, ' $1').trim()}</option>
                          {Array.isArray(options) ? options.map((option, index) => {
                            console.log(`Rendering option ${index}:`, option);
                            return (
                              <option key={`${key}-${option}-${index}`} value={option}>
                                {option}
                              </option>
                            );
                          }) : (
                            <option value="" disabled>No options available (not array: {typeof options})</option>
                          )}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={field.value ? field.value.split('T')[0] : ''}
                            onChange={(e) => {
                              const date = e.target.value;
                              const time = field.value ? field.value.split('T')[1] : '14:00';
                              handleStartTimeChange(`${date}T${time}`);
                            }}
                            min={new Date().toISOString().split('T')[0]}
                            className="flex-1"
                          />
                          <select
                            value={field.value ? field.value.split('T')[1] : '14:00'}
                            onChange={(e) => {
                              const date = field.value ? field.value.split('T')[0] : new Date().toISOString().split('T')[0];
                              handleStartTimeChange(`${date}T${e.target.value}`);
                            }}
                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {Array.from({ length: 144 }, (_, i) => {
                              // 6 AM to 11:55 PM (18 hours * 12 intervals = 216, but let's do 6 AM to 11:55 PM)
                              const totalMinutes = 360 + (i * 5); // Start at 6:00 AM (360 minutes)
                              const hours24 = Math.floor(totalMinutes / 60);
                              const minutes = totalMinutes % 60;
                              
                              if (hours24 >= 24) return null; // Don't go past midnight
                              
                              // Convert to 12-hour format
                              const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
                              const ampm = hours24 < 12 ? 'AM' : 'PM';
                              const time24 = `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                              const displayTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                              
                              return (
                                <option key={time24} value={time24}>
                                  {displayTime}
                                </option>
                              );
                            }).filter(Boolean)}
                          </select>
                        </div>
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
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={field.value ? field.value.split('T')[0] : ''}
                            onChange={(e) => {
                              const date = e.target.value;
                              const time = field.value ? field.value.split('T')[1] : '15:00';
                              handleEndTimeChange(`${date}T${time}`);
                            }}
                            min={new Date().toISOString().split('T')[0]}
                            className="flex-1"
                          />
                          <select
                            value={field.value ? field.value.split('T')[1] : '15:00'}
                            onChange={(e) => {
                              const date = field.value ? field.value.split('T')[0] : new Date().toISOString().split('T')[0];
                              handleEndTimeChange(`${date}T${e.target.value}`);
                            }}
                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {Array.from({ length: 144 }, (_, i) => {
                              // 6 AM to 11:55 PM
                              const totalMinutes = 360 + (i * 5); // Start at 6:00 AM (360 minutes)
                              const hours24 = Math.floor(totalMinutes / 60);
                              const minutes = totalMinutes % 60;
                              
                              if (hours24 >= 24) return null; // Don't go past midnight
                              
                              // Convert to 12-hour format
                              const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
                              const ampm = hours24 < 12 ? 'AM' : 'PM';
                              const time24 = `${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                              const displayTime = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                              
                              return (
                                <option key={time24} value={time24}>
                                  {displayTime}
                                </option>
                              );
                            }).filter(Boolean)}
                          </select>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Duration Display */}
              {getDuration() && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <span className="text-sm font-medium text-blue-800">
                      Event Duration: {getDuration()}
                    </span>
                  </div>
                </div>
              )}

              {/* Time Validation Error */}
              {timeValidationError && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-1 bg-white rounded-full" />
                    </div>
                    <span className="text-sm font-medium text-red-800">
                      {timeValidationError}
                    </span>
                  </div>
                </div>
              )}
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
