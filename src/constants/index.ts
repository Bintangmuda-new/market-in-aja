// ============================================================
// Market-In Aja — App-wide Constants
// ============================================================

export const APP_NAME = 'Market-In Aja';
export const APP_TAGLINE = 'Jual Panen, Langsung Untung';

// Spatial
export const DEFAULT_SEARCH_RADIUS_METERS = 50_000; // 50 km
export const TRACKER_MIN_DISTANCE_METERS = 50;       // anti-spam threshold
export const TRACKER_BACKGROUND_TASK = 'DISTRIBUTOR_LOCATION_TASK';

// Feed
export const FEED_VIEWABILITY_THRESHOLD = 0.7; // 70% visible to autoplay
export const PROMOTED_POST_INTERVAL = 5;        // inject promo every N items

// Idempotency
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

// Edit window
export const LISTING_EDIT_WINDOW_HOURS = 24;

// Pagination
export const PAGE_SIZE = 20;

// File limits
export const MAX_IMAGE_WIDTH_PX = 1080;
export const MAX_IMAGE_QUALITY = 0.75;

// OTP
export const OTP_EXPIRY_SECONDS = 300;

// Routes
export const ROUTES = {
  LOGIN: '/(auth)/login',
  REGISTER: '/(auth)/register',
  OTP: '/(auth)/otp',
  PENDING: '/(auth)/pending',
  DASHBOARD: '/(app)/(tabs)/dashboard',
  EXPLORE: '/(app)/(tabs)/explore',
  REELS: '/(app)/(tabs)/reels',
  INBOX: '/(app)/(tabs)/inbox',
  PROFILE: '/(app)/(tabs)/profile',
  PRODUCT_NEW: '/(app)/product/new',
  PRODUCT_DETAIL: '/(app)/product/[id]',
  ORDER_DETAIL: '/(app)/order/[id]',
  CALL: '/(app)/call/[channelName]',
  TRACKER: '/(app)/tracker/[orderId]',
  ADMIN: '/(app)/admin',
} as const;
