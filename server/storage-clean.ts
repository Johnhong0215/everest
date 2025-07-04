import { createClient } from '@supabase/supabase-js';
import type { 
  User, 
  UpsertUser, 
  Event, 
  InsertEvent, 
  EventWithHost,
  Booking,
  InsertBooking,
  BookingWithEventAndUser,
  ChatMessage,
  InsertChatMessage,
  ChatMessageWithSender,
  Payment,
  InsertPayment,
  Review,
  InsertReview
} from '../shared/schema.ts';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User>;

  // Event operations
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: number): Promise<EventWithHost | undefined>;
  getEvents(filters?: any): Promise<EventWithHost[]>;
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
  updateBookingStatus(eventId: number, userId: string, status: string): Promise<Booking | undefined>;
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

export class CleanSupabaseStorage implements IStorage {
  private mapBookingResponse = (booking: any): BookingWithEventAndUser => ({
    id: booking.id,
    eventId: booking.event_id,
    userId: booking.user_id,
    status: booking.status,
    paymentIntentId: booking.payment_intent_id,
    amountPaid: booking.amount_paid,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
    event: {
      id: booking.events.id,
      hostId: booking.events.host_id,
      title: booking.events.title,
      description: booking.events.description,
      sport: booking.events.sport,
      skillLevel: booking.events.skill_level,
      genderMix: booking.events.gender_mix,
      startTime: booking.events.start_time,
      endTime: booking.events.end_time,
      location: booking.events.location,
      latitude: booking.events.latitude,
      longitude: booking.events.longitude,
      maxPlayers: booking.events.max_players,
      currentPlayers: booking.events.current_players,
      pricePerPerson: booking.events.price_per_person,
      sportConfig: booking.events.sport_config,
      status: booking.events.status,
      notes: booking.events.notes,
      createdAt: booking.events.created_at,
      updatedAt: booking.events.updated_at,
      host: {
        id: booking.events.host_id,
        email: '',
        firstName: 'Host',
        lastName: 'User',
        profileImageUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        phoneVerified: false,
        idVerified: false,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    },
    user: booking.users ? {
      id: booking.users.id,
      email: booking.users.email,
      firstName: booking.users.first_name,
      lastName: booking.users.last_name,
      profileImageUrl: booking.users.profile_image_url,
      stripeCustomerId: booking.users.stripe_customer_id,
      stripeSubscriptionId: booking.users.stripe_subscription_id,
      phoneVerified: booking.users.phone_verified,
      idVerified: booking.users.id_verified,
      bio: booking.users.bio,
      createdAt: booking.users.created_at,
      updatedAt: booking.users.updated_at
    } : {
      id: booking.user_id,
      email: '',
      firstName: 'User',
      lastName: '',
      profileImageUrl: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      phoneVerified: false,
      idVerified: false,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        ...userData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as User;
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  }

  // Event operations
  async createEvent(event: InsertEvent): Promise<Event> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        ...event,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Event;
  }

  async getEvent(id: number): Promise<EventWithHost | undefined> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select(`
        *,
        users(*)
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    
    return {
      ...data,
      host: data.users || {
        id: data.host_id,
        email: '',
        firstName: 'Host',
        lastName: 'User',
        profileImageUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        phoneVerified: false,
        idVerified: false,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    } as EventWithHost;
  }

  async getEvents(filters?: any): Promise<EventWithHost[]> {
    let query = supabaseAdmin
      .from('events')
      .select(`
        *,
        users(*)
      `)
      .order('start_time', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(event => ({
      ...event,
      host: event.users || {
        id: event.host_id,
        email: '',
        firstName: 'Host',
        lastName: 'User',
        profileImageUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        phoneVerified: false,
        idVerified: false,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })) as EventWithHost[];
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return undefined;
    return data as Event;
  }

  async updateEventPlayerCount(id: number, playerCount: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('events')
      .update({ current_players: playerCount })
      .eq('id', id);

    return !error;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', id);

    return !error;
  }

  async getEventsByHost(hostId: string): Promise<EventWithHost[]> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select(`
        *,
        users(*)
      `)
      .eq('host_id', hostId)
      .order('start_time', { ascending: true });

    if (error) throw error;

    return (data || []).map(event => ({
      ...event,
      host: event.users || {
        id: hostId,
        email: '',
        firstName: 'Host',
        lastName: 'User',
        profileImageUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        phoneVerified: false,
        idVerified: false,
        bio: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })) as EventWithHost[];
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert({
        ...booking,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Booking;
  }

  async getBooking(id: number): Promise<BookingWithEventAndUser | undefined> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        events(*),
        users(*)
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return this.mapBookingResponse(data);
  }

  async getBookingsByUser(userId: string): Promise<BookingWithEventAndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        events(*),
        users(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapBookingResponse);
  }

  async getBookingsByEvent(eventId: number): Promise<BookingWithEventAndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        events(*),
        users(*)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapBookingResponse);
  }

  async getPendingBookingsForHost(hostId: string): Promise<BookingWithEventAndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        events!inner(*),
        users(*)
      `)
      .eq('events.host_id', hostId)
      .eq('status', 'requested')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapBookingResponse);
  }

