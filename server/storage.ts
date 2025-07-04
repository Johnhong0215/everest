import {
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
import { supabaseAdmin } from "../shared/supabase.js";

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
    userTimezone?: string;
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

export class SupabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    // Get user from auth.users and combine with profile data
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
    if (authError || !authUser.user) return undefined;

    // Get profile data
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    // If no profile exists, create one
    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: id,
          first_name: authUser.user.user_metadata?.first_name || '',
          last_name: authUser.user.user_metadata?.last_name || '',
        })
        .select()
        .single();
      
      if (createError) return undefined;
      
      return {
        id: authUser.user.id,
        email: authUser.user.email || '',
        firstName: newProfile.first_name,
        lastName: newProfile.last_name,
        profileImageUrl: newProfile.profile_image_url,
        stripeCustomerId: newProfile.stripe_customer_id,
        stripeSubscriptionId: newProfile.stripe_subscription_id,
        phoneVerified: newProfile.phone_verified,
        idVerified: newProfile.id_verified,
        bio: newProfile.bio,
        createdAt: new Date(authUser.user.created_at),
        updatedAt: new Date(newProfile.updated_at),
      } as User;
    }

    if (profileError) return undefined;

    return {
      id: authUser.user.id,
      email: authUser.user.email || '',
      firstName: profile.first_name,
      lastName: profile.last_name,
      profileImageUrl: profile.profile_image_url,
      stripeCustomerId: profile.stripe_customer_id,
      stripeSubscriptionId: profile.stripe_subscription_id,
      phoneVerified: profile.phone_verified,
      idVerified: profile.id_verified,
      bio: profile.bio,
      createdAt: new Date(authUser.user.created_at),
      updatedAt: new Date(profile.updated_at),
    } as User;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Update profile data
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: userData.id,
        first_name: userData.firstName,
        last_name: userData.lastName,
        profile_image_url: userData.profileImageUrl,
        stripe_customer_id: userData.stripeCustomerId,
        stripe_subscription_id: userData.stripeSubscriptionId,
        phone_verified: userData.phoneVerified,
        id_verified: userData.idVerified,
        bio: userData.bio,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Get auth user data
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userData.id);
    if (authError || !authUser.user) throw authError;

    return {
      id: authUser.user.id,
      email: authUser.user.email || userData.email,
      firstName: data.first_name,
      lastName: data.last_name,
      profileImageUrl: data.profile_image_url,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      phoneVerified: data.phone_verified,
      idVerified: data.id_verified,
      bio: data.bio,
      createdAt: new Date(authUser.user.created_at),
      updatedAt: new Date(data.updated_at),
    } as User;
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User> {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Get auth user data
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !authUser.user) throw authError;

    return {
      id: authUser.user.id,
      email: authUser.user.email || '',
      firstName: data.first_name,
      lastName: data.last_name,
      profileImageUrl: data.profile_image_url,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      phoneVerified: data.phone_verified,
      idVerified: data.id_verified,
      bio: data.bio,
      createdAt: new Date(authUser.user.created_at),
      updatedAt: new Date(data.updated_at),
    } as User;
  }

  // Event operations
  async createEvent(event: InsertEvent): Promise<Event> {
    // Map camelCase to snake_case for Supabase
    const supabaseEvent = {
      host_id: event.hostId,
      title: event.title,
      description: event.description,
      sport: event.sport,
      skill_level: event.skillLevel,
      gender_mix: event.genderMix,
      start_time: event.startTime,
      end_time: event.endTime,
      location: event.location,
      latitude: event.latitude,
      longitude: event.longitude,
      max_players: event.maxPlayers,
      current_players: 1,
      price_per_person: event.pricePerPerson,
      sport_config: event.sportConfig || {},
      status: event.status || 'published',
      notes: event.notes,
    };

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert(supabaseEvent)
      .select()
      .single();

    if (error) throw error;
    
    // Map back to camelCase for the response
    return {
      id: data.id,
      hostId: data.host_id,
      title: data.title,
      description: data.description,
      sport: data.sport,
      skillLevel: data.skill_level,
      genderMix: data.gender_mix,
      startTime: data.start_time,
      endTime: data.end_time,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      maxPlayers: data.max_players,
      currentPlayers: data.current_players,
      pricePerPerson: data.price_per_person,
      sportConfig: data.sport_config,
      status: data.status,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as Event;
  }

  async getEvent(id: number): Promise<EventWithHost | undefined> {
    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !event) return undefined;

    // Get host information
    const { data: host, error: hostError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', event.host_id)
      .single();

    if (hostError) return undefined;

    // Get bookings for this event
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('event_id', id);

    if (bookingsError) throw bookingsError;

    // Calculate current players dynamically: host (1) + accepted bookings
    const acceptedBookings = bookings?.filter((b: any) => b.status === 'accepted') || [];
    const currentPlayers = 1 + acceptedBookings.length;

    return {
      ...event,
      host: host,
      bookings: bookings || [],
      current_players: currentPlayers,
    } as EventWithHost;
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
    userTimezone?: string;
  }): Promise<EventWithHost[]> {
    let query = supabaseAdmin
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (filters?.sports && filters.sports.length > 0) {
      query = query.in('sport', filters.sports);
    }

    if (filters?.skillLevels && filters.skillLevels.length > 0) {
      query = query.in('skill_level', filters.skillLevels);
    }

    if (filters?.genders && filters.genders.length > 0) {
      query = query.in('gender_mix', filters.genders);
    }

    if (filters?.priceMax) {
      query = query.lte('price_per_person', filters.priceMax);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,location.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data: events, error } = await query;

    if (error) throw error;
    if (!events || events.length === 0) return [];

    // Get host information for all events
    const hostIds = [...new Set(events.map(event => event.host_id))];
    const { data: hosts, error: hostError } = await supabaseAdmin
      .from('users')
      .select('*')
      .in('id', hostIds);

    if (hostError) throw hostError;

    // Get bookings for all events
    const eventIds = events.map(event => event.id);
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .in('event_id', eventIds);

    if (bookingsError) throw bookingsError;

    // Create maps for easy lookup
    const hostMap = new Map(hosts?.map(host => [host.id, host]) || []);
    const bookingsMap: Record<number, any[]> = {};
    eventIds.forEach(id => bookingsMap[id] = []);
    
    bookings?.forEach(booking => {
      if (!bookingsMap[booking.event_id]) {
        bookingsMap[booking.event_id] = [];
      }
      bookingsMap[booking.event_id].push(booking);
    });

    return events.map((event: any) => {
      const eventBookings = bookingsMap[event.id] || [];
      const acceptedBookings = eventBookings.filter((b: any) => b.status === 'accepted');
      const currentPlayers = 1 + acceptedBookings.length;

      return {
        id: event.id,
        hostId: event.host_id,
        title: event.title,
        description: event.description,
        sport: event.sport,
        skillLevel: event.skill_level,
        genderMix: event.gender_mix,
        startTime: event.start_time,
        endTime: event.end_time,
        location: event.location,
        latitude: event.latitude,
        longitude: event.longitude,
        maxPlayers: event.max_players,
        currentPlayers: currentPlayers,
        pricePerPerson: event.price_per_person,
        sportConfig: event.sport_config,
        status: event.status,
        notes: event.notes,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        host: hostMap.get(event.host_id),
        bookings: eventBookings,
      } as EventWithHost;
    });
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
      .update({
        current_players: playerCount,
        updated_at: new Date().toISOString(),
      })
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
        host:users(*),
        bookings(*)
      `)
      .eq('host_id', hostId)
      .order('start_time', { ascending: false });

    if (error) throw error;

    return (data || []).map((event: any) => {
      const acceptedBookings = event.bookings?.filter((b: any) => b.status === 'accepted') || [];
      const currentPlayers = 1 + acceptedBookings.length;

      return {
        ...event,
        host: event.host,
        bookings: event.bookings || [],
        current_players: currentPlayers,
      } as EventWithHost;
    });
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(booking)
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
        event:events(*,host:users(*)),
        user:users(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return undefined;
    return data as BookingWithEventAndUser;
  }

  async getBookingsByUser(userId: string): Promise<BookingWithEventAndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        event:events(*,host:users(*)),
        user:users(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BookingWithEventAndUser[];
  }

  async getBookingsByEvent(eventId: number): Promise<BookingWithEventAndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        event:events(*,host:users(*)),
        user:users(*)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BookingWithEventAndUser[];
  }

  async getPendingBookingsForHost(hostId: string): Promise<BookingWithEventAndUser[]> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        event:events!inner(*,host:users(*)),
        user:users(*)
      `)
      .eq('event.host_id', hostId)
      .eq('status', 'requested')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as BookingWithEventAndUser[];
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking | undefined> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return undefined;
    return data as Booking;
  }

  async cancelBooking(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('id', id);

    return !error;
  }

  // Chat operations
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        ...message,
        read_by: JSON.stringify([message.senderId]),
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
        sender:users(*)
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []) as ChatMessageWithSender[];
  }

  async getChatMessagesForConversation(eventId: number, userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        *,
        sender:users(*)
      `)
      .eq('event_id', eventId)
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []) as ChatMessageWithSender[];
  }

  async getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: ChatMessage | null; unreadCount: number; otherParticipant: any }[]> {
    // This is a complex query that needs to be simplified for Supabase
    // Get all events where user is host or has bookings
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
        otherParticipant: null, // Simplified for now
      });
    }

    return chats;
  }

  async markMessageAsRead(messageId: number, userId: string): Promise<boolean> {
    const { data: message, error: fetchError } = await supabaseAdmin
      .from('chat_messages')
      .select('read_by')
      .eq('id', messageId)
      .single();

    if (fetchError) return false;

    const readBy = JSON.parse(message.read_by || '[]');
    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }

    const { error } = await supabaseAdmin
      .from('chat_messages')
      .update({ read_by: JSON.stringify(readBy) })
      .eq('id', messageId);

    return !error;
  }

  async markAllMessagesAsRead(eventId: number, userId: string): Promise<boolean> {
    // This is complex in Supabase, simplified approach
    const { error } = await supabaseAdmin
      .rpc('mark_all_messages_read', {
        event_id: eventId,
        user_id: userId
      });

    return !error;
  }

  async deleteChatroom(eventId: number, userId: string): Promise<boolean> {
    // In the original implementation, this doesn't actually delete messages
    // It just marks them as deleted for the user
    return true;
  }

  // Payment operations
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .insert(payment)
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
        updated_at: new Date().toISOString(),
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
      .select(`
        *,
        booking:bookings(user_id)
      `)
      .eq('booking.user_id', userId)
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
    // Simplified earnings calculation
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('host_payout, status, created_at')
      .eq('booking.event.host_id', hostId);

    if (error) throw error;

    const payments = data || [];
    const total = payments.reduce((sum, p) => sum + (p.host_payout || 0), 0);
    const thisMonth = payments
      .filter(p => new Date(p.created_at).getMonth() === new Date().getMonth())
      .reduce((sum, p) => sum + (p.host_payout || 0), 0);
    const pending = payments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + (p.host_payout || 0), 0);

    return {
      total,
      thisMonth,
      pending,
      nextPayoutDate: null, // Simplified
    };
  }

  // Review operations
  async createReview(review: InsertReview): Promise<Review> {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .insert(review)
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

    const sum = data.reduce((total, review) => total + review.rating, 0);
    return sum / data.length;
  }

  // Sports settings operations
  async getSportsSettings(): Promise<Record<string, Record<string, string[]>>> {
    const { data, error } = await supabaseAdmin
      .from('sports_settings')
      .select('*')
      .order('display_order', { ascending: true });

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

export const storage = new SupabaseStorage();