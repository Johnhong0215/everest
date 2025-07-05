import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LocationSearch from "@/components/ui/location-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EventWithHost } from "@shared/schema";
import { SPORTS, SPORT_CONFIGS, SKILL_LEVELS, GENDER_MIX } from "@/lib/constants";
import { toLocalDateTimeString, fromLocalDateTimeString, addOneHourWithDayRollover, calculateDuration } from "@/lib/dateUtils";
import { z } from "zod";

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventWithHost | null;
}

const editEventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  sport: z.string(),
  skillLevel: z.string(),
  genderMix: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string().min(1, "Location is required"),
  maxPlayers: z.coerce.number().min(2).max(22),
  pricePerPerson: z.string().min(1),
  sportConfig: z.record(z.string(), z.any()),
});

type EditEventFormData = z.infer<typeof editEventFormSchema>;

export default function EditEventModal({ isOpen, onClose, event }: EditEventModalProps) {
  const [selectedSport, setSelectedSport] = useState<string>('badminton');
  const [locationCoords, setLocationCoords] = useState<{lat: string, lng: string} | null>(null);
  const [timeValidationError, setTimeValidationError] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sports settings
  const { data: sportsSettings } = useQuery({
    queryKey: ['/api/sports-settings'],
    enabled: isOpen,
  });

  const handleLocationChange = (location: string, coordinates?: { lat: number; lng: number }) => {
    form.setValue('location', location);
    if (coordinates) {
      setLocationCoords({ lat: coordinates.lat.toString(), lng: coordinates.lng.toString() });
    }
  };

  const handleSportSelect = (sportId: string) => {
    setSelectedSport(sportId);
    form.setValue('sport', sportId as any);
    form.setValue('sportConfig', {});
  };

  // Helper function to handle start time changes
  const handleStartTimeChange = (newStartTime: string) => {
    if (!newStartTime) return;
    
    // Parse the datetime-local input value and round to 15 minutes
    const inputDate = new Date(newStartTime);
    const minutes = inputDate.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    
    if (roundedMinutes === 60) {
      inputDate.setHours(inputDate.getHours() + 1);
      inputDate.setMinutes(0, 0, 0);
    } else {
      inputDate.setMinutes(roundedMinutes, 0, 0);
    }
    
    const roundedStartTime = toLocalDateTimeString(inputDate);
    setTimeValidationError('');
    form.setValue('startTime', roundedStartTime);
    
    // Automatically set end time to 1 hour after start time (handles day rollover)
    const endDate = addOneHourWithDayRollover(inputDate);
    form.setValue('endTime', toLocalDateTimeString(endDate));
  };

  // Helper function to handle end time changes
  const handleEndTimeChange = (newEndTime: string) => {
    if (!newEndTime) return;
    
    // Parse the datetime-local input value and round to 15 minutes
    const inputDate = new Date(newEndTime);
    const minutes = inputDate.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    
    if (roundedMinutes === 60) {
      inputDate.setHours(inputDate.getHours() + 1);
      inputDate.setMinutes(0, 0, 0);
    } else {
      inputDate.setMinutes(roundedMinutes, 0, 0);
    }
    
    const roundedEndTime = toLocalDateTimeString(inputDate);
    const startTime = form.getValues('startTime');
    
    if (startTime) {
      const startDate = new Date(startTime);
      
      // Ensure end time is after start time
      if (inputDate <= startDate) {
        const newEndDate = addOneHourWithDayRollover(startDate);
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

  const form = useForm<EditEventFormData>({
    resolver: zodResolver(editEventFormSchema),
    defaultValues: {
      title: '',
      sport: 'badminton',
      skillLevel: 'intermediate',
      genderMix: 'mixed',
      startTime: '',
      endTime: '',
      location: '',
      maxPlayers: 4,
      pricePerPerson: '12.00',
      sportConfig: {},
    },
  });

  // Update form when event changes
  useEffect(() => {
    if (event && isOpen) {
      setSelectedSport(event.sport);
      
      // Convert event times to local timezone for form input
      const startDateTime = new Date(event.startTime);
      const endDateTime = new Date(event.endTime);
      
      // Use toLocalDateTimeString to format properly for the form
      const startTimeString = toLocalDateTimeString(startDateTime);
      const endTimeString = toLocalDateTimeString(endDateTime);
      
      console.log('Setting form with event times:', {
        originalStart: event.startTime,
        originalEnd: event.endTime,
        formattedStart: startTimeString,
        formattedEnd: endTimeString
      });
      
      form.reset({
        title: event.title,
        sport: event.sport,
        skillLevel: event.skillLevel,
        genderMix: event.genderMix,
        startTime: startTimeString,
        endTime: endTimeString,
        location: event.location,
        maxPlayers: event.maxPlayers,
        pricePerPerson: event.pricePerPerson,
        sportConfig: event.sportConfig || {},
      });
      if (event.latitude && event.longitude) {
        setLocationCoords({ lat: event.latitude, lng: event.longitude });
      }
    }
  }, [event, isOpen, form]);

  const editEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', `/api/events/${event?.id}`, data);
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Event Updated",
        description: "Your event has been updated successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/my-events'] });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditEventFormData) => {
    if (!event) return;

    const eventData = {
      ...data,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      sportConfig: data.sportConfig || {},
      latitude: locationCoords?.lat || event.latitude,
      longitude: locationCoords?.lng || event.longitude,
    };
    
    editEventMutation.mutate(eventData);
  };

  if (!event) return null;

  const selectedSportData = SPORTS.find(s => s.id === selectedSport);
  const sportConfig = selectedSport && sportsSettings ? (sportsSettings as any)[selectedSport] : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-event-description">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit Event</DialogTitle>
          <DialogDescription id="edit-event-description">
            Update your event details below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    
                    return (
                      <div key={`${selectedSport}-${key}`}>
                        <Label className="text-sm font-medium mb-2 block capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                        <select
                          value={currentValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            const updatedConfig = { ...currentConfig, [key]: value };
                            form.setValue('sportConfig', updatedConfig);
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Choose {key.replace(/([A-Z])/g, ' $1').trim()}</option>
                          {Array.isArray(options) ? options.map((option, index) => (
                            <option key={index} value={option}>
                              {option}
                            </option>
                          )) : null}
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
                            {Array.from({ length: 72 }, (_, i) => {
                              const totalMinutes = 360 + (i * 15);
                              const hours24 = Math.floor(totalMinutes / 60);
                              const minutes = totalMinutes % 60;
                              
                              if (hours24 >= 24) return null;
                              
                              const now = new Date();
                              const minTime = new Date(now.getTime() + 5 * 60 * 1000);
                              const selectedDate = field.value ? field.value.split('T')[0] : '';
                              const today = now.toISOString().split('T')[0];
                              
                              if (selectedDate === today) {
                                const currentTime = new Date(`${today}T${hours24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                                if (currentTime < minTime) return null;
                              }
                              
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
                            {Array.from({ length: 72 }, (_, i) => {
                              const totalMinutes = 360 + (i * 15);
                              const hours24 = Math.floor(totalMinutes / 60);
                              const minutes = totalMinutes % 60;
                              
                              if (hours24 >= 24) return null;
                              
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
                      <div className="w-2 h-1 bg-white rounded-full" />
                    </div>
                    <span className="text-sm font-medium text-blue-800">
                      Duration: {getDuration()}
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
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Choose skill level</option>
                        {SKILL_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
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
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Choose gender mix</option>
                        {GENDER_MIX.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Price */}
            <FormField
              control={form.control}
              name="pricePerPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price per Person ($)</FormLabel>
                  <FormControl>
                    <Input placeholder="12.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editEventMutation.isPending}
                className="bg-everest-blue hover:bg-blue-700"
              >
                {editEventMutation.isPending ? 'Updating...' : 'Update Event'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}