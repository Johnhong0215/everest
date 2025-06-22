import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, X } from 'lucide-react';

interface LocationSearchProps {
  value: string;
  onChange: (location: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
}

export default function LocationSearch({ 
  value, 
  onChange, 
  placeholder = "Search location...",
  className = ""
}: LocationSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Get user's current location
  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(coords);
          onChange('Current Location', coords);
          setIsOpen(false);
        },
        (error) => {
          console.error('Error getting location:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  };

  // Search for locations using Nominatim API
  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(query)}&countrycodes=us&addressdetails=1&dedupe=1`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      
      const data = await response.json();
      console.log('Location search results:', data);
      
      // Filter and format results for better display
      const filteredData = data.filter((item: any) => 
        item.display_name && item.lat && item.lon
      ).map((item: any) => ({
        ...item,
        place_id: item.place_id || item.osm_id || Math.random().toString()
      }));
      
      setSuggestions(filteredData);
      setIsOpen(true);
    } catch (error) {
      console.error('Error searching locations:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    // Only search and show dropdown if value has meaningful length
    if (newValue.length >= 3) {
      searchTimeout.current = setTimeout(() => {
        searchLocations(newValue);
      }, 300); // Reduced delay back to 300ms for better UX
      setIsOpen(true);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    const coordinates = {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon)
    };
    
    // Extract a cleaner location name for display
    const locationParts = suggestion.display_name.split(',');
    const cleanLocation = locationParts.slice(0, 2).join(', ').trim();
    
    onChange(cleanLocation, coordinates);
    setSuggestions([]);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Clear search
  const clearSearch = () => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const container = inputRef.current?.parentElement;
      if (container && !container.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pl-10 pr-20"
        />
        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={getCurrentLocation}
            className="h-8 w-8 p-0 hover:bg-gray-100"
            title="Use current location"
          >
            <Navigation className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Searching locations...</span>
            </div>
          )}
          
          {!loading && suggestions.length === 0 && value.length >= 3 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No locations found for "{value}"
            </div>
          )}
          
          {!loading && suggestions.length > 0 && (
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.place_id || index}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSuggestionSelect(suggestion);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors duration-150"
                >
                  <div className="flex items-start space-x-3">
                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {suggestion.display_name.split(',').slice(0, 2).join(', ')}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">
                        {suggestion.display_name.split(',').slice(2).join(', ')}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {!loading && value.length < 3 && value.length > 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Type at least 3 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
}