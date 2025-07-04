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

export class SupabaseStorage implements IStorage {
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
    // Map camelCase fields to snake_case for database insertion
    const dbEvent = {
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
      current_players: 1, // Host is always playing
      price_per_person: event.pricePerPerson,
      sport_config: event.sportConfig,
      status: event.status || 'published',
      notes: event.notes
    };

    const { data, error } = await supabaseAdmin
      .from('events')
      .insert(dbEvent)
      .select()
      .single();

    if (error) throw error;
    
    // Return with camelCase mapping
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
      updatedAt: data.updated_at
    } as Event;
  }

  async getEvent(id: number): Promise<EventWithHost | undefined> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('Error fetching event:', error);
      return undefined;
    }

    console.log('Event data:', data);

    // Query the custom users table directly
    const { data: hostData, error: hostError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.host_id)
      .single();

    let host;
    if (hostError || !hostData) {
      console.error('Error fetching host from users table:', hostError);
      // Create a minimal host object as fallback
      host = {
        id: data.host_id,
        email: 'host@example.com',
        firstName: 'Host',
        lastName: 'User',
        profileImageUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      // Map database fields to expected structure
      host = {
        id: hostData.id,
        email: hostData.email,
        firstName: hostData.first_name || hostData.firstName,
        lastName: hostData.last_name || hostData.lastName,
        profileImageUrl: hostData.profile_image_url || hostData.profileImageUrl,
        stripeCustomerId: hostData.stripe_customer_id || hostData.stripeCustomerId,
        stripeSubscriptionId: hostData.stripe_subscription_id || hostData.stripeSubscriptionId,
        createdAt: hostData.created_at || hostData.createdAt,
        updatedAt: hostData.updated_at || hostData.updatedAt
      };
    }

    console.log('Host data:', host);

    // Get bookings for this event
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('event_id', id);

    if (bookingsError) throw bookingsError;

    // Calculate current players dynamically: host (1) + accepted bookings
    const acceptedBookings = bookings?.filter((b: any) => b.status === 'accepted') || [];
    const currentPlayers = 1 + acceptedBookings.length;

    // Return with proper camelCase mapping
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
      currentPlayers: currentPlayers,
      pricePerPerson: data.price_per_person,
      sportConfig: data.sport_config,
      status: data.status,
      notes: data.notes,
      requestedUsers: data.requested_users || [],
      acceptedUsers: data.accepted_users || [],
      rejectedUsers: data.rejected_users || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      host: host,
      bookings: bookings || [],
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
    // Simple direct query without complex joins to fix PostgREST issues
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('status', 'published')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;
    if (!events || events.length === 0) return [];

    // Get unique host IDs and fetch them separately
    const hostIds = [...new Set(events.map(event => event.host_id))];
    
    // Fetch host data separately with simple query
    const hostPromises = hostIds.map(async (hostId) => {
      const { data: host, error: hostError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', hostId)
        .single();
      
      return { hostId, host: hostError ? null : host };
    });

    const hostsData = await Promise.all(hostPromises);
    const hostMap = new Map();
    hostsData.forEach(({ hostId, host }) => {
      if (host) hostMap.set(hostId, host);
    });

    // Return events with host data and proper field mapping
    return events.map((event: any) => ({
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
      currentPlayers: event.current_players || 1,
      pricePerPerson: event.price_per_person,
      sportConfig: event.sport_config,
      status: event.status,
      notes: event.notes,
      requestedUsers: event.requested_users || [],
      acceptedUsers: event.accepted_users || [],
      rejectedUsers: event.rejected_users || [],
      createdAt: event.created_at,
      updatedAt: event.updated_at,
      host: hostMap.get(event.host_id) || { 
        id: event.host_id, 
        first_name: 'Unknown', 
        last_name: 'Host' 
      },
      bookings: [],
    })) as EventWithHost[];
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    // Map camelCase fields to snake_case for database update
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that are being updated
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.sport !== undefined) dbUpdates.sport = updates.sport;
    if (updates.skillLevel !== undefined) dbUpdates.skill_level = updates.skillLevel;
    if (updates.genderMix !== undefined) dbUpdates.gender_mix = updates.genderMix;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
    if (updates.maxPlayers !== undefined) dbUpdates.max_players = updates.maxPlayers;
    // currentPlayers is managed automatically through booking logic
    if (updates.pricePerPerson !== undefined) dbUpdates.price_per_person = updates.pricePerPerson;
    if (updates.sportConfig !== undefined) dbUpdates.sport_config = updates.sportConfig;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const { data, error } = await supabaseAdmin
      .from('events')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) return undefined;
    
    // Return with camelCase mapping
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
      updatedAt: data.updated_at
    } as Event;
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
      .select('*')
      .eq('host_id', hostId)
      .order('start_time', { ascending: false });

    if (error) throw error;

    // Get host info separately
    const { data: hostData } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', hostId)
      .single();

    // Get bookings for each event and map to expected format
    const eventsWithHost = await Promise.all((data || []).map(async (event: any) => {
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('event_id', event.id);

      const acceptedBookings = bookings?.filter((b: any) => b.status === 'accepted') || [];
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
        currentPlayers,
        pricePerPerson: event.price_per_person,
        sportConfig: event.sport_config,
        status: event.status,
        notes: event.notes,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        bookings: (bookings || []).map((b: any) => ({
          id: b.id,
          eventId: b.event_id,
          userId: b.user_id,
          status: b.status,
          paymentIntentId: b.payment_intent_id,
          amountPaid: b.amount_paid,
          createdAt: b.created_at,
          updatedAt: b.updated_at
        })),
        host: hostData ? {
          id: hostData.id,
          email: hostData.email,
          firstName: hostData.first_name,
          lastName: hostData.last_name,
          profileImageUrl: hostData.profile_image_url,
          stripeCustomerId: hostData.stripe_customer_id,
          stripeSubscriptionId: hostData.stripe_subscription_id,
          phoneVerified: hostData.phone_verified,
          idVerified: hostData.id_verified,
          bio: hostData.bio,
          createdAt: hostData.created_at,
          updatedAt: hostData.updated_at
        } : {
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
      };
    }));

    return eventsWithHost;
  }

  // Booking operations
  async createBooking(booking: InsertBooking): Promise<Booking> {
    // Add user to requested_users array in the event
    const { data: eventData, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('requested_users, accepted_users, rejected_users')
      .eq('id', booking.eventId)
      .single();

    if (fetchError) throw fetchError;

    const requestedUsers = [...(eventData.requested_users || [])];
    if (!requestedUsers.includes(booking.userId)) {
      requestedUsers.push(booking.userId);
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update({ requested_users: requestedUsers })
      .eq('id', booking.eventId)
      .select()
      .single();

    if (error) throw error;

    // Return a booking-like object for compatibility
    return {
      id: Date.now(), // Generate a temporary ID
      eventId: booking.eventId,
      userId: booking.userId,
      status: 'requested',
      paymentIntentId: booking.paymentIntentId,
      amountPaid: booking.amountPaid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Booking;
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
    // Get all events where user is in any of the participation arrays
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .or(`requested_users.cs.["${userId}"],accepted_users.cs.["${userId}"],rejected_users.cs.["${userId}"]`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const bookings: BookingWithEventAndUser[] = [];

    // Convert events to booking format
    for (const event of events || []) {
      let status: 'requested' | 'accepted' | 'rejected' = 'requested';
      
      if (event.accepted_users && event.accepted_users.includes(userId)) {
        status = 'accepted';
      } else if (event.rejected_users && event.rejected_users.includes(userId)) {
        status = 'rejected';
      } else if (event.requested_users && event.requested_users.includes(userId)) {
        status = 'requested';
      }

      // Get user data
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      bookings.push({
        id: `${event.id}-${userId}`,
        eventId: event.id,
        userId: userId,
        status: status,
        paymentIntentId: null,
        amountPaid: null,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        event: {
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
          currentPlayers: event.current_players,
          pricePerPerson: event.price_per_person,
          sportConfig: event.sport_config,
          status: event.status,
          notes: event.notes,
          createdAt: event.created_at,
          updatedAt: event.updated_at,
          requestedUsers: event.requested_users || [],
          acceptedUsers: event.accepted_users || [],
          rejectedUsers: event.rejected_users || [],
          host: {
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
        },
        user: userData ? {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          profileImageUrl: userData.profile_image_url,
          stripeCustomerId: userData.stripe_customer_id,
          stripeSubscriptionId: userData.stripe_subscription_id,
          phoneVerified: userData.phone_verified,
          idVerified: userData.id_verified,
          bio: userData.bio,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at
        } : {
          id: userId,
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
    }

    return bookings;
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
    // Get all events for this host that have requested users
    const { data: hostEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('host_id', hostId)
      .not('requested_users', 'is', null);

    if (eventsError) throw eventsError;

    if (!hostEvents || hostEvents.length === 0) return [];

    const bookings: BookingWithEventAndUser[] = [];

    // Convert requested users to booking format
    for (const event of hostEvents) {
      if (event.requested_users && event.requested_users.length > 0) {
        for (const userId of event.requested_users) {
          // Get user data
          const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (userError) continue;

          bookings.push({
            id: `${event.id}-${userId}`,
            eventId: event.id,
            userId: userId,
            status: 'requested' as const,
            paymentIntentId: null,
            amountPaid: null,
            createdAt: event.created_at,
            updatedAt: event.updated_at,
            event: {
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
              currentPlayers: event.current_players,
              pricePerPerson: event.price_per_person,
              sportConfig: event.sport_config,
              status: event.status,
              notes: event.notes,
              createdAt: event.created_at,
              updatedAt: event.updated_at,
              requestedUsers: event.requested_users || [],
              acceptedUsers: event.accepted_users || [],
              rejectedUsers: event.rejected_users || [],
              host: {
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
            },
            user: userData ? {
              id: userData.id,
              email: userData.email,
              firstName: userData.first_name,
              lastName: userData.last_name,
              profileImageUrl: userData.profile_image_url,
              stripeCustomerId: userData.stripe_customer_id,
              stripeSubscriptionId: userData.stripe_subscription_id,
              phoneVerified: userData.phone_verified,
              idVerified: userData.id_verified,
              bio: userData.bio,
              createdAt: userData.created_at,
              updatedAt: userData.updated_at
            } : {
              id: userId,
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
        }
      }
    }

    return bookings;
    
    // Map the response to the expected format
    return (data || []).map((booking: any) => ({
      id: booking.id,
      eventId: booking.event_id,
      userId: booking.user_id,
      status: booking.status,
      paymentIntentId: booking.payment_intent_id,
      amountPaid: booking.amount_paid,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
      event: booking.events ? {
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
        currentPlayers: booking.events.current_players || 1,
        pricePerPerson: booking.events.price_per_person,
        sportConfig: booking.events.sport_config,
        status: booking.events.status,
        notes: booking.events.notes,
        createdAt: booking.events.created_at,
        updatedAt: booking.events.updated_at,
        host: {
          id: hostId,
          email: '',
          firstName: 'Host',
          lastName: 'User',
          profileImageUrl: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } : {
        id: 0,
        hostId: hostId,
        title: '',
        description: '',
        sport: 'badminton' as const,
        skillLevel: 'beginner' as const,
        genderMix: 'mixed' as const,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        location: '',
        latitude: 0,
        longitude: 0,
        maxPlayers: 4,
        currentPlayers: 1,
        pricePerPerson: 0,
        sportConfig: {},
        status: 'published' as const,
        notes: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        host: {
          id: hostId,
          email: '',
          firstName: 'Host',
          lastName: 'User',
          profileImageUrl: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
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
        createdAt: booking.users.created_at,
        updatedAt: booking.users.updated_at
      } : {
        id: '',
        email: '',
        firstName: 'User',
        lastName: '',
        profileImageUrl: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }));
  }

  async updateBookingStatus(eventId: number, userId: string, status: string): Promise<Booking | undefined> {
    // Get current event data
    const { data: eventData, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('requested_users, accepted_users, rejected_users, current_players, max_players')
      .eq('id', eventId)
      .single();

    if (fetchError) return undefined;

    let requestedUsers = [...(eventData.requested_users || [])];
    let acceptedUsers = [...(eventData.accepted_users || [])];
    let rejectedUsers = [...(eventData.rejected_users || [])];
    let currentPlayers = eventData.current_players || 1;

    // Remove user from all arrays first
    const wasAccepted = acceptedUsers.includes(userId);
    requestedUsers = requestedUsers.filter(id => id !== userId);
    acceptedUsers = acceptedUsers.filter(id => id !== userId);
    rejectedUsers = rejectedUsers.filter(id => id !== userId);

    // Add user to appropriate array and adjust player count
    if (status === 'accepted') {
      acceptedUsers.push(userId);
      // Only increment if user wasn't already accepted
      if (!wasAccepted) {
        currentPlayers = Math.min(currentPlayers + 1, eventData.max_players);
      }
    } else if (status === 'rejected') {
      rejectedUsers.push(userId);
      // Decrement if user was previously accepted
      if (wasAccepted) {
        currentPlayers = Math.max(currentPlayers - 1, 1);
      }
    } else if (status === 'requested') {
      requestedUsers.push(userId);
      // Decrement if user was previously accepted
      if (wasAccepted) {
        currentPlayers = Math.max(currentPlayers - 1, 1);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('events')
      .update({ 
        requested_users: requestedUsers,
        accepted_users: acceptedUsers,
        rejected_users: rejectedUsers,
        current_players: currentPlayers
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) return undefined;

    // Return a booking-like object for compatibility
    return {
      id: Date.now(),
      eventId: eventId,
      userId: userId,
      status: status,
      paymentIntentId: null,
      amountPaid: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Booking;
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
    // Get all events where user is host or participant
    const { data: userEvents, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .or(`host_id.eq.${userId},requested_users.cs.["${userId}"],accepted_users.cs.["${userId}"],rejected_users.cs.["${userId}"]`);

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