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
import { eq, and, desc, asc, count, like, gte, lte, inArray, sql } from "drizzle-orm";

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
    skillLevel?: string;
    location?: string;
    radius?: number;
    priceMax?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<EventWithHost[]>;
  updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  getEventsByHost(hostId: string): Promise<EventWithHost[]>;

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getBooking(id: number): Promise<BookingWithEventAndUser | undefined>;
  getBookingsByUser(userId: string): Promise<BookingWithEventAndUser[]>;
  getBookingsByEvent(eventId: number): Promise<BookingWithEventAndUser[]>;
  updateBookingStatus(id: number, status: string): Promise<Booking | undefined>;
  cancelBooking(id: number): Promise<boolean>;

  // Chat operations
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(eventId: number, limit?: number, offset?: number): Promise<ChatMessageWithSender[]>;
  getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: ChatMessage; unreadCount: number }[]>;

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

    return {
      ...event,
      host,
      bookings: eventBookings,
    };
  }

  async getEvents(filters?: {
    sports?: string[];
    date?: string;
    skillLevel?: string;
    location?: string;
    radius?: number;
    priceMax?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<EventWithHost[]> {
    let query = db
      .select()
      .from(events)
      .leftJoin(users, eq(events.hostId, users.id))
      .leftJoin(bookings, eq(events.id, bookings.eventId))
      .where(eq(events.status, "published"));

    // Apply filters
    const conditions = [eq(events.status, "published")];

    if (filters?.sports && filters.sports.length > 0) {
      conditions.push(inArray(events.sport, filters.sports as any));
    }

    if (filters?.date) {
      const startOfDay = new Date(filters.date);
      const endOfDay = new Date(filters.date);
      endOfDay.setDate(endOfDay.getDate() + 1);
      conditions.push(
        and(
          gte(events.startTime, startOfDay),
          lte(events.startTime, endOfDay)
        )!
      );
    }

    if (filters?.skillLevel && filters.skillLevel !== "any") {
      conditions.push(eq(events.skillLevel, filters.skillLevel as any));
    }

    if (filters?.priceMax) {
      conditions.push(lte(events.pricePerPerson, filters.priceMax.toString()));
    }

    if (filters?.search) {
      conditions.push(
        like(events.title, `%${filters.search}%`)
      );
    }

    if (conditions.length > 1) {
      query = query.where(and(...conditions)!);
    }

    const result = await query
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

    return Array.from(eventMap.values());
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return result.rowCount > 0;
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

    return Array.from(eventMap.values());
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db.insert(bookings).values(booking).returning();
    
    // Update event current players count
    await db
      .update(events)
      .set({ 
        currentPlayers: sql`${events.currentPlayers} + 1`,
        updatedAt: new Date()
      })
      .where(eq(events.id, booking.eventId));

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
      .select()
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.senderId, users.id))
      .where(eq(chatMessages.eventId, eventId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return result.map(row => ({
      ...row.chat_messages,
      sender: row.users!,
    }));
  }

  async getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: ChatMessage; unreadCount: number }[]> {
    // Get events where user is either host or participant
    const userEvents = await db
      .select({ eventId: events.id })
      .from(events)
      .leftJoin(bookings, eq(events.id, bookings.eventId))
      .where(
        sql`${events.hostId} = ${userId} OR ${bookings.userId} = ${userId}`
      );

    const eventIds = [...new Set(userEvents.map(e => e.eventId))];

    if (eventIds.length === 0) return [];

    // Get last message for each event
    const chats = await Promise.all(
      eventIds.map(async (eventId) => {
        const [event] = await db.select().from(events).where(eq(events.id, eventId));
        const messages = await db
          .select()
          .from(chatMessages)
          .where(eq(chatMessages.eventId, eventId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(1);

        const unreadCount = await db
          .select({ count: count() })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.eventId, eventId),
              sql`${chatMessages.senderId} != ${userId}`
            )!
          );

        return {
          eventId,
          event,
          lastMessage: messages[0] || null,
          unreadCount: unreadCount[0]?.count || 0,
        };
      })
    );

    return chats.filter(chat => chat.lastMessage).map(chat => ({
      ...chat,
      lastMessage: chat.lastMessage!,
    }));
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
}

export const storage = new DatabaseStorage();
