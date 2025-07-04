import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { supabaseAdmin } from "@shared/supabase";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No bearer token found in headers');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Attempting to verify token for user');
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error) {
      console.error('Supabase auth error:', error);
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    if (!user) {
      console.log('No user found for token');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log('User authenticated successfully:', user.id);

    // Ensure user profile exists
    try {
      const userProfile = await storage.getUser(user.id);
      if (!userProfile) {
        console.log('Creating user profile for:', user.id);
        // Create user profile if it doesn't exist
        await storage.upsertUser({
          id: user.id,
          email: user.email || '',
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
          profileImageUrl: user.user_metadata?.avatar_url || null,
        });
        console.log('User profile created successfully');
      } else {
        console.log('User profile already exists for:', user.id);
      }
    } catch (userError) {
      console.error('Error managing user profile:', userError);
      console.error('User profile error details:', {
        message: userError.message,
        stack: userError.stack,
        error: userError
      });
      // Continue with auth even if user profile management fails
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error details:', {
      message: error?.message,
      stack: error?.stack,
      error: error
    });
    return res.status(401).json({ message: 'Unauthorized' });
  }
};