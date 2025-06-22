import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MapPin, Filter } from "lucide-react";
import { SPORTS, SKILL_LEVELS } from "@/lib/constants";

interface SidebarProps {
  filters: {
    sports: string[];
    date: string;
    skillLevel: string;
    location: string;
    radius: number;
    priceMax: number;
    search: string;
  };
  onFiltersChange: (filters: any) => void;
  className?: string;
}

export default function Sidebar({ filters, onFiltersChange, className }: SidebarProps) {


  const updateFilters = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleSport = (sportId: string) => {
    const newSports = filters.sports.includes(sportId)
      ? filters.sports.filter(s => s !== sportId)
      : [...filters.sports, sportId];
    updateFilters('sports', newSports);
  };

  const FilterContent = () => (
    <div className="p-6 space-y-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Find Your Game</h2>
          
          {/* Sport Filters */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Sports</h3>
            <div className="space-y-2">
              {SPORTS.map((sport) => (
                <div key={sport.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`sport-${sport.id}`}
                    checked={filters.sports.includes(sport.id)}
                    onCheckedChange={() => toggleSport(sport.id)}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <label
                    htmlFor={`sport-${sport.id}`}
                    className="flex items-center space-x-2 cursor-pointer text-sm text-gray-700"
                  >
                    <div className={`w-6 h-6 bg-${sport.color} rounded-full flex items-center justify-center`}>
                      <div className="w-4 h-4 text-white">
                        <div className="w-full h-full bg-current rounded-sm" />
                      </div>
                    </div>
                    <span>{sport.name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Date & Time</h3>
            <Input
              type="date"
              value={filters.date}
              onChange={(e) => updateFilters('date', e.target.value)}
              className="w-full mb-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any duration</SelectItem>
                  <SelectItem value="1-2">1-2 hours</SelectItem>
                  <SelectItem value="2+">2+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Skill Level */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Skill Level</h3>
            <RadioGroup
              value={filters.skillLevel}
              onValueChange={(value) => updateFilters('skillLevel', value)}
            >
              {SKILL_LEVELS.map((level) => (
                <div key={level.value} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={level.value} 
                    id={level.value}
                    className="border-everest-blue data-[state=checked]:bg-everest-blue"
                  />
                  <Label htmlFor={level.value} className="text-sm text-gray-700">
                    {level.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Location */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Location</h3>
            <div className="relative">
              <Input
                placeholder="Enter location or use current"
                value={filters.location}
                onChange={(e) => updateFilters('location', e.target.value)}
                className="pl-10"
              />
              <MapPin className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
            <div className="mt-3">
              <Label className="text-sm text-gray-600">
                Distance: <span className="font-medium">{filters.radius} miles</span>
              </Label>
              <Slider
                value={[filters.radius]}
                onValueChange={(value) => updateFilters('radius', value[0])}
                max={25}
                min={1}
                step={1}
                className="mt-1"
              />
            </div>
          </div>

          {/* Price Range */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Price Range</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">$0</span>
              <Slider
                value={[filters.priceMax]}
                onValueChange={(value) => updateFilters('priceMax', value[0])}
                max={100}
                min={0}
                step={5}
                className="flex-1"
              />
              <span className="text-sm text-gray-600">$100+</span>
            </div>
            <div className="text-center mt-1 text-sm text-gray-600">
              Up to ${filters.priceMax}
            </div>
          </div>
        </div>
    </div>
  );

  return (
    <div className={className}>
      <FilterContent />
    </div>
  );
}
