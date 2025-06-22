import React, { useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { EventWithHost } from '@shared/schema';

interface SimpleMapProps {
  events: EventWithHost[];
  userLocation?: { lat: number; lng: number } | null;
  selectedEvent?: EventWithHost | null;
  onEventSelect?: (event: EventWithHost) => void;
  className?: string;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function SimpleMap({ 
  events, 
  userLocation, 
  selectedEvent, 
  onEventSelect,
  className = "h-96 w-full"
}: SimpleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current) return;

    // Load Leaflet CSS and JS
    const loadLeaflet = () => {
      // Check if Leaflet is already loaded
      if (window.L) {
        initMap();
        return;
      }

      // Load Leaflet CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      // Load Leaflet JS
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    };

    const initMap = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Default to San Francisco if no location provided
      const defaultLat = userLocation?.lat || 37.7749;
      const defaultLng = userLocation?.lng || -122.4194;

      const map = window.L.map(mapRef.current).setView([defaultLat, defaultLng], 12);

      // Add OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add user location marker if available
      if (userLocation) {
        const userIcon = window.L.divIcon({
          html: `<div style="background: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
          className: 'user-location-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        window.L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup('Your Location');
      }

      // Add event markers
      updateEventMarkers();
    };

    const updateEventMarkers = () => {
      if (!mapInstanceRef.current) return;

      // Clear existing markers
      markersRef.current.forEach(marker => {
        mapInstanceRef.current.removeLayer(marker);
      });
      markersRef.current = [];

      // Add new markers for events
      events.forEach(event => {
        if (event.latitude && event.longitude) {
          const isSelected = selectedEvent?.id === event.id;
          
          const eventIcon = window.L.divIcon({
            html: `<div style="background: ${isSelected ? '#ef4444' : '#10b981'}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">📍</div>`,
            className: 'event-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          const marker = window.L.marker([event.latitude, event.longitude], { icon: eventIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`
              <div style="min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; font-weight: bold;">${event.title}</h3>
                <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">${event.sport}</p>
                <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">$${event.pricePerPerson}</p>
                <p style="margin: 0; color: #666; font-size: 12px;">${event.location}</p>
              </div>
            `);

          marker.on('click', () => {
            if (onEventSelect) {
              onEventSelect(event);
            }
          });

          markersRef.current.push(marker);
        }
      });

      // Fit map to show all markers if there are events
      if (events.length > 0 && markersRef.current.length > 0) {
        const group = new window.L.featureGroup(markersRef.current);
        mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
      }
    };

    loadLeaflet();

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when events or selection changes
  useEffect(() => {
    if (mapInstanceRef.current && window.L) {
      updateEventMarkers();
    }
  }, [events, selectedEvent]);

  const updateEventMarkers = () => {
    if (!mapInstanceRef.current || !window.L) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // Add new markers for events
    events.forEach(event => {
      if (event.latitude && event.longitude) {
        const isSelected = selectedEvent?.id === event.id;
        
        const eventIcon = window.L.divIcon({
          html: `<div style="background: ${isSelected ? '#ef4444' : '#10b981'}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: bold;">📍</div>`,
          className: 'event-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = window.L.marker([event.latitude, event.longitude], { icon: eventIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold;">${event.title}</h3>
              <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">${event.sport}</p>
              <p style="margin: 0 0 4px 0; color: #666; font-size: 14px;">$${event.pricePerPerson}</p>
              <p style="margin: 0; color: #666; font-size: 12px;">${event.location}</p>
            </div>
          `);

        marker.on('click', () => {
          if (onEventSelect) {
            onEventSelect(event);
          }
        });

        markersRef.current.push(marker);
      }
    });

    // Fit map to show all markers if there are events
    if (events.length > 0 && markersRef.current.length > 0) {
      const group = new window.L.featureGroup(markersRef.current);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  };

  return (
    <div className={className}>
      <div ref={mapRef} className="h-full w-full rounded-lg border border-gray-200" />
    </div>
  );
}