// ============================================================
// TypeScript Type Definitions — Market-In Aja
// ============================================================

export type UserRole = 'petani' | 'pengepul' | 'distributor' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type OrderStatus =
  | 'negotiating'
  | 'paid_to_escrow'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'cancelled';
export type ProductQuality = 'grade_a' | 'grade_b' | 'grade_c';
export type SubscriptionTier = 'free' | 'basic' | 'premium';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  full_name: string;
  phone_number: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string;
  bio?: string;
  subscription_tier: SubscriptionTier;
  subscription_expires_at?: string;
  address?: string;
  location?: GeoPoint;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  idempotency_key: string;
  farmer_id: string;
  commodity_name: string;
  description?: string;
  price_per_kg: number;
  available_weight_kg: number;
  quality: ProductQuality;
  images: string[];
  video_url?: string;
  hls_url?: string;
  is_active: boolean;
  is_promoted: boolean;
  pickup_location?: GeoPoint;
  pickup_address?: string;
  harvest_date?: string;
  created_at: string;
  updated_at: string;
  // Joined
  farmer?: User;
  distance_km?: number;
}

export interface Order {
  id: string;
  product_id: string;
  pengepul_id: string;
  farmer_id: string;
  distributor_id?: string;
  status: OrderStatus;
  agreed_price_per_kg?: number;
  ordered_weight_kg: number;
  total_amount?: number;
  logistics_fee?: number;
  platform_fee?: number;
  xendit_invoice_id?: string;
  xendit_payment_url?: string;
  delivery_address?: string;
  distance_km?: number;
  created_at: string;
  paid_at?: string;
  delivered_at?: string;
  completed_at?: string;
  // Joined
  product?: Product;
  farmer?: User;
  pengepul?: User;
  distributor?: User;
}

export interface DistributorProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_plate: string;
  max_capacity_kg: number;
  price_per_km: number;
  service_radius_km: number;
  is_available: boolean;
  current_location?: GeoPoint;
  last_location_update?: string;
}

export interface ChatMessage {
  id: string;
  order_id?: string;
  sender_id: string;
  receiver_id: string;
  message?: string;
  media_url?: string;
  media_type?: string;
  is_read: boolean;
  created_at: string;
  sender?: User;
}

export interface Reel {
  id: string;
  user_id: string;
  product_id?: string;
  caption?: string;
  video_url: string;
  hls_url?: string;
  thumbnail_url?: string;
  view_count: number;
  like_count: number;
  is_promoted: boolean;
  promotion_expires_at?: string;
  created_at: string;
  user?: User;
  product?: Product;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  reference_id?: string;
  is_read: boolean;
  created_at: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Location tracking payload
export interface LocationPayload {
  order_id: string;
  distributor_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}
