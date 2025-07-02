import {
  users,
  events,
  bookings,
  chatMessages,
  payments,
  reviews,
  userSportPreferences,
  sportsSettings,
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
  type SportsSettings,
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
  getChatMessagesForConversation(eventId: number, userId1: string, userId2: string, limit?: number, offset?: number): Promise<ChatMessageWithSender[]>;
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

  // Sports settings operations
  getSportsSettings(): Promise<Record<string, Record<string, string[]>>>;
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
    userTimezone?: string;
  }): Promise<EventWithHost[]> {
    // Build conditions
    const conditions = [eq(events.status, "published")];

    if (filters?.sports && filters.sports.length > 0) {
      conditions.push(inArray(events.sport, filters.sports as any));
    }

    if (filters?.date) {
      const userTimezone = filters.userTimezone || 'UTC';
      
      // Get user's current date in their timezone
      const getUserDate = (offsetDays: number = 0) => {
        const now = new Date();
        const userDate = new Date(now.toLocaleString("en-CA", {timeZone: userTimezone})); // en-CA gives YYYY-MM-DD format
        userDate.setDate(userDate.getDate() + offsetDays);
        return userDate.toISOString().split('T')[0]; // Return YYYY-MM-DD string
      };
      
      let targetDateStr: string;
      
      if (filters.date === 'today') {
        targetDateStr = getUserDate(0);
      } else if (filters.date === 'tomorrow') {
        targetDateStr = getUserDate(1);
      } else if (filters.date === 'week') {
        // This week logic - for now, just show today to end of week
        const today = getUserDate(0);
        const todayDate = new Date(today);
        const daysUntilSunday = 6 - todayDate.getDay();
        const endOfWeek = getUserDate(daysUntilSunday);
        
        console.log(`Week filter: from ${today} to ${endOfWeek}`);
        conditions.push(sql`DATE(${events.startTime} AT TIME ZONE ${userTimezone}) >= ${today}::date`);
        conditions.push(sql`DATE(${events.startTime} AT TIME ZONE ${userTimezone}) <= ${endOfWeek}::date`);
        return; // Early return for week filter
      } else if (filters.date === 'month') {
        // This month logic
        const today = getUserDate(0);
        const todayDate = new Date(today);
        const endOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
        const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
        
        console.log(`Month filter: from ${today} to ${endOfMonthStr}`);
        conditions.push(sql`DATE(${events.startTime} AT TIME ZONE ${userTimezone}) >= ${today}::date`);
        conditions.push(sql`DATE(${events.startTime} AT TIME ZONE ${userTimezone}) <= ${endOfMonthStr}::date`);
        return; // Early return for month filter
      } else {
        // Custom date format (YYYY-MM-DD)
        targetDateStr = filters.date;
      }
      
      console.log(`Simple date filter: ${filters.date} -> ${targetDateStr} (user timezone: ${userTimezone})`);
      
      // Simple comparison: if event's date in user timezone equals target date
      conditions.push(
        sql`DATE(${events.startTime} AT TIME ZONE ${userTimezone}) = ${targetDateStr}::date`
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
    const messageData = {
      ...message,
      readBy: message.readBy || [message.senderId], // Sender automatically reads their own message
    };
    const [newMessage] = await db.insert(chatMessages).values(messageData).returning();
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

  async getChatMessagesForConversation(eventId: number, userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    try {
      console.log(`Querying database for event ${eventId} between users ${userId1} and ${userId2}`);
      
      const messages = await db
        .select({
          id: chatMessages.id,
          eventId: chatMessages.eventId,
          senderId: chatMessages.senderId,
          receiverId: chatMessages.receiverId,
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
        .where(and(
          eq(chatMessages.eventId, eventId),
          or(
            and(eq(chatMessages.senderId, userId1), eq(chatMessages.receiverId, userId2)),
            and(eq(chatMessages.senderId, userId2), eq(chatMessages.receiverId, userId1))
          )
        ))
        .orderBy(asc(chatMessages.createdAt))
        .limit(limit)
        .offset(offset);

      console.log(`Found ${messages.length} messages in database for conversation between ${userId1} and ${userId2}`);
      
      if (messages.length === 0) {
        // Debug: Check if there are any messages for this event at all
        const allMessages = await db
          .select({ count: sql<number>`count(*)` })
          .from(chatMessages)
          .where(eq(chatMessages.eventId, eventId));
        console.log(`Total messages for event ${eventId}: ${allMessages[0]?.count || 0}`);
      }

      return messages.map(msg => ({
        id: msg.id,
        eventId: msg.eventId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        content: msg.content,
        messageType: msg.messageType,
        metadata: msg.metadata,
        readBy: msg.readBy || [],
        createdAt: msg.createdAt,
        sender: {
          id: msg.senderId,
          firstName: msg.senderFirstName,
          lastName: msg.senderLastName,
          email: msg.senderEmail,
          profileImageUrl: msg.senderProfileImageUrl
        }
      }));
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      return [];
    }
  }

  async getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: ChatMessage | null; unreadCount: number; otherParticipant: any }[]> {
    try {
      // Get all unique conversation pairs (eventId + other participant)
      const conversations = await db
        .selectDistinct({
          eventId: chatMessages.eventId,
          senderId: chatMessages.senderId,
          receiverId: chatMessages.receiverId
        })
        .from(chatMessages)
        .where(
          or(
            eq(chatMessages.senderId, userId),
            eq(chatMessages.receiverId, userId)
          )
        );

      // Group by eventId and determine unique conversation partners
      const conversationMap = new Map<string, {eventId: number, otherUserId: string}>();
      
      conversations.forEach(conv => {
        const otherUserId = conv.senderId === userId ? conv.receiverId : conv.senderId;
        const key = `${conv.eventId}-${otherUserId}`;
        conversationMap.set(key, {
          eventId: conv.eventId,
          otherUserId
        });
      });

      if (conversationMap.size === 0) return [];

      const chats = await Promise.all(Array.from(conversationMap.values()).map(async (conv) => {
          try {
            // Get complete event details with host
            // Get event details
            const eventQuery = await db
              .select()
              .from(events)
              .innerJoin(users, eq(events.hostId, users.id))
              .where(eq(events.id, conv.eventId))
              .limit(1);

            if (eventQuery.length === 0) return null;

            const eventData = eventQuery[0].events;
            const event = {
              ...eventData,
              host: eventQuery[0].users
            };

            // Get other participant details
            const otherParticipantQuery = await db
              .select()
              .from(users)
              .where(eq(users.id, conv.otherUserId))
              .limit(1);

            if (otherParticipantQuery.length === 0) return null;
            const otherParticipant = otherParticipantQuery[0];

            // Get unread message count for this specific conversation
            const unreadCountQuery = await db
              .select({ count: count() })
              .from(chatMessages)
              .where(and(
                eq(chatMessages.eventId, conv.eventId),
                eq(chatMessages.senderId, conv.otherUserId),
                eq(chatMessages.receiverId, userId),
                sql`NOT (${chatMessages.readBy} @> ${JSON.stringify([userId])})`
              ));

            const unreadCount = unreadCountQuery[0].count;

            // Get last message for this specific conversation
            const lastMessageQuery = await db
              .select({
                id: chatMessages.id,
                content: chatMessages.content,
                senderId: chatMessages.senderId,
                createdAt: chatMessages.createdAt,
                senderFirstName: users.firstName,
                senderLastName: users.lastName,
                senderEmail: users.email,
                senderProfileImageUrl: users.profileImageUrl
              })
              .from(chatMessages)
              .innerJoin(users, eq(chatMessages.senderId, users.id))
              .where(and(
                eq(chatMessages.eventId, conv.eventId),
                or(
                  and(eq(chatMessages.senderId, userId), eq(chatMessages.receiverId, conv.otherUserId)),
                  and(eq(chatMessages.senderId, conv.otherUserId), eq(chatMessages.receiverId, userId))
                )
              ))
              .orderBy(desc(chatMessages.createdAt))
              .limit(1);

            const lastMessage = lastMessageQuery.length > 0 ? {
              ...lastMessageQuery[0],
              sender: {
                id: lastMessageQuery[0].senderId,
                firstName: lastMessageQuery[0].senderFirstName,
                lastName: lastMessageQuery[0].senderLastName,
                email: lastMessageQuery[0].senderEmail,
                profileImageUrl: lastMessageQuery[0].senderProfileImageUrl
              }
            } : null;

            // Only return if there's a last message
            if (!lastMessage) return null;

            return {
              eventId: conv.eventId,
              event,
              lastMessage,
              unreadCount,
              otherParticipant
            };

          } catch (error) {
            console.error(`Error processing chat for event ${conv.eventId} with user ${conv.otherUserId}:`, error);
            return null;
          }
        })
      );

      const validChats = chats.filter(chat => chat !== null) as { eventId: number; event: Event; lastMessage: ChatMessage | null; unreadCount: number; otherParticipant: any }[];
      
      return validChats.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    } catch (error) {
      console.error('Error fetching event chats:', error);
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
      console.log(`Marking messages as read for event ${eventId}, user ${userId}`);
      
      const messages = await db
        .select({ id: chatMessages.id, readBy: chatMessages.readBy })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.eventId, eventId),
            ne(chatMessages.senderId, userId) // Only mark messages from others as read
          )
        );

      console.log(`Found ${messages.length} messages to mark as read`);

      for (const message of messages) {
        const currentReadBy = message.readBy || [];
        if (!currentReadBy.includes(userId)) {
          await db
            .update(chatMessages)
            .set({ readBy: [...currentReadBy, userId] })
            .where(eq(chatMessages.id, message.id));
          console.log(`Marked message ${message.id} as read by ${userId}`);
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

  async getSportsSettings(): Promise<Record<string, Record<string, string[]>>> {
    const settings = await db
      .select()
      .from(sportsSettings)
      .orderBy(asc(sportsSettings.sport), asc(sportsSettings.settingKey), asc(sportsSettings.displayOrder));

    const groupedSettings: Record<string, Record<string, string[]>> = {};

    for (const setting of settings) {
      if (!groupedSettings[setting.sport]) {
        groupedSettings[setting.sport] = {};
      }
      
      if (!groupedSettings[setting.sport][setting.settingKey]) {
        groupedSettings[setting.sport][setting.settingKey] = [];
      }
      
      groupedSettings[setting.sport][setting.settingKey].push(setting.settingValue);
    }

    return groupedSettings;
  }
}

export const storage = new DatabaseStorage();
