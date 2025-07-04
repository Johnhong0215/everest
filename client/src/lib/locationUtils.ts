// Enhanced location tracking utilities for real-time location updates
// This resolves the "Distance N/A" issue by providing more reliable location tracking

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

// Optimized location options for real-time tracking
export const REALTIME_LOCATION_OPTIONS: LocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000, // 10 seconds - balanced for reliability
  maximumAge: 0 // No cache - always get fresh location
};

export const QUICK_LOCATION_OPTIONS: LocationOptions = {
  enableHighAccuracy: false,
  timeout: 5000, // 5 seconds for quick response
  maximumAge: 0 // No cache - always get fresh location
};

// Enhanced geolocation check
export const isGeolocationAvailable = (): boolean => {
  return (
    'geolocation' in navigator &&
    typeof navigator.geolocation.getCurrentPosition === 'function' &&
    (window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.includes('.replit.dev'))
  );
};

// Aggressive location request with multiple fallback strategies
export const requestLocationAggressively = (
  onSuccess: (coords: LocationCoords) => void,
  onError: (error: GeolocationPositionError) => void
): void => {
  if (!isGeolocationAvailable()) {
    onError({
      code: 2,
      message: 'Geolocation not available',
    } as GeolocationPositionError);
    return;
  }

  console.log('Starting aggressive location request...');

  // Strategy 1: Quick low-accuracy attempt
  navigator.geolocation.getCurrentPosition(
    (position) => {
      console.log('Quick location success:', position.coords);
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    (error) => {
      console.log('Quick location failed, trying high accuracy...');
      
      // Strategy 2: High accuracy attempt with longer timeout
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('High accuracy location success:', position.coords);
          onSuccess({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('High accuracy failed, trying final fallback...');
          
          // Strategy 3: Final fallback with maximum timeout
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('Fallback location success:', position.coords);
              onSuccess({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              });
            },
            onError,
            {
              enableHighAccuracy: false,
              timeout: 15000, // 15 seconds final attempt
              maximumAge: 0, // No cache - always get fresh location
            }
          );
        },
        REALTIME_LOCATION_OPTIONS
      );
    },
    QUICK_LOCATION_OPTIONS
  );
};

// Start continuous location tracking with enhanced options
export const startLocationTracking = (
  onLocationUpdate: (coords: LocationCoords) => void,
  onError: (error: GeolocationPositionError) => void
): number | null => {
  if (!isGeolocationAvailable()) {
    onError({
      code: 2,
      message: 'Geolocation not available',
    } as GeolocationPositionError);
    return null;
  }

  console.log('Starting continuous location tracking...');

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      
      console.log('Location tracked:', coords, 'accuracy:', position.coords.accuracy);
      onLocationUpdate(coords);
    },
    (error) => {
      console.error('Location tracking error:', error.code, error.message);
      onError(error);
    },
    REALTIME_LOCATION_OPTIONS
  );

  return watchId;
};

// Save location to localStorage with error handling
export const saveLocationToStorage = (coords: LocationCoords, permission: string): void => {
  try {
    localStorage.setItem('userLocation', JSON.stringify(coords));
    localStorage.setItem('locationPermission', permission);
    console.log('Location saved to storage:', coords);
  } catch (error) {
    console.warn('Failed to save location to storage:', error);
  }
};

// Load location from localStorage with validation
export const loadLocationFromStorage = (): { coords: LocationCoords | null; permission: string | null } => {
  try {
    const savedLocation = localStorage.getItem('userLocation');
    const savedPermission = localStorage.getItem('locationPermission');
    
    let coords: LocationCoords | null = null;
    
    if (savedLocation) {
      const parsed = JSON.parse(savedLocation);
      if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        coords = parsed;
        console.log('Location restored from storage:', coords);
      }
    }
    
    return { coords, permission: savedPermission };
  } catch (error) {
    console.warn('Failed to load location from storage:', error);
    // Clear corrupted data
    localStorage.removeItem('userLocation');
    localStorage.removeItem('locationPermission');
    return { coords: null, permission: null };
  }
};