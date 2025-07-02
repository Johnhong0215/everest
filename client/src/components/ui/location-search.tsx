import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, X } from 'lucide-react';

interface LocationSearchProps {
  value: string;
  onChange: (location: string, coordinates?: { lat: number; lng: number }) => void;
  onInputChange?: (location: string) => void;
  placeholder?: string;
  className?: string;
  userLocation?: { lat: number; lng: number } | null;
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
  onInputChange,
  placeholder = "Search location...",
  className = "",
  userLocation
}: LocationSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserLocation, setCurrentUserLocation] = useState(userLocation);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // Check for saved location data on component mount
  useEffect(() => {
    try {
      const savedLocation = localStorage.getItem('userLocation');
      const savedPermission = localStorage.getItem('locationPermission');
      
      if (savedLocation && savedPermission === 'granted') {
        const location = JSON.parse(savedLocation);
        if (location.lat && location.lng) {
          setCurrentUserLocation(location);
        }
      }
    } catch (error) {
      console.warn('Failed to restore saved location in search:', error);
    }
  }, []);

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get user's current location
  const getCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      console.error('Geolocation not supported by this browser');
      return;
    }

    // Check if the page is served over HTTPS (required for geolocation in modern browsers)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.error('Geolocation requires HTTPS');
      return;
    }

    setLoading(true);
    
    // Try quick location first
    const tryQuickLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentUserLocation(coords);
          onChange('Current Location', coords);
          setIsOpen(false);
          setLoading(false);
          
          // Save to localStorage for persistence
          try {
            localStorage.setItem('userLocation', JSON.stringify(coords));
            localStorage.setItem('locationPermission', 'granted');
          } catch (error) {
            console.warn('Failed to save location to localStorage:', error);
          }
        },
        (error) => {
          console.log('Quick location failed, trying backup...', error);
          tryBackupLocation();
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
      );
    };

    // Backup with longer timeout
    const tryBackupLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentUserLocation(coords);
          onChange('Current Location', coords);
          setIsOpen(false);
          setLoading(false);
          
          // Save to localStorage for persistence
          try {
            localStorage.setItem('userLocation', JSON.stringify(coords));
            localStorage.setItem('locationPermission', 'granted');
          } catch (error) {
            console.warn('Failed to save location to localStorage:', error);
          }
        },
        (error) => {
          console.error('All location attempts failed:', error);
          setLoading(false);
          
          let errorMessage = "Unable to get location";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location access denied";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location services unavailable";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out";
              break;
          }
          console.warn(errorMessage);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };

    tryQuickLocation();
  };

  // Search for locations using server-side proxy
  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    
    try {
      // Use server-side proxy to avoid CORS issues
      let url = `/api/search-locations?q=${encodeURIComponent(query)}&limit=10`;
      
      if (currentUserLocation) {
        url += `&lat=${currentUserLocation.lat}&lng=${currentUserLocation.lng}`;
        console.log('Searching with user location via server proxy:', currentUserLocation);
      } else {
        console.log('No user location available for proximity search');
      }

      console.log('Making request to server proxy:', url);
      
      const response = await fetch(url);
      
      console.log('Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Server proxy response:', data);
      
      // Sort by distance if user location is available
      let sortedData = data;
      if (currentUserLocation) {
        sortedData = data.map((item: any) => ({
          ...item,
          distance: calculateDistance(
            currentUserLocation.lat,
            currentUserLocation.lng,
            item.lat,
            item.lon
          )
        })).sort((a: any, b: any) => a.distance - b.distance);
      }
      
      setSuggestions(sortedData.slice(0, 8));
      console.log('Search completed, found', sortedData.length, 'suggestions');
    } catch (error) {
      console.error('Location search failed:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Always update parent immediately for UI responsiveness
    onChange(newValue);
    
    // Call the separate input change handler if provided (for additional logic)
    if (onInputChange) {
      onInputChange(newValue);
    }
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    if (newValue.length >= 3) {
      searchTimeout.current = setTimeout(() => {
        searchLocations(newValue);
        setIsOpen(true);
      }, 300);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  // Update current user location when prop changes
  useEffect(() => {
    if (userLocation && !currentUserLocation) {
      setCurrentUserLocation(userLocation);
    }
  }, [userLocation, currentUserLocation]);

  // Sync input value with prop value
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: LocationSuggestion) => {
    const coordinates = {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon)
    };
    
    // Extract a clean location name for display
    const locationParts = suggestion.display_name.split(',');
    const cleanLocation = locationParts.slice(0, 2).join(', ').trim();
    
    // Close dropdown first
    setSuggestions([]);
    setIsOpen(false);
    
    // Call onChange which will update the parent component's state
    onChange(cleanLocation, coordinates);
    
    // Force update the input value after a small delay to ensure React has processed the state update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.value = cleanLocation;
        inputRef.current.blur();
      }
    }, 0);
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
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
            disabled={loading}
            className="h-8 w-8 p-0 hover:bg-gray-100"
            title="Use current location"
          >
            <Navigation className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Searching locations...
            </div>
          )}
          
          {!loading && suggestions.length === 0 && value.length >= 3 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No locations found
            </div>
          )}
          
          {!loading && suggestions.length > 0 && (
            <>
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.place_id || index}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSuggestionSelect(suggestion);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
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
                    {(suggestion as any).distance && (
                      <div className="text-xs text-gray-400 font-medium ml-2 flex-shrink-0">
                        {(suggestion as any).distance.toFixed(1)} mi
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
          
          {!loading && value.length < 3 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Type at least 3 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
}