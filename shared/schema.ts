import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  phoneVerified: boolean("phone_verified").default(false),
  idVerified: boolean("id_verified").default(false),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enums
export const sportEnum = pgEnum("sport", [
  "badminton",
  "basketball", 
  "soccer",
  "tennis",
  "volleyball",
  "tabletennis"
]);

export const skillLevelEnum = pgEnum("skill_level", [
  "beginner",
  "intermediate", 
  "advanced",
  "any"
]);

export const genderMixEnum = pgEnum("gender_mix", [
  "mens",
  "womens",
  "mixed"
]);

export const eventStatusEnum = pgEnum("event_status", [
  "draft",
  "published",
  "full",
  "confirmed",
  "completed",
  "cancelled"
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "requested",
  "accepted", 
  "rejected",
  "cancelled"
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
  "escrowed"
]);

// Events table
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  hostId: varchar("host_id").notNull().references(() => users.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sport: sportEnum("sport").notNull(),
  skillLevel: skillLevelEnum("skill_level").notNull(),
  genderMix: genderMixEnum("gender_mix").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  maxPlayers: integer("max_players").notNull(),
  currentPlayers: integer("current_players").default(1),
  pricePerPerson: decimal("price_per_person", { precision: 8, scale: 2 }).notNull(),
  sportConfig: jsonb("sport_config").notNull(), // Sport-specific configuration
  status: eventStatusEnum("status").default("published"),
  notes: text("notes"),
  requestedUsers: text("requested_users").array().default([]), // UUIDs of users who requested to join
  acceptedUsers: text("accepted_users").array().default([]), // UUIDs of users who are accepted
  rejectedUsers: text("rejected_users").array().default([]), // UUIDs of users who are rejected
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: bookingStatusEnum("status").default("requested"),
  paymentIntentId: varchar("payment_intent_id"),
  amountPaid: decimal("amount_paid", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chats table - tracks conversations between users for specific events
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  eventId: integer("event_id").notNull().references(() => events.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chats_participants").on(table.senderId, table.receiverId, table.eventId),
  index("idx_chats_event").on(table.eventId),
]);

// Chat messages table - stores individual messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
}, (table) => [
  index("idx_chat_messages_chat_time").on(table.chatId, table.createdAt),
  index("idx_chat_messages_sender").on(table.senderId),
]);

// Payment transactions table
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").notNull().references(() => bookings.id),
  stripePaymentIntentId: varchar("stripe_payment_intent_id").notNull(),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 8, scale: 2 }).notNull(),
  hostPayout: decimal("host_payout", { precision: 8, scale: 2 }),
  status: paymentStatusEnum("status").default("pending"),
  payoutDate: timestamp("payout_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User sport preferences table
export const userSportPreferences = pgTable("user_sport_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  sport: sportEnum("sport").notNull(),
  skillLevel: skillLevelEnum("skill_level").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews/ratings table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
  revieweeId: varchar("reviewee_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5 scale
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Sports settings table
export const sportsSettings = pgTable("sports_settings", {
  id: serial("id").primaryKey(),
  sport: sportEnum("sport").notNull(),
  settingKey: varchar("setting_key").notNull(),
  settingValue: varchar("setting_value").notNull(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  hostedEvents: many(events),
  bookings: many(bookings),
  chatsAsSender: many(chats, { relationName: "sender" }),
  chatsAsReceiver: many(chats, { relationName: "receiver" }),
  chatMessages: many(chatMessages),
  sportPreferences: many(userSportPreferences),
  reviewsGiven: many(reviews, { relationName: "reviewer" }),
  reviewsReceived: many(reviews, { relationName: "reviewee" }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  host: one(users, {
    fields: [events.hostId],
    references: [users.id],
  }),
  bookings: many(bookings),
  chats: many(chats),
  reviews: many(reviews),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  sender: one(users, {
    fields: [chats.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [chats.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
  event: one(events, {
    fields: [chats.eventId],
    references: [events.id],
  }),
  messages: many(chatMessages),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  event: one(events, {
    fields: [bookings.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  payments: many(payments),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMessages.chatId],
    references: [chats.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const userSportPreferencesRelations = relations(userSportPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userSportPreferences.userId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  event: one(events, {
    fields: [reviews.eventId],
    references: [events.id],
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: "reviewer",
  }),
  reviewee: one(users, {
    fields: [reviews.revieweeId],
    references: [users.id],
    relationName: "reviewee",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  currentPlayers: true,
  requestedUsers: true,
  acceptedUsers: true,
  rejectedUsers: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  pricePerPerson: z.coerce.number().min(0).max(999.99).refine(
    (val) => {
      // Ensure the number has at most 2 decimal places
      return Number.isInteger(val * 100);
    },
    { message: "Price must have at most 2 decimal places" }
  ),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertSportsSettingsSchema = createInsertSchema(sportsSettings).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Chat = typeof chats.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type ChatMessageWithSender = ChatMessage & {
  sender: User;
  isRead?: boolean;
  isPending?: boolean;
};
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertSportsSettings = z.infer<typeof insertSportsSettingsSchema>;
export type SportsSettings = typeof sportsSettings.$inferSelect;

// Extended types with relations
export type EventWithHost = Event & {
  host: User;
  bookings: Booking[];
  _count?: {
    bookings: number;
  };
};

export type BookingWithEventAndUser = Booking & {
  event: EventWithHost;
  user: User;
};


