import {
  users,
  events,
  bookings,
  chatMessages,
  payments,
  reviews,
  userSportPreferences,
  type User,
  type UpsertUser,
  type Event,
  type InsertEvent,
  type EventWithHost,
  type Booking,
  type InsertBooking,
  type BookingWithEventAndUser,
  type ChatMessage,
  type InsertChatMessage,
  type ChatMessageWithSender,
  type Payment,
  type InsertPayment,
  type Review,
  type InsertReview,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, count, like, gte, lte, inArray, sql, ne, not } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User>;

  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: number): Promise<EventWithHost | undefined>;
  getEvents(filters?: {
    sports?: string[];
    date?: string;
    skillLevels?: string[];
    genders?: string[];
    location?: string;
    radius?: number;
    priceMax?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<EventWithHost[]>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined>;
  updateEventPlayerCount(id: number, playerCount: number): Promise<boolean>;
  deleteEvent(id: number): Promise<boolean>;
  getEventsByHost(hostId: string): Promise<EventWithHost[]>;

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: number): Promise<BookingWithEventAndUser | undefined>;
  getBookingsByUser(userId: string): Promise<BookingWithEventAndUser[]>;
  getBookingsByEvent(eventId: number): Promise<BookingWithEventAndUser[]>;
  getPendingBookingsForHost(hostId: string): Promise<BookingWithEventAndUser[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  cancelBooking(id: number): Promise<boolean>;

  // Chat operations
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(eventId: number, limit?: number, offset?: number): Promise<ChatMessageWithSender[]>;
  getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: any; unreadCount: number; otherParticipant: any }[]>;
  markMessageAsRead(messageId: number, userId: string): Promise<boolean>;
  markAllMessagesAsRead(eventId: number, userId: string): Promise<boolean>;
  deleteChatroom(eventId: number, userId: string): Promise<boolean>;

  // Payment operations
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePaymentStatus(id: number, status: string, payoutDate?: Date): Promise<Payment | undefined>;
  getPaymentsByUser(userId: string): Promise<Payment[]>;
  getEarnings(hostId: string): Promise<{
    total: number;
    thisMonth: number;
    pending: number;
    nextPayoutDate: Date | null;
  }>;

  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReviewsForUser(userId: string): Promise<Review[]>;
  getUserRating(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Event operations
  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getEvent(id: number): Promise<EventWithHost | undefined> {
    const result = await db
      .select()
      .from(events)
      .leftJoin(users, eq(events.hostId, users.id))
      .leftJoin(bookings, eq(events.id, bookings.eventId))
      .where(eq(events.id, id));

    if (result.length === 0) return undefined;

    const event = result[0].events;
    const host = result[0].users!;
    const eventBookings = result.filter(r => r.bookings).map(r => r.bookings!) as Booking[];

    // Calculate current players dynamically: host (1) + accepted bookings
    const acceptedBookings = eventBookings.filter(b => b.status === 'accepted');
    const currentPlayers = 1 + acceptedBookings.length; // Host counts as 1

    return {
      ...event,
      currentPlayers, // Override with dynamically calculated value
      host,
      bookings: eventBookings,
    };
  }

  async getEvents(filters?: {
    sports?: string[];
    date?: string;
    skillLevels?: string[];
    genders?: string[];
    location?: string;
    radius?: number;
    priceMax?: number;
    search?: string;
    limit?: number;
    offset?: number;
    userLat?: number;
    userLng?: number;
  }): Promise<EventWithHost[]> {
    // Build conditions
    const conditions = [eq(events.status, "published")];

    if (filters?.sports && filters.sports.length > 0) {
      conditions.push(inArray(events.sport, filters.sports as any));
    }

    if (filters?.date) {
      // Handle different date filter types
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let startDate: Date;
      let endDate: Date;
      
      if (filters.date === 'today') {
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 1);
      } else if (filters.date === 'tomorrow') {
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() + 1);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
      } else if (filters.date === 'week') {
        // This week: from today to end of week (Sunday)
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setDate(today.getDate() + (6 - today.getDay())); // End of week
        endDate.setHours(23, 59, 59, 999);
      } else if (filters.date === 'month') {
        // This month: from today to end of month
        startDate = new Date(today);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Custom date format (YYYY-MM-DD)
        const filterDate = new Date(filters.date + 'T00:00:00.000Z');
        startDate = new Date(filterDate);
        startDate.setUTCHours(0, 0, 0, 0);
        endDate = new Date(filterDate);
        endDate.setUTCHours(23, 59, 59, 999);
      }
      
      conditions.push(
        and(
          gte(events.startTime, startDate),
          lte(events.startTime, endDate)
        )!
      );
    }

    if (filters?.skillLevels && filters.skillLevels.length > 0) {
      conditions.push(inArray(events.skillLevel, filters.skillLevels as any));
    }

    if (filters?.genders && filters.genders.length > 0) {
      conditions.push(inArray(events.genderMix, filters.genders as any));
    }

    if (filters?.priceMax) {
      conditions.push(lte(events.pricePerPerson, filters.priceMax.toString()));
    }

    if (filters?.search) {
      conditions.push(
        like(events.title, `%${filters.search}%`)
      );
    }

    if (filters?.location) {
      conditions.push(
        like(events.location, `%${filters.location}%`)
      );
    }

    const result = await db
      .select()
      .from(events)
      .leftJoin(users, eq(events.hostId, users.id))
      .leftJoin(bookings, eq(events.id, bookings.eventId))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(events.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    // Group by event
    const eventMap = new Map<number, EventWithHost>();
    
    for (const row of result) {
      const event = row.events;
      const host = row.users!;
      const booking = row.bookings;

      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, {
          ...event,
          host,
          bookings: [],
        });
      }

      if (booking) {
        eventMap.get(event.id)!.bookings.push(booking);
      }
    }

    let eventsArray = Array.from(eventMap.values());

    // Calculate current players dynamically for each event
    eventsArray = eventsArray.map(event => {
      const acceptedBookings = event.bookings.filter(b => b.status === 'accepted');
      const currentPlayers = 1 + acceptedBookings.length; // Host counts as 1
      return {
        ...event,
        currentPlayers,
      };
    });

    // Apply distance filtering if user location and radius are provided
    if (filters?.userLat && filters?.userLng && filters?.radius) {
      eventsArray = eventsArray.filter(event => {
        if (!event.latitude || !event.longitude) return false;
        
        const eventLat = parseFloat(event.latitude);
        const eventLng = parseFloat(event.longitude);
        
        // Calculate distance in miles using Haversine formula
        const R = 3959; // Radius of Earth in miles
        const dLat = (eventLat - filters.userLat!) * Math.PI / 180;
        const dLng = (eventLng - filters.userLng!) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(filters.userLat! * Math.PI / 180) * Math.cos(eventLat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance <= filters.radius!;
      });
    }

    return eventsArray;
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async updateEventPlayerCount(id: number, playerCount: number): Promise<boolean> {
    const result = await db
      .update(events)
      .set({ currentPlayers: playerCount, updatedAt: new Date() })
      .where(eq(events.id, id));
    return (result.rowCount || 0) > 0;
  }

  async deleteEvent(id: number): Promise<boolean> {
    // First delete all related bookings
    await db.delete(bookings).where(eq(bookings.eventId, id));
    
    // Then delete all related chat messages
    await db.delete(chatMessages).where(eq(chatMessages.eventId, id));
    
    // Finally delete the event
    const result = await db.delete(events).where(eq(events.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getEventsByHost(hostId: string): Promise<EventWithHost[]> {
    const result = await db
      .select()
      .from(events)
      .leftJoin(users, eq(events.hostId, users.id))
      .leftJoin(bookings, eq(events.id, bookings.eventId))
      .where(eq(events.hostId, hostId))
      .orderBy(desc(events.startTime));

    const eventMap = new Map<number, EventWithHost>();
    
    for (const row of result) {
      const event = row.events;
      const host = row.users!;
      const booking = row.bookings;

      if (!eventMap.has(event.id)) {
        eventMap.set(event.id, {
          ...event,
          host,
          bookings: [],
        });
      }

      if (booking) {
        eventMap.get(event.id)!.bookings.push(booking);
      }
    }

    // Calculate current players dynamically for each event
    return Array.from(eventMap.values()).map(event => {
      const acceptedBookings = event.bookings.filter(b => b.status === 'accepted');
      const currentPlayers = 1 + acceptedBookings.length; // Host counts as 1
      return {
        ...event,
        currentPlayers,
      };
    });
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db.insert(bookings).values(booking).returning();
    
    // DO NOT increment player count here - only increment when booking is accepted
    
    return newBooking;
  }

  async getBooking(id: number): Promise<BookingWithEventAndUser | undefined> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(events, eq(bookings.eventId, events.id))
      .leftJoin(users, eq(events.hostId, users.id))
      .where(eq(bookings.id, id));

    if (result.length === 0) return undefined;

    const booking = result[0].bookings;
    const event = result[0].events!;
    const host = result[0].users!;
    const user = await this.getUser(booking.userId);

    return {
      ...booking,
      event: { ...event, host, bookings: [] },
      user: user!,
    };
  }

  async getBookingsByUser(userId: string): Promise<BookingWithEventAndUser[]> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(events, eq(bookings.eventId, events.id))
      .leftJoin(users, eq(events.hostId, users.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));

    const user = await this.getUser(userId);
    
    return result.map(row => ({
      ...row.bookings,
      event: { ...row.events!, host: row.users!, bookings: [] },
      user: user!,
    }));
  }

  async getBookingsByEvent(eventId: number): Promise<BookingWithEventAndUser[]> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(events, eq(bookings.eventId, events.id))
      .leftJoin(users, eq(events.hostId, users.id))
      .where(eq(bookings.eventId, eventId))
      .orderBy(desc(bookings.createdAt));

    const bookingUsers = await Promise.all(
      result.map(row => this.getUser(row.bookings.userId))
    );

    return result.map((row, index) => ({
      ...row.bookings,
      event: { ...row.events!, host: row.users!, bookings: [] },
      user: bookingUsers[index]!,
    }));
  }

  async getPendingBookingsForHost(hostId: string): Promise<BookingWithEventAndUser[]> {
    const result = await db
      .select()
      .from(bookings)
      .leftJoin(events, eq(bookings.eventId, events.id))
      .leftJoin(users, eq(events.hostId, users.id))
      .where(and(eq(events.hostId, hostId), sql`${bookings.status} = 'requested'`))
      .orderBy(desc(bookings.createdAt));

    const bookingUsers = await Promise.all(
      result.map(row => this.getUser(row.bookings.userId))
    );

    return result.map((row, index) => ({
      ...row.bookings,
      event: { ...row.events!, host: row.users!, bookings: [] },
      user: bookingUsers[index]!,
    }));
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async cancelBooking(id: number): Promise<boolean> {
    const booking = await db.select().from(bookings).where(eq(bookings.id, id));
    if (booking.length === 0) return false;

    await db
      .update(bookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(bookings.id, id));

    // Update event current players count
    await db
      .update(events)
      .set({ 
        currentPlayers: sql`${events.currentPlayers} - 1`,
        updatedAt: new Date()
      })
      .where(eq(events.id, booking[0].eventId));

    return true;
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async getChatMessages(eventId: number, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    const result = await db
      .select({
        id: chatMessages.id,
        eventId: chatMessages.eventId,
        senderId: chatMessages.senderId,
        content: chatMessages.content,
        messageType: chatMessages.messageType,
        metadata: chatMessages.metadata,
        readBy: chatMessages.readBy,
        createdAt: chatMessages.createdAt,
        senderFirstName: users.firstName,
        senderLastName: users.lastName,
        senderEmail: users.email,
        senderProfileImageUrl: users.profileImageUrl,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.eventId, eventId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map(row => ({
      id: row.id,
      eventId: row.eventId,
      senderId: row.senderId,
      content: row.content,
      messageType: row.messageType,
      metadata: row.metadata,
      readBy: row.readBy || [],
      createdAt: row.createdAt,
      sender: {
        id: row.senderId,
        firstName: row.senderFirstName || null,
        lastName: row.senderLastName || null,
        email: row.senderEmail || null,
        profileImageUrl: row.senderProfileImageUrl || null,
      },
    })) as ChatMessageWithSender[];
  }

  async getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: ChatMessage | null; unreadCount: number; otherParticipant: any }[]> {
    try {
      // Get all events where user is host or has any booking (not just accepted)
      const hostedEvents = await db
        .select({ 
          eventId: events.id,
          hostId: events.hostId,
          title: events.title,
          sport: events.sport,
          startTime: events.startTime,
          location: events.location
        })
        .from(events)
        .where(eq(events.hostId, userId));

      const bookedEvents = await db
        .select({ 
          eventId: bookings.eventId,
          hostId: events.hostId,
          title: events.title,
          sport: events.sport,
          startTime: events.startTime,
          location: events.location
        })
        .from(bookings)
        .innerJoin(events, eq(bookings.eventId, events.id))
        .where(and(eq(bookings.userId, userId), eq(bookings.status, 'accepted')));

      const allEventIds = [
        ...hostedEvents.map(e => e.eventId),
        ...bookedEvents.map(e => e.eventId)
      ];

      const uniqueEventIds = [...new Set(allEventIds)];

      if (uniqueEventIds.length === 0) return [];

      const chats = await Promise.all(
        uniqueEventIds.map(async (eventId) => {
          try {
            // Get complete event details with host
            const eventQuery = await db
              .select({
                // Event fields
                id: events.id,
                hostId: events.hostId,
                title: events.title,
                description: events.description,
                sport: events.sport,
                skillLevel: events.skillLevel,
                genderMix: events.genderMix,
                startTime: events.startTime,
                endTime: events.endTime,
                location: events.location,
                latitude: events.latitude,
                longitude: events.longitude,
                maxPlayers: events.maxPlayers,
                currentPlayers: events.currentPlayers,
                pricePerPerson: events.pricePerPerson,
                status: events.status,
                notes: events.notes,
                sportConfig: events.sportConfig,
                createdAt: events.createdAt,
                updatedAt: events.updatedAt,
                // Host fields
                hostFirstName: users.firstName,
                hostLastName: users.lastName,
                hostEmail: users.email,
                hostProfileImageUrl: users.profileImageUrl
              })
              .from(events)
              .innerJoin(users, eq(events.hostId, users.id))
              .where(eq(events.id, eventId))
              .limit(1);

            if (eventQuery.length === 0) return null;

            const eventData = eventQuery[0];
            const event = {
              id: eventData.id,
              hostId: eventData.hostId,
              title: eventData.title,
              description: eventData.description,
              sport: eventData.sport,
              skillLevel: eventData.skillLevel,
              genderMix: eventData.genderMix,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              location: eventData.location,
              latitude: eventData.latitude,
              longitude: eventData.longitude,
              maxPlayers: eventData.maxPlayers,
              currentPlayers: eventData.currentPlayers,
              pricePerPerson: eventData.pricePerPerson,
              status: eventData.status,
              notes: eventData.notes,
              sportConfig: eventData.sportConfig,
              createdAt: eventData.createdAt,
              updatedAt: eventData.updatedAt,
              host: {
                id: eventData.hostId,
                firstName: eventData.hostFirstName,
                lastName: eventData.hostLastName,
                email: eventData.hostEmail,
                profileImageUrl: eventData.hostProfileImageUrl
              }
            };

            // Get last message with sender details
            const lastMessageQuery = await db
              .select({
                id: chatMessages.id,
                eventId: chatMessages.eventId,
                senderId: chatMessages.senderId,
                content: chatMessages.content,
                messageType: chatMessages.messageType,
                metadata: chatMessages.metadata,
                readBy: chatMessages.readBy,
                createdAt: chatMessages.createdAt,
                senderFirstName: users.firstName,
                senderLastName: users.lastName,
                senderEmail: users.email,
                senderProfileImageUrl: users.profileImageUrl
              })
              .from(chatMessages)
              .innerJoin(users, eq(chatMessages.senderId, users.id))
              .where(eq(chatMessages.eventId, eventId))
              .orderBy(desc(chatMessages.createdAt))
              .limit(1);

            const lastMessage = lastMessageQuery.length > 0 ? {
              id: lastMessageQuery[0].id,
              eventId: lastMessageQuery[0].eventId,
              senderId: lastMessageQuery[0].senderId,
              content: lastMessageQuery[0].content,
              messageType: lastMessageQuery[0].messageType,
              metadata: lastMessageQuery[0].metadata,
              readBy: lastMessageQuery[0].readBy || [],
              createdAt: lastMessageQuery[0].createdAt,
              sender: {
                id: lastMessageQuery[0].senderId,
                firstName: lastMessageQuery[0].senderFirstName,
                lastName: lastMessageQuery[0].senderLastName,
                email: lastMessageQuery[0].senderEmail,
                profileImageUrl: lastMessageQuery[0].senderProfileImageUrl
              }
            } : null;

            // Get other participant
            let otherParticipant = null;
            if (eventData.hostId === userId) {
              // User is host, get first accepted booking user
              const participantQuery = await db
                .select({
                  id: users.id,
                  firstName: users.firstName,
                  lastName: users.lastName,
                  email: users.email,
                  profileImageUrl: users.profileImageUrl
                })
                .from(bookings)
                .innerJoin(users, eq(bookings.userId, users.id))
                .where(and(
                  eq(bookings.eventId, eventId),
                  eq(bookings.status, 'accepted'),
                  ne(bookings.userId, userId)
                ))
                .limit(1);

              if (participantQuery.length > 0) {
                otherParticipant = participantQuery[0];
              }
            } else {
              // User is participant, host is other participant
              otherParticipant = event.host;
            }

            // Count unread messages
            const unreadQuery = await db
              .select({ count: count() })
              .from(chatMessages)
              .where(
                and(
                  eq(chatMessages.eventId, eventId),
                  ne(chatMessages.senderId, userId),
                  not(sql`${userId} = ANY(${chatMessages.readBy})`)
                )
              );

            const unreadCount = unreadQuery[0]?.count || 0;

            // Only return chats where there's another participant
            if (!otherParticipant) return null;

            return {
              eventId,
              event,
              lastMessage,
              unreadCount,
              otherParticipant
            };

          } catch (error) {
            console.error(`Error processing chat for event ${eventId}:`, error);
            return null;
          }
        })
      );

      return chats.filter(chat => chat !== null) as { eventId: number; event: Event; lastMessage: ChatMessage | null; unreadCount: number; otherParticipant: any }[];
    } catch (error) {
      console.error("Error in getEventChats:", error);
      return [];
    }
  }

  // Payment operations
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePaymentStatus(id: number, status: string, payoutDate?: Date): Promise<Payment | undefined> {
    const updates: any = { status: status as any, updatedAt: new Date() };
    if (payoutDate) updates.payoutDate = payoutDate;

    const [payment] = await db
      .update(payments)
      .set(updates)
      .where(eq(payments.id, id))
      .returning();
    return payment;
  }

  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    const result = await db
      .select()
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(payments.createdAt));

    return result.map(row => row.payments);
  }

  async getEarnings(hostId: string): Promise<{
    total: number;
    thisMonth: number;
    pending: number;
    nextPayoutDate: Date | null;
  }> {
    const hostEvents = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.hostId, hostId));

    const eventIds = hostEvents.map(e => e.id);

    if (eventIds.length === 0) {
      return { total: 0, thisMonth: 0, pending: 0, nextPayoutDate: null };
    }

    const hostBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(inArray(bookings.eventId, eventIds));

    const bookingIds = hostBookings.map(b => b.id);

    if (bookingIds.length === 0) {
      return { total: 0, thisMonth: 0, pending: 0, nextPayoutDate: null };
    }

    const allPayments = await db
      .select()
      .from(payments)
      .where(inArray(payments.bookingId, bookingIds));

    const total = allPayments
      .filter(p => p.status === "paid")
      .reduce((sum, p) => sum + parseFloat(p.hostPayout || "0"), 0);

    const thisMonth = allPayments
      .filter(p => p.status === "paid" && p.createdAt && p.createdAt.getMonth() === new Date().getMonth())
      .reduce((sum, p) => sum + parseFloat(p.hostPayout || "0"), 0);

    const pending = allPayments
      .filter(p => p.status === "escrowed")
      .reduce((sum, p) => sum + parseFloat(p.hostPayout || "0"), 0);

    const nextPayoutDate = allPayments
      .filter(p => p.status === "escrowed")
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0))[0]?.payoutDate || null;

    return { total, thisMonth, pending, nextPayoutDate };
  }

  // Review operations
  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async getReviewsForUser(userId: string): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));
  }

  async getUserRating(userId: string): Promise<number> {
    const userReviews = await db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));

    if (userReviews.length === 0) return 0;

    const average = userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length;
    return Math.round(average * 10) / 10; // Round to 1 decimal place
  }

  async markMessageAsRead(messageId: number, userId: string): Promise<boolean> {
    try {
      const message = await db
        .select({ readBy: chatMessages.readBy })
        .from(chatMessages)
        .where(eq(chatMessages.id, messageId))
        .limit(1);

      if (message.length === 0) return false;

      const currentReadBy = message[0].readBy || [];
      if (!currentReadBy.includes(userId)) {
        await db
          .update(chatMessages)
          .set({ readBy: [...currentReadBy, userId] })
          .where(eq(chatMessages.id, messageId));
      }
      
      return true;
    } catch (error) {
      console.error("Error marking message as read:", error);
      return false;
    }
  }

  async markAllMessagesAsRead(eventId: number, userId: string): Promise<boolean> {
    try {
      const messages = await db
        .select({ id: chatMessages.id, readBy: chatMessages.readBy })
        .from(chatMessages)
        .where(eq(chatMessages.eventId, eventId));

      for (const message of messages) {
        const currentReadBy = message.readBy || [];
        if (!currentReadBy.includes(userId)) {
          await db
            .update(chatMessages)
            .set({ readBy: [...currentReadBy, userId] })
            .where(eq(chatMessages.id, message.id));
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error marking all messages as read:", error);
      return false;
    }
  }

  async deleteChatroom(eventId: number, userId: string): Promise<boolean> {
    try {
      // Verify user has access to this event (either host or participant)
      const event = await db
        .select({ hostId: events.hostId })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);

      if (event.length === 0) return false;

      const booking = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.eventId, eventId), eq(bookings.userId, userId)))
        .limit(1);

      if (event[0].hostId !== userId && booking.length === 0) {
        return false; // User has no access to this event
      }

      // Delete all messages for this event
      await db
        .delete(chatMessages)
        .where(eq(chatMessages.eventId, eventId));
      
      return true;
    } catch (error) {
      console.error("Error deleting chatroom:", error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
