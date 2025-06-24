import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertEventSchema, insertBookingSchema, insertChatMessageSchema, events } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";

// WebSocket connections by user ID
const connections = new Map<string, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
        userLng
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
      };

      const events = await storage.getEvents(filters);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get('/api/events/:id', async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post('/api/events', isAuthenticated, async (req: any, res) => {
    try {
      console.log("Creating event with body:", req.body);
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const eventId = parseInt(req.params.id);
      
      // Check if user owns the event
      const existingEvent = await storage.getEvent(eventId);
      if (!existingEvent || existingEvent.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }

      const updates = insertEventSchema.partial().parse(req.body);
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const eventId = parseInt(req.params.id);
      
      // Check if user owns the event
      const event = await storage.getEvent(eventId);
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
      const userId = req.user.claims.sub;
      const events = await storage.getEventsByHost(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching user events:", error);
      res.status(500).json({ message: "Failed to fetch user events" });
    }
  });

  // Booking routes
  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookingData = insertBookingSchema.parse({
        ...req.body,
        userId,
        status: "requested", // Always set status to requested for new bookings
      });

      // Check if event has space
      const event = await storage.getEvent(bookingData.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
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
      const userId = req.user.claims.sub;
      const bookings = await storage.getBookingsByUser(userId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ message: "Failed to fetch user bookings" });
    }
  });

  app.get('/api/pending-bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pendingBookings = await storage.getPendingBookingsForHost(userId);
      res.json(pendingBookings);
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
      res.status(500).json({ message: "Failed to fetch pending bookings" });
    }
  });

  app.get('/api/events/:id/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  app.put('/api/bookings/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

      // If approved, increment event currentPlayers
      if (status === 'confirmed') {
        const event = booking.event;
        // Manually update currentPlayers using direct database access
        const newPlayerCount = (event.currentPlayers || 0) + 1;
        await storage.updateEventPlayerCount(event.id, newPlayerCount);
      }

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  app.delete('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const { limit = '50', offset = '0' } = req.query;
      const userId = req.user.claims.sub;
      
      const messages = await storage.getChatMessages(
        eventId,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      
      // Mark all messages as read when fetching
      await storage.markAllMessagesAsRead(eventId, userId);
      
      console.log(`Fetched ${messages.length} messages for event ${eventId}`);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/events/:id/messages/read', isAuthenticated, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Update booking status (accept/reject by host)
  app.put('/api/bookings/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookingId = parseInt(req.params.id);
      const { status } = req.body;
      
      // Validate status
      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'accepted' or 'rejected'" });
      }
      
      // Get the booking and verify the user is the host
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      if (booking.event.hostId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this booking" });
      }
      
      // Update booking status
      const updatedBooking = await storage.updateBookingStatus(bookingId, status);
      
      // Player count is now calculated dynamically, no manual manipulation needed
      
      res.json(updatedBooking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ message: "Failed to update booking status" });
    }
  });

  // Cancel booking (by participant)
  app.put('/api/bookings/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let userId: string | null = null;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth') {
          userId = message.userId;
          if (userId) {
            connections.set(userId, ws);
          }
          return;
        }

        if (message.type === 'chat' && userId) {
          const chatMessage = await storage.createChatMessage({
            eventId: message.eventId,
            senderId: userId,
            content: message.content,
            messageType: message.messageType || 'text',
            metadata: message.metadata,
            readBy: [userId], // Sender automatically reads their own message
          });

          // Get the complete message with sender details
          const messageWithSender = await storage.getChatMessages(message.eventId, 1, 0);
          const completeMessage = messageWithSender[0];

          // Broadcast to all participants of the event
          const event = await storage.getEvent(message.eventId);
          if (event) {
            // Get all accepted bookings for this event
            const bookings = await storage.getBookingsByEvent(message.eventId);
            const acceptedBookings = bookings.filter(b => b.status === 'accepted');
            const participants = [event.hostId, ...acceptedBookings.map(b => b.userId)];
            
            const broadcastMessage = {
              type: 'new_message',
              eventId: message.eventId,
              message: completeMessage,
            };

            console.log(`Broadcasting message to participants:`, participants);
            participants.forEach(participantId => {
              const participantWs = connections.get(participantId);
              if (participantWs && participantWs.readyState === WebSocket.OPEN) {
                participantWs.send(JSON.stringify(broadcastMessage));
                console.log(`Sent message to participant ${participantId}`);
              } else {
                console.log(`Participant ${participantId} not connected or WebSocket not open`);
              }
            });
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (userId) {
        connections.delete(userId);
      }
    });
  });

  return httpServer;
}
