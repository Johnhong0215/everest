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

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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

  // Booking operations (using event participant arrays)
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

export class ArraySupabaseStorage implements IStorage {
  
  async getUser(id: string): Promise<User | undefined> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) return undefined;
      return data as User;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: userData.id,
          email: userData.email,
          name: userData.name,
          avatar_url: userData.avatarUrl,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw new Error(`User upsert failed: ${error.message}`);
      return data as User;
    } catch (error) {
      console.error('Error upserting user:', error);
      throw error;
    }
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId?: string): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw new Error(`User stripe update failed: ${error.message}`);
      return data as User;
    } catch (error) {
      console.error('Error updating user stripe info:', error);
      throw error;
    }
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
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
          current_players: event.currentPlayers || 1,
          price_per_person: event.pricePerPerson,
          sport_config: event.sportConfig,
          status: event.status || 'published',
          notes: event.notes,
          requested_users: [],
          accepted_users: [],
          rejected_users: []
        })
        .select()
        .single();

      if (error) throw new Error(`Event creation failed: ${error.message}`);
      return data as Event;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async getEvent(id: number): Promise<EventWithHost | undefined> {
    try {
      const { data: event, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !event) return undefined;

      // Fetch host separately to avoid foreign key issues
      const { data: host } = await supabase
        .from('users')
        .select('*')
        .eq('id', event.host_id)
        .single();

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
        latitude: parseFloat(event.latitude) || 0,
        longitude: parseFloat(event.longitude) || 0,
        maxPlayers: event.max_players,
        currentPlayers: event.current_players || 1,
        pricePerPerson: parseFloat(event.price_per_person) || 0,
        sportConfig: event.sport_config || {},
        status: event.status,
        notes: event.notes,
        createdAt: new Date(event.created_at),
        updatedAt: new Date(event.updated_at),
        requestedUsers: event.requested_users || [],
        acceptedUsers: event.accepted_users || [],
        rejectedUsers: event.rejected_users || [],
        host: host || {
          id: event.host_id?.toString() || '',
          email: '',
          firstName: 'Unknown',
          lastName: 'Host',
          profileImageUrl: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          phoneVerified: false,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      } as EventWithHost;
    } catch (error) {
      console.error('Error fetching event:', error);
      return undefined;
    }
  }

  async getEvents(filters?: any): Promise<EventWithHost[]> {
    try {
      let query = supabase
        .from('events')
        .select('*')
        .gte('start_time', new Date().toISOString()) // Only show future events
        .eq('status', 'published');

      if (filters?.sports?.length) {
        query = query.in('sport', filters.sports);
      }

      const { data: events, error } = await query;

      if (error) throw new Error(`Events fetch failed: ${error.message}`);
      if (!events) return [];

      console.log(`Found ${events.length} events from database:`, events.map(e => ({ id: e.id, title: e.title })));

      // Map events to expected format without host lookup for now
      return events.map(event => ({
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
        latitude: parseFloat(event.latitude) || 0,
        longitude: parseFloat(event.longitude) || 0,
        maxPlayers: event.max_players,
        currentPlayers: event.current_players || 1,
        pricePerPerson: parseFloat(event.price_per_person) || 0,
        sportConfig: event.sport_config || {},
        status: event.status,
        notes: event.notes,
        createdAt: new Date(event.created_at),
        updatedAt: new Date(event.updated_at),
        requestedUsers: event.requested_users || [],
        acceptedUsers: event.accepted_users || [],
        rejectedUsers: event.rejected_users || [],
        host: {
          id: event.host_id?.toString() || '',
          email: '',
          firstName: 'Unknown',
          lastName: 'Host',
          profileImageUrl: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          phoneVerified: false,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })) as EventWithHost[];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async updateEvent(id: number, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    try {
      const updateData: any = {};
      
      if (updates.title) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.sport) updateData.sport = updates.sport;
      if (updates.skillLevel) updateData.skill_level = updates.skillLevel;
      if (updates.genderMix) updateData.gender_mix = updates.genderMix;
      if (updates.startTime) updateData.start_time = updates.startTime;
      if (updates.endTime) updateData.end_time = updates.endTime;
      if (updates.location) updateData.location = updates.location;
      if (updates.latitude) updateData.latitude = updates.latitude;
      if (updates.longitude) updateData.longitude = updates.longitude;
      if (updates.maxPlayers) updateData.max_players = updates.maxPlayers;
      if (updates.currentPlayers !== undefined) updateData.current_players = updates.currentPlayers;
      if (updates.pricePerPerson !== undefined) updateData.price_per_person = updates.pricePerPerson;
      if (updates.sportConfig) updateData.sport_config = updates.sportConfig;
      if (updates.status) updateData.status = updates.status;
      if (updates.notes !== undefined) updateData.notes = updates.notes;
      
      // Handle participant arrays - cast updates to any to access these fields
      const anyUpdates = updates as any;
      if (anyUpdates.requestedUsers !== undefined) updateData.requested_users = anyUpdates.requestedUsers;
      if (anyUpdates.acceptedUsers !== undefined) updateData.accepted_users = anyUpdates.acceptedUsers;
      if (anyUpdates.rejectedUsers !== undefined) updateData.rejected_users = anyUpdates.rejectedUsers;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Event update failed: ${error.message}`);
      return data as Event;
    } catch (error) {
      console.error('Error updating event:', error);
      return undefined;
    }
  }

  async updateEventPlayerCount(id: number, playerCount: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('events')
        .update({ 
          current_players: playerCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      return !error;
    } catch (error) {
      console.error('Error updating event player count:', error);
      return false;
    }
  }

  async deleteEvent(id: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      return !error;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  async getEventsByHost(hostId: string): Promise<EventWithHost[]> {
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', hostId);

      if (error) throw new Error(`Host events fetch failed: ${error.message}`);
      if (!events) return [];

      // Fetch host information separately 
      const { data: host } = await supabase
        .from('users')
        .select('*')
        .eq('id', hostId)
        .single();

      return events.map(event => ({
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
        latitude: parseFloat(event.latitude) || 0,
        longitude: parseFloat(event.longitude) || 0,
        maxPlayers: event.max_players,
        currentPlayers: event.current_players || 1,
        pricePerPerson: parseFloat(event.price_per_person) || 0,
        sportConfig: event.sport_config || {},
        status: event.status,
        notes: event.notes,
        createdAt: new Date(event.created_at),
        updatedAt: new Date(event.updated_at),
        requestedUsers: event.requested_users || [],
        acceptedUsers: event.accepted_users || [],
        rejectedUsers: event.rejected_users || [],
        host: host || {
          id: hostId,
          email: '',
          firstName: 'Unknown',
          lastName: 'Host',
          profileImageUrl: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          phoneVerified: false,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })) as EventWithHost[];
    } catch (error) {
      console.error('Error fetching host events:', error);
      return [];
    }
  }

  // Booking operations using participant arrays
  async createBooking(booking: InsertBooking): Promise<Booking> {
    try {
      // Add user to requested_users array
      const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('requested_users')
        .eq('id', booking.eventId)
        .single();

      if (fetchError) throw new Error(`Event fetch failed: ${fetchError.message}`);

      const requestedUsers = event.requested_users || [];
      if (!requestedUsers.includes(booking.userId)) {
        requestedUsers.push(booking.userId);
      }

      const { error: updateError } = await supabase
        .from('events')
        .update({ 
          requested_users: requestedUsers,
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.eventId);

      if (updateError) throw new Error(`Event update failed: ${updateError.message}`);

      // Return a simulated booking object
      return {
        id: Date.now(), // Generate a unique ID
        eventId: booking.eventId,
        userId: booking.userId,
        status: 'requested',
        paymentIntentId: booking.paymentIntentId || null,
        amountPaid: booking.amountPaid || null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Booking;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  async getBooking(id: number): Promise<BookingWithEventAndUser | undefined> {
    // For participant arrays approach, we don't store individual bookings
    // This would need to be implemented differently
    return undefined;
  }

  async getBookingsByUser(userId: string): Promise<BookingWithEventAndUser[]> {
    try {
      // Find events where user is in any participant array
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .or(`requested_users.cs.{${userId}},accepted_users.cs.{${userId}},rejected_users.cs.{${userId}}`);

      if (error) throw new Error(`User bookings fetch failed: ${error.message}`);
      if (!events) return [];

      // Convert to BookingWithEventAndUser format
      const bookings: BookingWithEventAndUser[] = [];
      
      for (const event of events) {
        let status = 'requested';
        if (event.accepted_users?.includes(userId)) status = 'accepted';
        else if (event.rejected_users?.includes(userId)) status = 'rejected';

        // Fetch host separately
        const { data: host } = await supabase
          .from('users')
          .select('*')
          .eq('id', event.host_id)
          .single();

        // Fetch user separately  
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        bookings.push({
          id: event.id,
          eventId: event.id,
          userId: userId,
          status: status as any,
          paymentIntentId: null,
          amountPaid: null,
          createdAt: new Date(event.created_at),
          updatedAt: new Date(event.updated_at),
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
            latitude: parseFloat(event.latitude) || 0,
            longitude: parseFloat(event.longitude) || 0,
            maxPlayers: event.max_players,
            currentPlayers: event.current_players || 1,
            pricePerPerson: parseFloat(event.price_per_person) || 0,
            sportConfig: event.sport_config || {},
            status: event.status,
            notes: event.notes,
            createdAt: new Date(event.created_at),
            updatedAt: new Date(event.updated_at),
            requestedUsers: event.requested_users || [],
            acceptedUsers: event.accepted_users || [],
            rejectedUsers: event.rejected_users || [],
            host: host || {
              id: event.host_id?.toString() || '',
              email: '',
              firstName: 'Unknown',
              lastName: 'Host',
              profileImageUrl: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              phoneVerified: false,
              emailVerified: false,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          } as EventWithHost,
          user: user || {
            id: userId,
            email: '',
            firstName: 'Unknown',
            lastName: 'User',
            profileImageUrl: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            phoneVerified: false,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date()
          } as User
        });
      }

      return bookings;
    } catch (error) {
      console.error('Error fetching user bookings:', error);
      return [];
    }
  }

  async getBookingsByEvent(eventId: number): Promise<BookingWithEventAndUser[]> {
    try {
      const { data: event, error } = await supabase
        .from('events')
        .select(`
          *,
          host:host_id(*)
        `)
        .eq('id', eventId)
        .single();

      if (error || !event) return [];

      const bookings: BookingWithEventAndUser[] = [];
      const allUsers = [
        ...(event.requested_users || []).map((uid: string) => ({ userId: uid, status: 'requested' })),
        ...(event.accepted_users || []).map((uid: string) => ({ userId: uid, status: 'accepted' })),
        ...(event.rejected_users || []).map((uid: string) => ({ userId: uid, status: 'rejected' }))
      ];

      for (const { userId, status } of allUsers) {
        // Fetch user details
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (user) {
          bookings.push({
            id: event.id,
            eventId: event.id,
            userId: userId,
            status: status as any,
            paymentIntentId: null,
            amountPaid: null,
            createdAt: new Date(event.created_at),
            updatedAt: new Date(event.updated_at),
            event: {
              ...event,
              hostId: event.host_id,
              skillLevel: event.skill_level,
              genderMix: event.gender_mix,
              startTime: event.start_time,
              endTime: event.end_time,
              maxPlayers: event.max_players,
              currentPlayers: event.current_players,
              pricePerPerson: event.price_per_person,
              sportConfig: event.sport_config,
              createdAt: event.created_at,
              updatedAt: event.updated_at,
              requestedUsers: event.requested_users || [],
              acceptedUsers: event.accepted_users || [],
              rejectedUsers: event.rejected_users || [],
              host: event.host
            } as EventWithHost,
            user: user as User
          });
        }
      }

      return bookings;
    } catch (error) {
      console.error('Error fetching event bookings:', error);
      return [];
    }
  }

  async getPendingBookingsForHost(hostId: string): Promise<BookingWithEventAndUser[]> {
    try {
      // Get events where user is host and there are requested users
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('host_id', hostId)
        .not('requested_users', 'is', null);

      if (error) throw new Error(`Pending bookings fetch failed: ${error.message}`);
      if (!events) return [];

      const pendingBookings: BookingWithEventAndUser[] = [];

      for (const event of events) {
        if (event.requested_users && event.requested_users.length > 0) {
          for (const userId of event.requested_users) {
            // Fetch user details separately
            const { data: user } = await supabase
              .from('users')
              .select('*')
              .eq('id', userId)
              .single();

            // Fetch host details separately  
            const { data: host } = await supabase
              .from('users')
              .select('*')
              .eq('id', hostId)
              .single();

            if (user) {
              pendingBookings.push({
                id: event.id,
                eventId: event.id,
                userId: userId,
                status: 'requested' as any,
                paymentIntentId: null,
                amountPaid: null,
                createdAt: new Date(event.created_at),
                updatedAt: new Date(event.updated_at),
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
                  latitude: parseFloat(event.latitude) || 0,
                  longitude: parseFloat(event.longitude) || 0,
                  maxPlayers: event.max_players,
                  currentPlayers: event.current_players || 1,
                  pricePerPerson: parseFloat(event.price_per_person) || 0,
                  sportConfig: event.sport_config || {},
                  status: event.status,
                  notes: event.notes,
                  createdAt: new Date(event.created_at),
                  updatedAt: new Date(event.updated_at),
                  requestedUsers: event.requested_users || [],
                  acceptedUsers: event.accepted_users || [],
                  rejectedUsers: event.rejected_users || [],
                  host: host || {
                    id: hostId,
                    email: '',
                    firstName: 'Unknown',
                    lastName: 'Host',
                    profileImageUrl: null,
                    stripeCustomerId: null,
                    stripeSubscriptionId: null,
                    phoneVerified: false,
                    emailVerified: false,
                    idVerified: false,
                    bio: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }
                } as EventWithHost,
                user: user as User
              });
            }
          }
        }
      }

      return pendingBookings;
    } catch (error) {
      console.error('Error fetching pending bookings:', error);
      return [];
    }
  }

  async updateBookingStatus(eventId: number, userId: string, status: string): Promise<Booking | undefined> {
    try {
      const { data: event, error: fetchError } = await supabase
        .from('events')
        .select('requested_users, accepted_users, rejected_users, current_players, max_players')
        .eq('id', eventId)
        .single();

      if (fetchError) throw new Error(`Event fetch failed: ${fetchError.message}`);

      let requestedUsers = event.requested_users || [];
      let acceptedUsers = event.accepted_users || [];
      let rejectedUsers = event.rejected_users || [];
      let currentPlayers = event.current_players || 1;

      // Remove user from all arrays first
      requestedUsers = requestedUsers.filter((id: string) => id !== userId);
      acceptedUsers = acceptedUsers.filter((id: string) => id !== userId);
      rejectedUsers = rejectedUsers.filter((id: string) => id !== userId);

      // Add to appropriate array and update player count
      if (status === 'accepted') {
        acceptedUsers.push(userId);
        currentPlayers = 1 + acceptedUsers.length; // Host + accepted users
      } else if (status === 'rejected') {
        rejectedUsers.push(userId);
      } else if (status === 'requested') {
        requestedUsers.push(userId);
      }

      const { error: updateError } = await supabase
        .from('events')
        .update({
          requested_users: requestedUsers,
          accepted_users: acceptedUsers,
          rejected_users: rejectedUsers,
          current_players: currentPlayers,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (updateError) throw new Error(`Booking status update failed: ${updateError.message}`);

      return {
        id: eventId,
        eventId: eventId,
        userId: userId,
        status: status as any,
        paymentIntentId: null,
        amountPaid: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Booking;
    } catch (error) {
      console.error('Error updating booking status:', error);
      return undefined;
    }
  }

  async cancelBooking(id: number): Promise<boolean> {
    // For participant arrays, this would remove user from all arrays
    // Implementation depends on how you want to handle cancellations
    return true;
  }

  // Chat operations - these remain the same as they don't depend on bookings
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    try {
      // Use the correct column name 'content' based on actual database structure
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          event_id: message.eventId,
          sender_id: message.senderId,
          receiver_id: message.receiverId,
          content: message.content, // Use 'content' column as confirmed by database inspection
          message_type: message.messageType || 'text',
          metadata: message.metadata || null,
          read_by: JSON.stringify([message.senderId]), // Mark as read by sender
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw new Error(`Chat message creation failed: ${error.message}`);
      
      return {
        id: data.id,
        eventId: data.event_id,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        content: data.content, // Use content field directly
        messageType: data.message_type,
        metadata: data.metadata,
        readBy: JSON.parse(data.read_by || '[]'),
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at || data.created_at)
      } as ChatMessage;
    } catch (error) {
      console.error('Error creating chat message:', error);
      throw error;
    }
  }

  async getChatMessages(eventId: number, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    try {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(`Chat messages fetch failed: ${error.message}`);
      if (!messages) return [];

      // Fetch sender information separately for each message
      const messagesWithSenders = [];
      for (const msg of messages) {
        const { data: sender } = await supabase
          .from('users')
          .select('*')
          .eq('id', msg.sender_id)
          .single();

        messagesWithSenders.push({
          id: msg.id,
          eventId: msg.event_id,
          senderId: msg.sender_id,
          receiverId: msg.receiver_id,
          content: msg.content, // Use 'content' column from database
          messageType: msg.message_type,
          metadata: msg.metadata,
          readBy: msg.read_by || [],
          createdAt: new Date(msg.created_at),
          updatedAt: new Date(msg.updated_at),
          sender: sender || {
            id: msg.sender_id,
            email: '',
            firstName: 'Unknown',
            lastName: 'User',
            profileImageUrl: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            phoneVerified: false,
            emailVerified: false,
            idVerified: false,
            bio: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      return messagesWithSenders as ChatMessageWithSender[];
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
  }

  async getChatMessagesForConversation(eventId: number, userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    // Same as getChatMessages for event-based chat
    return this.getChatMessages(eventId, limit, offset);
  }

  async getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: ChatMessage | null; unreadCount: number; otherParticipant: any }[]> {
    try {
      // Get events where user is host or participant
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .or(`host_id.eq.${userId},accepted_users.cs.{${userId}}`);

      if (error || !events) return [];

      const chats = [];
      for (const event of events) {
        // Get last message for this event
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('event_id', event.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Count unread messages
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .not('read_by', 'cs', `{${userId}}`);

        chats.push({
          eventId: event.id,
          event: event as Event,
          lastMessage: lastMessage ? {
            ...lastMessage,
            eventId: lastMessage.event_id,
            senderId: lastMessage.sender_id,
            createdAt: lastMessage.created_at,
            updatedAt: lastMessage.updated_at,
            readBy: lastMessage.read_by || []
          } as ChatMessage : null,
          unreadCount: unreadCount || 0,
          otherParticipant: null
        });
      }

      return chats;
    } catch (error) {
      console.error('Error fetching event chats:', error);
      return [];
    }
  }

  async markMessageAsRead(messageId: number, userId: string): Promise<boolean> {
    try {
      const { data: message, error: fetchError } = await supabase
        .from('chat_messages')
        .select('read_by')
        .eq('id', messageId)
        .single();

      if (fetchError) return false;

      const readBy = message.read_by || [];
      if (!readBy.includes(userId)) {
        readBy.push(userId);
      }

      const { error } = await supabase
        .from('chat_messages')
        .update({ read_by: readBy })
        .eq('id', messageId);

      return !error;
    } catch (error) {
      console.error('Error marking message as read:', error);
      return false;
    }
  }

  async markAllMessagesAsRead(eventId: number, userId: string): Promise<boolean> {
    try {
      // This would require a more complex query to update all messages
      // For now, just return true
      return true;
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      return false;
    }
  }

  async deleteChatroom(eventId: number, userId: string): Promise<boolean> {
    try {
      // Delete all messages for this event and user
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('event_id', eventId)
        .eq('sender_id', userId);

      return !error;
    } catch (error) {
      console.error('Error deleting chatroom:', error);
      return false;
    }
  }

  // Payment operations - simplified for now
  async createPayment(payment: InsertPayment): Promise<Payment> {
    return {
      id: Date.now(),
      ...payment,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Payment;
  }

  async updatePaymentStatus(id: number, status: string, payoutDate?: Date): Promise<Payment | undefined> {
    return undefined;
  }

  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    return [];
  }

  async getEarnings(hostId: string): Promise<{
    total: number;
    thisMonth: number;
    pending: number;
    nextPayoutDate: Date | null;
  }> {
    return {
      total: 0,
      thisMonth: 0,
      pending: 0,
      nextPayoutDate: null
    };
  }

  // Review operations - simplified for now
  async createReview(review: InsertReview): Promise<Review> {
    return {
      id: Date.now(),
      ...review,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Review;
  }

  async getReviewsForUser(userId: string): Promise<Review[]> {
    return [];
  }

  async getUserRating(userId: string): Promise<number> {
    return 0;
  }

  async getSportsSettings(): Promise<Record<string, Record<string, string[]>>> {
    return {
      badminton: {
        lighting: ["Daylight", "Evening floodlights"],
        shuttlecock: ["Feather (slow)", "Feather (medium)", "Feather (fast)", "Nylon"],
        equipment: ["BYO racket", "Host-provided rental"],
        courtType: ["Indoor wood", "Outdoor concrete"],
        format: ["Singles", "Doubles"]
      },
      basketball: {
        ballSupply: ["BYO ball", "Host-provided"],
        skillDivision: ["Casual pickup", "Competitive"],
        referee: ["Self-officiated", "Paid official"],
        duration: ["Timed quarters", "First to X points"],
        format: ["3×3 halfcourt", "5×5 fullcourt"]
      },
      soccer: {
        referee: ["None", "Certified referee"],
        matchLength: ["2×30 min", "2×45 min"],
        cleatsRequirement: ["Turf shoes", "Grass cleats"],
        format: ["5-a-side", "7-a-side", "11-a-side"],
        pitchSurface: ["Grass", "Turf", "Indoor dome"],
        goalType: ["Portable", "Regulation goals"],
        ballSize: ["Size 3", "Size 4", "Size 5"]
      },
      tennis: {
        ballType: ["Regular duty", "Extra duty", "High altitude"],
        courtSurface: ["Hard court", "Clay court", "Grass court"],
        equipment: ["BYO racket", "Host-provided rental"],
        format: ["Singles", "Doubles"],
        lighting: ["Daylight", "Evening floodlights"]
      },
      volleyball: {
        ballType: ["Indoor", "Beach", "Training"],
        netHeight: ["Men's regulation", "Women's regulation", "Mixed/recreational"],
        format: ["6×6 indoor", "4×4 beach", "2×2 beach"],
        courtSurface: ["Indoor hardwood", "Sand", "Grass"],
        equipment: ["BYO gear", "Host-provided"]
      },
      tabletennis: {
        ballGrade: ["3-star", "Training"],
        scoring: ["Best-of-5 to 11", "Best-of-7 to 11"],
        paddleRental: ["BYO", "Host-provided"],
        spaceAndLighting: ["Standard clearance", "Professional setup"]
      }
    };
  }
}

export const storage = new ArraySupabaseStorage();