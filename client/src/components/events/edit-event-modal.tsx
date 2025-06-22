import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LocationSearch from "@/components/ui/location-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { EventWithHost } from "@shared/schema";
import { SPORTS, SPORT_CONFIGS, SKILL_LEVELS, GENDER_MIX } from "@/lib/constants";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleLocationChange = (location: string, coordinates?: { lat: number; lng: number }) => {
    form.setValue('location', location);
    if (coordinates) {
      setLocationCoords({ lat: coordinates.lat.toString(), lng: coordinates.lng.toString() });
    }
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
      form.reset({
        title: event.title,
        sport: event.sport,
        skillLevel: event.skillLevel,
        genderMix: event.genderMix,
        startTime: new Date(event.startTime).toISOString().slice(0, 16),
        endTime: new Date(event.endTime).toISOString().slice(0, 16),
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
      return response.json();
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

  const handleSportSelect = (sportId: string) => {
    setSelectedSport(sportId);
    form.setValue('sport', sportId as any);
    form.setValue('sportConfig', {});
  };

  if (!event) return null;

  const sportConfig = SPORT_CONFIGS[selectedSport as keyof typeof SPORT_CONFIGS];

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
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Weekend Basketball Game" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sport</FormLabel>
                    <Select value={field.value} onValueChange={handleSportSelect}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a sport" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPORTS.map((sport) => (
                          <SelectItem key={sport.id} value={sport.id}>
                            {sport.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Time & Date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
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
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
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
                      <Input type="number" min="2" max="22" {...field} />
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
                    <Select value={field.value} onValueChange={field.onChange}>
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

            {/* Price */}
            <FormField
              control={form.control}
              name="pricePerPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price per Person ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="12.00" {...field} />
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