  async updateBookingStatus(eventId: number, userId: string, status: string): Promise<Booking | undefined> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status,
        updated_at: new Date().toISOString() 
      })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) return undefined;
    return data as Booking;
  }

  async cancelBooking(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString() 
      })
      .eq('id', id);

    return !error;
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        ...message,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as ChatMessage;
  }

  async getChatMessages(eventId: number, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        *,
        sender:users!sender_id(*)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []) as ChatMessageWithSender[];
  }

  async getChatMessagesForConversation(eventId: number, userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        *,
        sender:users!sender_id(*)
      `)
      .eq('event_id', eventId)
      .or(`sender_id.eq.${userId1},sender_id.eq.${userId2}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []) as ChatMessageWithSender[];
  }

  async getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: ChatMessage | null; unreadCount: number; otherParticipant: any }[]> {
    // Get events where user is host or has bookings
    const { data: userEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .or(`host_id.eq.${userId},bookings.user_id.eq.${userId}`);

    if (eventsError) throw eventsError;

    const chats = [];
    for (const event of userEvents || []) {
      const { data: messages, error: messagesError } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (messagesError) continue;

      const lastMessage = messages?.[0] || null;
      
      // Count unread messages
      const { count: unreadCount } = await supabaseAdmin
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .neq('sender_id', userId)
        .not('read_by', 'cs', `["${userId}"]`);

      chats.push({
        eventId: event.id,
        event,
        lastMessage,
        unreadCount: unreadCount || 0,
        otherParticipant: null,
      });
    }

    return chats;
  }

  async markMessageAsRead(messageId: number, userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('chat_messages')
      .update({
        read_by: [userId]
      })
      .eq('id', messageId);

    return !error;
  }

  async markAllMessagesAsRead(eventId: number, userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('chat_messages')
      .update({
        read_by: [userId]
      })
      .eq('event_id', eventId)
      .neq('sender_id', userId);

    return !error;
  }

  async deleteChatroom(eventId: number, userId: string): Promise<boolean> {
    // This might need custom logic based on requirements
    return true;
  }

  // Payment operations
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert({
        ...payment,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Payment;
  }

  async updatePaymentStatus(id: number, status: string, payoutDate?: Date): Promise<Payment | undefined> {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .update({ 
        status,
        payout_date: payoutDate?.toISOString(),
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return undefined;
    return data as Payment;
  }

  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Payment[];
  }

  async getEarnings(hostId: string): Promise<{
    total: number;
    thisMonth: number;
    pending: number;
    nextPayoutDate: Date | null;
  }> {
    // Placeholder implementation
    return {
      total: 0,
      thisMonth: 0,
      pending: 0,
      nextPayoutDate: null,
    };
  }

  // Review operations
  async createReview(review: InsertReview): Promise<Review> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert({
        ...review,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data as Review;
  }

  async getReviewsForUser(userId: string): Promise<Review[]> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Review[];
  }

  async getUserRating(userId: string): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', userId);

    if (error || !data || data.length === 0) return 0;
    
    const sum = data.reduce((acc, review) => acc + review.rating, 0);
    return sum / data.length;
  }

  // Sports settings operations
  async getSportsSettings(): Promise<Record<string, Record<string, string[]>>> {
    const { data, error } = await supabaseAdmin
      .from('sports_settings')
      .select('*')
      .order('display_order');

    if (error) throw error;

    const settings: Record<string, Record<string, string[]>> = {};
    
    for (const setting of data || []) {
      if (!settings[setting.sport]) {
        settings[setting.sport] = {};
      }
      if (!settings[setting.sport][setting.setting_key]) {
        settings[setting.sport][setting.setting_key] = [];
      }
      settings[setting.sport][setting.setting_key].push(setting.setting_value);
    }

    return settings;
  }
}

export const storage = new CleanSupabaseStorage();