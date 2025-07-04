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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
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

export class SimpleSupabaseStorage implements IStorage {
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

  // Event operations - completely simplified without joins
  async createEvent(event: InsertEvent): Promise<Event> {
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data as Event;
  }

  async getEvent(id: number): Promise<EventWithHost | undefined> {
    // Get event first
    const { data: event, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !event) return undefined;
    
    // Get host separately
    const { data: host } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', event.host_id)
      .single();

    const hostData = host || {
      id: event.host_id,
      email: '',
      firstName: 'Host',
      lastName: 'User',
      displayName: 'Host User',
      profileImageUrl: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      phoneVerified: false,
      idVerified: false,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return {
      ...event,
      host: hostData
    } as EventWithHost;
  }

  async getEvents(filters?: any): Promise<EventWithHost[]> {
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) throw error;
    if (!events) return [];

    console.log(`Found ${events.length} events from database`);

    // Get all unique host IDs
    const hostIds = [...new Set(events.map(e => e.host_id))];
    
    // Fetch all hosts in one query
    const { data: hosts } = await supabaseAdmin
      .from('users')
      .select('*')
      .in('id', hostIds);

    const hostMap = new Map();
    if (hosts) {
      hosts.forEach(host => hostMap.set(host.id, host));
    }

    return events.map(event => ({
      ...event,
      host: hostMap.get(event.host_id) || {
        id: event.host_id,
        email: '',
        firstName: 'Host',
        lastName: 'User',
        displayName: 'Host User',
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
    const { data: events, error } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('host_id', hostId)
      .order('start_time', { ascending: true });

    if (error) throw error;
    if (!events) return [];

    // Get host data
    const { data: host } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', hostId)
      .single();

    const hostData = host || {
      id: hostId,
      email: '',
      firstName: 'Host',
      lastName: 'User',
      displayName: 'Host User',
      profileImageUrl: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      phoneVerified: false,
      idVerified: false,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return events.map(event => ({
      ...event,
      host: hostData
    })) as EventWithHost[];
  }

  // Booking operations (simplified - no complex joins)
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
    // This is complex, return minimal for now
    return undefined;
  }

  async getBookingsByUser(userId: string): Promise<BookingWithEventAndUser[]> {
    // Simple implementation - just return empty for now
    return [];
  }

  async getBookingsByEvent(eventId: number): Promise<BookingWithEventAndUser[]> {
    return [];
  }

  async getPendingBookingsForHost(hostId: string): Promise<BookingWithEventAndUser[]> {
    console.log(`Fetching pending bookings for host: ${hostId}`);
    
    // Get all events hosted by this user
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('host_id', hostId);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    if (!events || events.length === 0) {
      console.log('No events found for host');
      return [];
    }

    console.log(`Found ${events.length} events for host`);
    console.log('Events data:', events.map(e => ({ id: e.id, title: e.title, requested_users: e.requested_users })));
    
    const pendingBookings: BookingWithEventAndUser[] = [];

    // For each event, check if it has requested users
    for (const event of events) {
      console.log(`Checking event ${event.id} - requested_users:`, event.requested_users);
      
      if (event.requested_users && Array.isArray(event.requested_users) && event.requested_users.length > 0) {
        console.log(`Event ${event.id} has ${event.requested_users.length} requested users:`, event.requested_users);
        
        // Get user details for each requested user
        for (const userId of event.requested_users) {
          console.log(`Fetching user data for userId: ${userId}`);
          
          const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          console.log(`User data for ${userId}:`, user ? 'found' : 'not found', userError ? userError : '');

          if (user) {
            // Create a booking-like object
            pendingBookings.push({
              id: 0, // Not a real booking ID
              eventId: event.id,
              userId: userId,
              status: 'requested',
              createdAt: new Date(),
              updatedAt: new Date(),
              event: {
                id: event.id,
                title: event.title,
                description: '',
                sport: 'badminton',
                skillLevel: 'any',
                genderMix: 'mixed',
                startTime: new Date(),
                endTime: new Date(),
                location: '',
                latitude: '0',
                longitude: '0',
                maxPlayers: 10,
                pricePerPerson: null,
                sportConfig: null,
                status: 'active',
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                hostId: hostId,
                requestedUsers: event.requested_users,
                acceptedUsers: [],
                rejectedUsers: []
              },
              user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                displayName: user.display_name || `${user.first_name} ${user.last_name}`,
                profileImageUrl: user.profile_image_url,
                stripeCustomerId: user.stripe_customer_id,
                stripeSubscriptionId: user.stripe_subscription_id,
                phoneVerified: user.phone_verified,
                idVerified: user.id_verified,
                bio: user.bio,
                createdAt: user.created_at,
                updatedAt: user.updated_at
              }
            });
          }
        }
      }
    }

    console.log(`Returning ${pendingBookings.length} pending bookings`);
    return pendingBookings;
  }

  async updateBookingStatus(eventId: number, userId: string, status: string): Promise<Booking | undefined> {
    // For array-based approach, we need to update the event's arrays
    const { data: event, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('requested_users, accepted_users, rejected_users')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) return undefined;

    let requestedUsers = event.requested_users || [];
    let acceptedUsers = event.accepted_users || [];
    let rejectedUsers = event.rejected_users || [];

    // Remove from requested users
    requestedUsers = requestedUsers.filter((id: string) => id !== userId);

    // Add to appropriate array based on status
    if (status === 'accepted') {
      if (!acceptedUsers.includes(userId)) {
        acceptedUsers.push(userId);
      }
    } else if (status === 'rejected') {
      if (!rejectedUsers.includes(userId)) {
        rejectedUsers.push(userId);
      }
    }

    // Update the event
    const { data, error } = await supabaseAdmin
      .from('events')
      .update({
        requested_users: requestedUsers,
        accepted_users: acceptedUsers,
        rejected_users: rejectedUsers,
        updated_at: new Date().toISOString()
      })
      .eq('id', eventId)
      .select()
      .single();

    if (error) return undefined;

    // Return a mock booking object
    return {
      id: 0,
      eventId: eventId,
      userId: userId,
      status: status,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Booking;
  }

  async cancelBooking(id: number): Promise<boolean> {
    return true; // Simplified
  }

  // Chat operations (simplified)
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(message)
      .select()
      .single();

    if (error) throw error;
    return data as ChatMessage;
  }

  async getChatMessages(eventId: number, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    return [];
  }

  async getChatMessagesForConversation(eventId: number, userId1: string, userId2: string, limit: number = 50, offset: number = 0): Promise<ChatMessageWithSender[]> {
    return [];
  }

  async getEventChats(userId: string): Promise<{ eventId: number; event: Event; lastMessage: any; unreadCount: number; otherParticipant: any }[]> {
    return [];
  }

  async markMessageAsRead(messageId: number, userId: string): Promise<boolean> {
    return true;
  }

  async markAllMessagesAsRead(eventId: number, userId: string): Promise<boolean> {
    return true;
  }

  async deleteChatroom(eventId: number, userId: string): Promise<boolean> {
    return true;
  }

  // Payment operations (simplified)
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

  // Review operations (simplified)
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
    return [];
  }

  async getUserRating(userId: string): Promise<number> {
    return 0;
  }

  // Sports settings operations
  async getSportsSettings(): Promise<Record<string, Record<string, string[]>>> {
    return {};
  }
}

export const storage = new SimpleSupabaseStorage();