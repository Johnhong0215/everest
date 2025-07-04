import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage-supabase";
import { setupAuth, isAuthenticated } from "./supabaseAuth";
import { insertEventSchema, insertBookingSchema, insertChatMessageSchema, events, chatMessages } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

// WebSocket connections by user ID
const connections = new Map<string, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Supabase configuration endpoint for frontend
  app.get('/api/supabase-config', (req, res) => {
    res.json({
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY
    });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id; // Supabase user ID is directly on user object
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Event routes
  app.get('/api/events', async (req, res) => {
    try {
      const {
        sports,
        date,
        skillLevels,
        genders,
        location,
        radius,
        priceMax,
        search,
        limit = '50',
        offset = '0',
        userLat,
        userLng,
        userTimezone
      } = req.query;

      const filters = {
        sports: sports ? (sports as string).split(',') : undefined,
        date: date as string,
        skillLevels: skillLevels ? (skillLevels as string).split(',') : undefined,
        genders: genders ? (genders as string).split(',') : undefined,
        location: location as string,
        radius: radius ? parseInt(radius as string) : undefined,
        priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
        search: search as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        userLat: userLat ? parseFloat(userLat as string) : undefined,
        userLng: userLng ? parseFloat(userLng as string) : undefined,
        userTimezone: userTimezone as string,
      };

      const events = await storage.getEvents(filters);
      
      // Events are already properly formatted from storage
      const mappedEvents = events;
      
      res.json(mappedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      console.log('Fetching event with ID:', eventId);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Event is already properly formatted from storage
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Creating event with body:", req.body);
      const userId = req.user.id;
      console.log("User ID:", userId);
      
      // Convert datetime strings to Date objects and set currentPlayers to 1 (host is playing)
      const eventDataWithDates = {
        ...req.body,
        hostId: userId,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        currentPlayers: 1, // Host is automatically playing
      };
      
      const eventData = insertEventSchema.parse(eventDataWithDates);
      
      console.log("Parsed event data:", eventData);
      const event = await storage.createEvent(eventData);
      console.log("Created event:", event);
      
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.put('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const eventId = parseInt(req.params.id);
      
      // Check if user owns the event
      const existingEvent = await storage.getEvent(eventId);
      console.log("Checking authorization - Event hostId:", existingEvent?.hostId, "User ID:", userId);
      
      if (!existingEvent || existingEvent.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }

      // Parse and convert dates
      const bodyData = req.body;
      if (bodyData.startTime && typeof bodyData.startTime === 'string') {
        bodyData.startTime = new Date(bodyData.startTime);
      }
      if (bodyData.endTime && typeof bodyData.endTime === 'string') {
        bodyData.endTime = new Date(bodyData.endTime);
      }
      
      const updates = insertEventSchema.partial().parse(bodyData);
      const event = await storage.updateEvent(eventId, updates);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const eventId = parseInt(req.params.id);
      
      // Check if user owns the event
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent || existingEvent.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this event" });
      }

      const deleted = await storage.deleteEvent(eventId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json({ message: "Event deleted successfully" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  app.put('/api/events/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const eventId = parseInt(req.params.id);
      
      // Check if user owns the event
      const event = await storage.getEvent(eventId);
      console.log(`Authorization check: userId=${userId}, event.hostId=${event?.hostId}, match=${event?.hostId === userId}`);
      if (!event || event.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this event" });
      }

      const eventData = {
        ...req.body,
        id: eventId,
      };

      const updatedEvent = await storage.updateEvent(eventId, eventData);
      if (!updatedEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.get('/api/my-events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const events = await storage.getEventsByHost(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching user events:", error);
      res.status(500).json({ message: "Failed to fetch user events" });
    }
  });

  // Booking routes - Updated for user participation arrays
  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }

      // Check if event exists and has space
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Check if user already has a participation status
      const userAlreadyRequested = event.requestedUsers?.includes(userId);
      const userAlreadyAccepted = event.acceptedUsers?.includes(userId);
      const userAlreadyRejected = event.rejectedUsers?.includes(userId);

      if (userAlreadyRequested || userAlreadyAccepted || userAlreadyRejected) {
        return res.status(400).json({ message: "You have already requested to join this event" });
      }

      if ((event.currentPlayers || 0) >= event.maxPlayers) {
        return res.status(400).json({ message: "Event is full" });
      }

      // Check if user already booked this event
      const existingBookings = await storage.getBookingsByEvent(bookingData.eventId);
      const userAlreadyBooked = existingBookings.some(b => b.userId === userId);
      
      if (userAlreadyBooked) {
        return res.status(400).json({ message: "You have already booked this event" });
      }

      const booking = await storage.createBooking(bookingData);
      res.status(201).json(booking);
    } catch (error) {
      console.error("Error creating booking:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.get('/api/my-bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bookings = await storage.getBookingsByUser(userId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ message: "Failed to fetch user bookings" });
    }
  });

  app.get('/api/pending-bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const pendingBookings = await storage.getPendingBookingsForHost(userId);
      res.json(pendingBookings);
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
      res.status(500).json({ message: "Failed to fetch pending bookings" });
    }
  });

  app.get('/api/events/:id/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const eventId = parseInt(req.params.id);
      
      // Check if user owns the event
      const event = await storage.getEvent(eventId);
      if (!event || event.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to view bookings for this event" });
      }

      const bookings = await storage.getBookingsByEvent(eventId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching event bookings:", error);
      res.status(500).json({ message: "Failed to fetch event bookings" });
    }
  });

  app.patch('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bookingId = parseInt(req.params.id);
      const { status } = req.body;

      // Get booking and verify user is the event host
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Check if user is the host of the event
      if (booking.event.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this booking" });
      }

      const updatedBooking = await storage.updateBookingStatus(bookingId, status);
      
      if (!updatedBooking) {
        return res.status(404).json({ message: "Failed to update booking" });
      }

      // Player count is now calculated dynamically based on accepted bookings

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  app.delete('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bookingId = parseInt(req.params.id);
      
      // Verify user owns this booking
      const booking = await storage.getBooking(bookingId);
      if (!booking || booking.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to cancel this booking" });
      }

      const cancelled = await storage.cancelBooking(bookingId);
      
      if (!cancelled) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json({ message: "Booking cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  // Chat routes
  app.get('/api/events/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const otherUserId = req.query.otherUserId as string;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const userId = req.user?.id || req.user?.claims?.sub;
      console.log(`Fetching messages for event ${eventId}, current user: ${userId}, other user: ${otherUserId}`);
      
      if (otherUserId && userId) {
        // Get messages for specific conversation
        const messages = await storage.getChatMessagesForConversation(eventId, userId, otherUserId, limit, offset);
        console.log(`Fetched ${messages.length} conversation messages between ${userId} and ${otherUserId} in event ${eventId}`);
        res.json(messages);
      } else {
        // Get all messages for event (fallback when no specific conversation)
        const messages = await storage.getChatMessages(eventId, limit, offset);
        console.log(`Fetched ${messages.length} total messages for event ${eventId}`);
        res.json(messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Create new chat message via REST API
  app.post('/api/events/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { content, messageType = "text", receiverId } = req.body;
      const senderId = req.user?.id || req.user?.claims?.sub;

      console.log(`Creating message: eventId=${eventId}, senderId=${senderId}, receiverId=${receiverId}, content="${content}"`);

      if (!content || !receiverId || !senderId) {
        return res.status(400).json({ message: "Content, receiverId, and authenticated user are required" });
      }

      const message = await storage.createChatMessage({
        eventId,
        senderId,
        receiverId,
        content,
        messageType,
        readBy: [senderId] // Sender has read their own message
      });

      console.log(`Message created successfully with ID: ${message.id}`);
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.post('/api/events/:id/messages/read', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user?.id || req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      const success = await storage.markAllMessagesAsRead(eventId, userId);
      
      if (success) {
        res.json({ message: "Messages marked as read" });
      } else {
        res.status(500).json({ message: "Failed to mark messages as read" });
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  app.delete('/api/events/:id/chatroom', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user.id;
      
      const success = await storage.deleteChatroom(eventId, userId);
      
      if (success) {
        res.json({ message: "Chatroom deleted successfully" });
      } else {
        res.status(403).json({ message: "Not authorized to delete this chatroom" });
      }
    } catch (error) {
      console.error("Error deleting chatroom:", error);
      res.status(500).json({ message: "Failed to delete chatroom" });
    }
  });

  app.get('/api/my-chats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      const chats = await storage.getEventChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching user chats:", error);
      res.status(500).json({ message: "Failed to fetch user chats" });
    }
  });

  // Simple booking creation without payment processing
  app.post("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { eventId } = req.body;
      
      // Check if event exists and has capacity
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      if ((event.currentPlayers || 0) >= event.maxPlayers) {
        return res.status(400).json({ message: "Event is full" });
      }
      
      // Check if user already has a booking for this event
      const existingBookings = await storage.getBookingsByUser(userId);
      const hasExistingBooking = existingBookings.some(b => b.eventId === eventId);
      
      if (hasExistingBooking) {
        return res.status(400).json({ message: "You already have a booking for this event" });
      }
      
      // Create booking with "requested" status - host needs to accept/reject
      const booking = await storage.createBooking({
        eventId,
        userId,
        status: "requested",
      });
      
      res.status(201).json(booking);
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });



  // Cancel booking (by participant)
  app.put('/api/bookings/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const bookingId = parseInt(req.params.id);
      
      // Get the booking and verify the user owns it
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      if (booking.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to cancel this booking" });
      }
      
      // Only allow cancellation of accepted bookings
      if (booking.status !== 'accepted') {
        return res.status(400).json({ message: "Can only cancel accepted bookings" });
      }
      
      // Update booking status to cancelled
      const updatedBooking = await storage.updateBookingStatus(bookingId, 'cancelled');
      
      // Player count is now calculated dynamically, no manual manipulation needed
      
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ message: "Failed to cancel booking" });
    }
  });

  // Review routes
  app.post('/api/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const reviewData = {
        ...req.body,
        reviewerId: userId,
      };

      const review = await storage.createReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  app.get('/api/users/:id/reviews', async (req, res) => {
    try {
      const userId = req.params.id;
      const reviews = await storage.getReviewsForUser(userId);
      const rating = await storage.getUserRating(userId);
      
      res.json({ reviews, rating });
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      res.status(500).json({ message: "Failed to fetch user reviews" });
    }
  });

  // Location search proxy endpoint
  app.get('/api/search-locations', async (req, res) => {
    try {
      const { q, lat, lng, limit = '10' } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.status(400).json({ message: "Query parameter 'q' is required and must be at least 2 characters" });
      }

      // Build Nominatim URL
      let url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(q)}&countrycodes=us&addressdetails=1`;
      
      // Add proximity search if lat/lng provided
      if (lat && lng) {
        const viewboxSize = 1.0;
        const latNum = parseFloat(lat as string);
        const lngNum = parseFloat(lng as string);
        url += `&viewbox=${lngNum-viewboxSize},${latNum-viewboxSize},${lngNum+viewboxSize},${latNum+viewboxSize}`;
      }

      console.log('Server: Making location search request to:', url);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Everest Sports Platform'
        }
      });

      if (!response.ok) {
        console.error('Nominatim API error:', response.status, response.statusText);
        return res.status(response.status).json({ message: `Location search failed: ${response.statusText}` });
      }

      const data = await response.json();
      console.log('Server: Location search returned', data.length, 'results');

      // Transform data to match expected format
      const transformedData = data.map((item: any) => {
        const displayName = item.display_name || '';
        const parts = displayName.split(',').slice(0, 3);
        const cleanDisplayName = parts.join(', ').trim();
        
        return {
          place_id: item.place_id,
          display_name: cleanDisplayName,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          address: item.address,
        };
      });

      res.json(transformedData);
    } catch (error) {
      console.error("Error in location search proxy:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;
    console.log('New WebSocket connection established');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          userId = message.userId;
          if (userId) {
            connections.set(userId, ws);
            console.log(`User ${userId} authenticated and connected via WebSocket`);
          }
          return;
        }

        if (message.type === 'chat' && userId) {
          // Get event to determine receiver
          const event = await storage.getEvent(message.eventId);
          if (!event) return;
          
          // Determine receiver: if sender is host, receiver is the participant; if sender is participant, receiver is host
          let receiverId: string;
          if (event.hostId === userId) {
            // Sender is host, need to find the participant (for now, assume first participant)
            const bookings = await storage.getBookingsByEvent(message.eventId);
            const acceptedBookings = bookings.filter(b => b.status === 'accepted');
            if (acceptedBookings.length === 0) return; // No participants to send to
            receiverId = acceptedBookings[0].userId; // Send to first participant for now
          } else {
            // Sender is participant, receiver is host
            receiverId = event.hostId;
          }

          const chatMessage = await storage.createChatMessage({
            eventId: message.eventId,
            senderId: userId,
            receiverId: receiverId,
            content: message.content,
            messageType: message.messageType || 'text',
            metadata: message.metadata,
            readBy: [userId], // Sender automatically reads their own message
          });

          // Get the complete message with sender details
          const messageWithSender = await storage.getChatMessages(message.eventId, 1, 0);
          const completeMessage = messageWithSender[0];

          // Broadcast to the specific receiver
          const broadcastMessage = {
            type: 'new_message',
            eventId: message.eventId,
            message: completeMessage,
          };

          console.log(`Broadcasting message from ${userId} to receiver ${receiverId}`);
          console.log(`Current connections:`, Array.from(connections.keys()));
          
          // Send to receiver
          const receiverWs = connections.get(receiverId);
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            receiverWs.send(JSON.stringify(broadcastMessage));
            console.log(`✓ Sent message to receiver ${receiverId}`);
          } else {
            console.log(`✗ Receiver ${receiverId} not connected or WebSocket not open`);
          }
          
          // Also send back to sender for confirmation
          const senderWs = connections.get(userId);
          if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(JSON.stringify({
              type: 'message_sent',
              eventId: message.eventId,
              message: completeMessage,
            }));
            console.log(`✓ Sent confirmation to sender ${userId}`);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        connections.delete(userId);
        console.log(`User ${userId} disconnected from WebSocket`);
      }
    });
  });

  // Location search endpoint (proxy to avoid CORS issues)
  app.get('/api/search-locations', async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=us`,
        {
          headers: {
            'User-Agent': 'Everest Sports App (https://everest.replit.app)',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch from Nominatim');
      }

      const data = await response.json();
      const locations = data.map((item: any) => ({
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      }));

      res.json(locations);
    } catch (error) {
      console.error('Location search error:', error);
      res.status(500).json({ error: 'Failed to search locations' });
    }
  });

  // Reverse geocoding endpoint
  app.get('/api/reverse-geocode', async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng || typeof lat !== 'string' || typeof lng !== 'string') {
        return res.status(400).json({ error: 'Query parameters lat and lng are required' });
      }

      console.log(`Reverse geocoding for: ${lat}, ${lng}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Everest Sports App (https://everest.replit.app)',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Nominatim response not OK: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Nominatim response data:', JSON.stringify(data, null, 2));
      
      // Extract a readable address from the response
      let address = data.display_name || `${lat}, ${lng}`;
      
      if (data.address) {
        const { house_number, road, suburb, city, state, postcode } = data.address;
        const parts = [];
        if (house_number && road) parts.push(`${house_number} ${road}`);
        else if (road) parts.push(road);
        if (suburb) parts.push(suburb);
        if (city) parts.push(city);
        if (state) parts.push(state);
        if (postcode) parts.push(postcode);
        
        if (parts.length > 0) {
          address = parts.join(', ');
        }
      }

      console.log('Final address:', address);
      res.json({ address });
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Return coordinates as fallback
      const { lat, lng } = req.query;
      res.json({ address: `${lat}, ${lng}` });
    }
  });

  // Get sports settings from database
  app.get('/api/sports-settings', async (req, res) => {
    try {
      const settings = await storage.getSportsSettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching sports settings:', error);
      res.status(500).json({ message: 'Failed to fetch sports settings' });
    }
  });

  return httpServer;
}
