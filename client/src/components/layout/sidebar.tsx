import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { MapPin, Filter } from "lucide-react";
import LocationSearch from "@/components/ui/location-search";
import { SPORTS, SKILL_LEVELS, GENDER_MIX } from "@/lib/constants";
import { getTodayString, getTomorrowString, getWeekFromNowString, getMonthFromNowString, isQuickFilterDate } from "@/lib/dateUtils";

interface SidebarProps {
  appliedFilters: {
    sports: string[];
    date: string;
    skillLevels: string[];
    genders: string[];
    location: string;
    radius: number;
    priceMax: number;
  };
  pendingFilters: {
    location: string;
    radius: number;
    priceMax: number;
  };
  onImmediateFilterChange: (key: string, value: any) => void;
  onPendingFilterChange: (key: string, value: any) => void;
  onApplyFilters: () => void;
  onRemoveFilters: () => void;
  hasPendingChanges: boolean;
  className?: string;
}

export default function Sidebar({ 
  appliedFilters, 
  pendingFilters, 
  onImmediateFilterChange, 
  onPendingFilterChange, 
  onApplyFilters, 
  onRemoveFilters,
  hasPendingChanges, 
  className 
}: SidebarProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location for location search proximity
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

  // Handle location change with proximity-based suggestions
  const handleLocationChange = (location: string, coordinates?: { lat: number; lng: number }) => {
    onPendingFilterChange('location', location);
  };

  // Handle sports checkbox changes
  const handleSportToggle = (sport: string, checked: boolean) => {
    const newSports = checked
      ? [...appliedFilters.sports, sport]
      : appliedFilters.sports.filter((s: string) => s !== sport);
    
    onImmediateFilterChange('sports', newSports);
  };

  // Handle skill level checkbox changes
  const handleSkillLevelToggle = (skillLevel: string, checked: boolean) => {
    const newSkillLevels = checked
      ? [...appliedFilters.skillLevels, skillLevel]
      : appliedFilters.skillLevels.filter((s: string) => s !== skillLevel);
    
    onImmediateFilterChange('skillLevels', newSkillLevels);
  };

  // Handle gender checkbox changes
  const handleGenderToggle = (gender: string, checked: boolean) => {
    const newGenders = checked
      ? [...appliedFilters.genders, gender]
      : appliedFilters.genders.filter((g: string) => g !== gender);
    
    onImmediateFilterChange('genders', newGenders);
  };

  // Handle date change - exclusive selection
  const handleDateChange = (dateFilter: string) => {
    // If clicking the same filter, deselect it
    const newDateFilter = appliedFilters.date === dateFilter ? '' : dateFilter;
    onImmediateFilterChange('date', newDateFilter);
  };

  // Get date filter identifiers for range filtering
  const getDateFilters = () => {
    return {
      today: 'today',
      tomorrow: 'tomorrow',
      week: 'week',
      month: 'month'
    };
  };

  const dateFilters = getDateFilters();

  // Check if the current date filter is a custom date (not a quick filter)
  const isCustomDate = (dateValue: string) => {
    // Check if it's one of the text-based quick filters
    const quickFilterTexts = ['today', 'tomorrow', 'week', 'month'];
    return dateValue && !quickFilterTexts.includes(dateValue);
  };

  // Check if any filters are currently active
  const hasActiveFilters = 
    appliedFilters.sports.length > 0 ||
    appliedFilters.date !== '' ||
    appliedFilters.skillLevels.length > 0 ||
    appliedFilters.genders.length > 0 ||
    appliedFilters.location !== '' ||
    appliedFilters.radius !== 5 ||
    appliedFilters.priceMax !== 100;

  // Sport colors for visual consistency
  const getSportColor = (sportId: string) => {
    const colorMap: { [key: string]: string } = {
      'badminton': 'text-green-600',
      'basketball': 'text-orange-600',
      'soccer': 'text-green-700',
      'tennis': 'text-purple-600',
      'volleyball': 'text-red-600',
      'tabletennis': 'text-yellow-600'
    };
    return colorMap[sportId] || 'text-gray-600';
  };

  return (
    <div className={`h-full overflow-y-auto ${className}`}>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Filters</h2>
        </div>

        {/* Sports - Checkbox List */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Sports</Label>
          <div className="space-y-2">
            {SPORTS.map((sport) => (
              <div key={sport.id} className="flex items-center space-x-3">
                <Checkbox
                  id={`sport-${sport.id}`}
                  checked={appliedFilters.sports.includes(sport.id)}
                  onCheckedChange={(checked) => handleSportToggle(sport.id, checked === true)}
                />
                <label
                  htmlFor={`sport-${sport.id}`}
                  className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer ${getSportColor(sport.id)}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${sport.color === 'sport-badminton' ? 'bg-green-500' : 
                      sport.color === 'sport-basketball' ? 'bg-orange-500' :
                      sport.color === 'sport-soccer' ? 'bg-green-600' :
                      sport.color === 'sport-tennis' ? 'bg-purple-500' :
                      sport.color === 'sport-volleyball' ? 'bg-red-500' :
                      sport.color === 'sport-tabletennis' ? 'bg-yellow-500' : 'bg-gray-500'}`}></div>
                    {sport.name}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Date - Quick Filters + Custom Date */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Date</Label>
          
          {/* Quick Date Filters */}
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="date-today"
                checked={appliedFilters.date === dateFilters.today}
                onCheckedChange={() => handleDateChange(dateFilters.today)}
              />
              <label
                htmlFor="date-today"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Today
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="date-tomorrow"
                checked={appliedFilters.date === dateFilters.tomorrow}
                onCheckedChange={() => handleDateChange(dateFilters.tomorrow)}
              />
              <label
                htmlFor="date-tomorrow"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Tomorrow
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="date-week"
                checked={appliedFilters.date === dateFilters.week}
                onCheckedChange={() => handleDateChange(dateFilters.week)}
              />
              <label
                htmlFor="date-week"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                This Week
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="date-month"
                checked={appliedFilters.date === dateFilters.month}
                onCheckedChange={() => handleDateChange(dateFilters.month)}
              />
              <label
                htmlFor="date-month"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                This Month
              </label>
            </div>
          </div>

          {/* Custom Date Input */}
          <div className="mt-3">
            <Label htmlFor="custom-date" className="text-sm text-gray-600">Or select specific date:</Label>
            <Input
              id="custom-date"
              type="date"
              value={isCustomDate(appliedFilters.date) ? appliedFilters.date : ''}
              onChange={(e) => handleDateChange(e.target.value)}
              className="mt-1"
            />
            {/* Show selected custom date */}
            {isCustomDate(appliedFilters.date) && (
              <div className="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Selected: {(() => {
                  try {
                    const dateStr = appliedFilters.date.includes('T') ? appliedFilters.date : appliedFilters.date + 'T00:00:00';
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) {
                      return appliedFilters.date; // Fallback to raw value if invalid
                    }
                    return date.toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                  } catch {
                    return appliedFilters.date; // Fallback to raw value if error
                  }
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Skill Levels - Checkbox List */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Skill Level</Label>
          <div className="space-y-2">
            {SKILL_LEVELS.map((level) => (
              <div key={level.value} className="flex items-center space-x-3">
                <Checkbox
                  id={`skill-${level.value}`}
                  checked={appliedFilters.skillLevels.includes(level.value)}
                  onCheckedChange={(checked) => handleSkillLevelToggle(level.value, checked === true)}
                />
                <label
                  htmlFor={`skill-${level.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {level.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Gender - Checkbox List */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Gender</Label>
          <div className="space-y-2">
            {GENDER_MIX.map((gender) => (
              <div key={gender.value} className="flex items-center space-x-3">
                <Checkbox
                  id={`gender-${gender.value}`}
                  checked={appliedFilters.genders.includes(gender.value)}
                  onCheckedChange={(checked) => handleGenderToggle(gender.value, checked === true)}
                />
                <label
                  htmlFor={`gender-${gender.value}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {gender.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Location - Proximity-based suggestions */}
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

        {/* Dynamic Filter Button */}
        {hasPendingChanges ? (
          <Button
            onClick={onApplyFilters}
            className="w-full bg-everest-blue hover:bg-blue-700 text-white transition-colors"
            size="lg"
          >
            Apply Filters
          </Button>
        ) : hasActiveFilters ? (
          <Button
            onClick={onRemoveFilters}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            Remove Filters
          </Button>
        ) : (
          <Button
            className="w-full bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 transition-colors"
            size="lg"
            disabled
          >
            Apply Filters
          </Button>
        )}
      </div>
    </div>
  );
}