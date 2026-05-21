// ============================================================
// Market-In Aja — Core Domain Types
// All types mirror the PostgreSQL schema precisely.
// ============================================================

export type UserRole = 'petani' | 'pengepul' | 'distributor' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus =
  | 'negotiating'
  | 'paid_to_escrow'
  | 'in_transit'
  | 'delivered'
  | 'completed';
export type SubscriptionTier = 'free' | 'basic' | 'premium';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  id: string;
  auth_id: string;
  full_name: string;
  phone_number: string;
  role: UserRole;
  status: UserStatus;
  avatar_url: string | null;
  address_text: string;
  location: GeoPoint | null;
  subscription_tier: SubscriptionTier;
  created_at: string;
  updated_at: string;
}

export interface ProductListing {
  id: string;
  seller_id: string;
  seller?: UserProfile;
  commodity_name: string;
  description: string;
  quantity_kg: number;
  price_per_kg: number;
  image_urls: string[];
  video_url: string | null;
  location: GeoPoint;
  address_text: string;
  is_available: boolean;
  idempotency_key: string;
  promoted: boolean;
  subscription_tier_required: SubscriptionTier;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  listing_id: string;
  listing?: ProductListing;
  pengepul_id: string;
  pengepul?: UserProfile;
  petani_id: string;
  petani?: UserProfile;
  distributor_id: string | null;
  distributor?: UserProfile;
  quantity_ordered_kg: number;
  total_price: number;
  logistics_fee: number;
  status: OrderStatus;
  xendit_payment_id: string | null;
  xendit_escrow_disbursement_id: string | null;
  otp_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryTrack {
  id: string;
  order_id: string;
  distributor_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  recorded_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender?: UserProfile;
  content: string;
  message_type: 'text' | 'image' | 'system';
  created_at: string;
}

export interface ChatRoom {
  id: string;
  order_id: string | null;
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface ReelPost {
  id: string;
  author_id: string;
  author?: UserProfile;
  listing_id: string | null;
  video_hls_url: string;
  thumbnail_url: string;
  caption: string;
  likes_count: number;
  is_promoted: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// --- UI State Pattern ---
export type UIState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
  | { status: 'empty' };
