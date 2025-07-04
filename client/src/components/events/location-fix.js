// Temporary location tracking improvement
// This will be integrated into the main event-grid.tsx

// Enhanced geolocation settings for better reliability
const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000, // 10 seconds timeout
  maximumAge: 5000 // Cache for 5 seconds only for real-time updates
};

// More aggressive location request with fallback
const requestLocationAggressively = (onSuccess, onError) => {
  if (!navigator.geolocation) {
    onError(new Error('Geolocation not supported'));
    return;
  }

  // Try high accuracy first
  navigator.geolocation.getCurrentPosition(
    onSuccess,
    (error) => {
      console.log('High accuracy failed, trying low accuracy...');
      // Fallback to low accuracy
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        onError,
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
      );
    },
    LOCATION_OPTIONS
  );
};

// Start continuous tracking with better options
const startLocationTracking = (setUserLocation, setLocationPermission) => {
  if (!navigator.geolocation) return;

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      console.log('Location updated:', location);
      setUserLocation(location);
      setLocationPermission('granted');
      
      // Save to localStorage
      try {
        localStorage.setItem('userLocation', JSON.stringify(location));
        localStorage.setItem('locationPermission', 'granted');
      } catch (e) {
        console.warn('Failed to save location');
      }
    },
    (error) => {
      console.error('Location tracking error:', error);
      if (error.code === error.PERMISSION_DENIED) {
        setLocationPermission('denied');
      }
    },
    LOCATION_OPTIONS
  );

  return watchId;
};

export { requestLocationAggressively, startLocationTracking, LOCATION_OPTIONS };