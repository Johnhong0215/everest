import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MapPin, Filter } from "lucide-react";
import LocationSearch from "@/components/ui/location-search";
import { SPORTS, SKILL_LEVELS } from "@/lib/constants";

interface SidebarProps {
  appliedFilters: {
    sports: string[];
    date: string;
    skillLevel: string;
    location: string;
    radius: number;
    priceMax: number;
    search: string;
  };
  pendingFilters: {
    location: string;
    radius: number;
    priceMax: number;
    search: string;
  };
  onImmediateFilterChange: (key: string, value: any) => void;
  onPendingFilterChange: (key: string, value: any) => void;
  onApplyFilters: () => void;
  hasPendingChanges: boolean;
  className?: string;
}

export default function Sidebar({ 
  appliedFilters, 
  pendingFilters, 
  onImmediateFilterChange, 
  onPendingFilterChange, 
  onApplyFilters, 
  hasPendingChanges, 
  className 
}: SidebarProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location for location search
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Failed to get user location:', error);
        }
      );
    }
  }, []);

  // Handle location change (same as CreateEventModal)
  const handleLocationChange = (location: string, coordinates?: { lat: number; lng: number }) => {
    onPendingFilterChange('location', location);
  };

  // Handle sports filter change (immediate)
  const handleSportToggle = (sport: string) => {
    const newSports = appliedFilters.sports.includes(sport)
      ? appliedFilters.sports.filter((s: string) => s !== sport)
      : [...appliedFilters.sports, sport];
    
    onImmediateFilterChange('sports', newSports);
  };

  // Handle other immediate filter changes
  const handleDateChange = (date: string) => {
    onImmediateFilterChange('date', date);
  };

  const handleSkillLevelChange = (skillLevel: string) => {
    onImmediateFilterChange('skillLevel', skillLevel);
  };

  return (
    <div className={`h-full overflow-y-auto ${className}`}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <Label htmlFor="search">Search Events</Label>
          <Input
            id="search"
            placeholder="Search by title, description..."
            value={pendingFilters.search}
            onChange={(e) => onPendingFilterChange('search', e.target.value)}
          />
        </div>

        {/* Sports */}
        <div className="space-y-3">
          <Label>Sports</Label>
          <div className="flex flex-wrap gap-2">
            {SPORTS.map((sport) => (
              <Badge
                key={sport.id}
                variant={appliedFilters.sports.includes(sport.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => handleSportToggle(sport.id)}
              >
                {sport.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={appliedFilters.date}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>

        {/* Skill Level */}
        <div className="space-y-2">
          <Label>Skill Level</Label>
          <Select value={appliedFilters.skillLevel} onValueChange={handleSkillLevelChange}>
            <SelectTrigger>
              <SelectValue placeholder="Any skill level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any skill level</SelectItem>
              {SKILL_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Location */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Location
          </Label>
          <LocationSearch
            value={pendingFilters.location}
            onChange={handleLocationChange}
            placeholder="Search for venue or address..."
            userLocation={userLocation}
          />
        </div>

        {/* Distance */}
        <div className="space-y-3">
          <Label>Distance: {pendingFilters.radius} km</Label>
          <Slider
            value={[pendingFilters.radius]}
            onValueChange={(value) => onPendingFilterChange('radius', value[0])}
            max={50}
            min={1}
            step={1}
            className="w-full"
          />
        </div>

        {/* Price Range */}
        <div className="space-y-3">
          <Label>Max Price: ${pendingFilters.priceMax}</Label>
          <Slider
            value={[pendingFilters.priceMax]}
            onValueChange={(value) => onPendingFilterChange('priceMax', value[0])}
            max={200}
            min={0}
            step={5}
            className="w-full"
          />
        </div>

        {/* Apply Button */}
        {hasPendingChanges && (
          <Button
            onClick={onApplyFilters}
            className="w-full"
            size="lg"
          >
            Apply Filters
          </Button>
        )}
      </div>
    </div>
  );
}