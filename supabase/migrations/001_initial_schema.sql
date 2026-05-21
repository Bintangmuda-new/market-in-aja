-- ============================================================
-- Market-In Aja (Sama-Tani) — Database Migration 001
-- Full schema with PostGIS geospatial extensions
-- ============================================================

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('petani', 'pengepul', 'distributor', 'admin');
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE order_status AS ENUM (
  'negotiating',
  'paid_to_escrow',
  'in_transit',
  'delivered',
  'completed',
  'cancelled'
);
CREATE TYPE product_quality AS ENUM ('grade_a', 'grade_b', 'grade_c');
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium');

-- ============================================================
-- USERS TABLE
-- ============================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'petani',
  status user_status NOT NULL DEFAULT 'pending',
  avatar_url TEXT,
  bio TEXT,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,
  -- Geospatial: store address as coordinates (WGS84)
  address TEXT,
  location geometry(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GiST index for fast proximity queries on user locations
CREATE INDEX idx_users_location ON public.users USING GIST (location);

-- ============================================================
-- PRODUCTS TABLE (Petani's harvest listings)
-- ============================================================

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Idempotency key to prevent duplicate submissions
  idempotency_key UUID UNIQUE NOT NULL,
  farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  commodity_name TEXT NOT NULL,
  description TEXT,
  price_per_kg NUMERIC(12, 2) NOT NULL CHECK (price_per_kg > 0),
  available_weight_kg NUMERIC(10, 2) NOT NULL CHECK (available_weight_kg > 0),
  quality product_quality NOT NULL DEFAULT 'grade_a',
  images TEXT[] DEFAULT '{}',
  video_url TEXT,
  -- HLS stream URL for product video
  hls_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
  -- Geospatial: product pickup location
  pickup_location geometry(Point, 4326),
  pickup_address TEXT,
  harvest_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GiST index for fast geospatial product discovery
CREATE INDEX idx_products_pickup_location ON public.products USING GIST (pickup_location);
CREATE INDEX idx_products_farmer ON public.products(farmer_id);
CREATE INDEX idx_products_active ON public.products(is_active, is_promoted);

-- Edit timeout constraint: prevent updates after 24 hours
CREATE OR REPLACE FUNCTION check_product_edit_timeout()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.created_at + INTERVAL '24 hours' < NOW() THEN
    RAISE EXCEPTION 'Waktu edit produk telah habis. Produk tidak dapat diubah setelah 24 jam sejak pembuatan.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_product_edit_timeout
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION check_product_edit_timeout();

-- ============================================================
-- DISTRIBUTOR PROFILES TABLE
-- ============================================================

CREATE TABLE public.distributor_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  max_capacity_kg NUMERIC(10, 2) NOT NULL,
  price_per_km NUMERIC(10, 2) NOT NULL,
  service_radius_km INTEGER NOT NULL DEFAULT 50,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  -- Real-time GPS location during active delivery
  current_location geometry(Point, 4326),
  last_location_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_distributor_location ON public.distributor_profiles USING GIST (current_location);

-- ============================================================
-- ORDERS TABLE
-- ============================================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  pengepul_id UUID NOT NULL REFERENCES public.users(id),
  farmer_id UUID NOT NULL REFERENCES public.users(id),
  distributor_id UUID REFERENCES public.users(id),
  status order_status NOT NULL DEFAULT 'negotiating',
  -- Negotiated transaction details
  agreed_price_per_kg NUMERIC(12, 2),
  ordered_weight_kg NUMERIC(10, 2) NOT NULL,
  total_amount NUMERIC(14, 2),
  logistics_fee NUMERIC(14, 2),
  platform_fee NUMERIC(14, 2),
  -- Xendit escrow references
  xendit_invoice_id TEXT,
  xendit_payment_url TEXT,
  escrow_virtual_account TEXT,
  -- Delivery tracking
  pickup_location geometry(Point, 4326),
  delivery_location geometry(Point, 4326),
  delivery_address TEXT,
  distance_km NUMERIC(8, 2),
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  pickup_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_pengepul ON public.orders(pengepul_id);
CREATE INDEX idx_orders_farmer ON public.orders(farmer_id);
CREATE INDEX idx_orders_distributor ON public.orders(distributor_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- ============================================================
-- LOCATION TRACKING TABLE (Distributor GPS breadcrumbs)
-- ============================================================

CREATE TABLE public.location_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES public.users(id),
  location geometry(Point, 4326) NOT NULL,
  accuracy NUMERIC(8, 2),
  speed NUMERIC(8, 2),
  heading NUMERIC(6, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_order ON public.location_tracking(order_id, recorded_at DESC);
CREATE INDEX idx_tracking_location ON public.location_tracking USING GIST (location);

-- ============================================================
-- CHAT MESSAGES TABLE
-- ============================================================

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id),
  receiver_id UUID NOT NULL REFERENCES public.users(id),
  message TEXT,
  media_url TEXT,
  media_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_order ON public.chat_messages(order_id, created_at ASC);
CREATE INDEX idx_chat_participants ON public.chat_messages(sender_id, receiver_id);

-- ============================================================
-- REELS FEED TABLE (Social media-style short videos)
-- ============================================================

CREATE TABLE public.reels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  caption TEXT,
  video_url TEXT NOT NULL,
  hls_url TEXT,
  thumbnail_url TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
  promotion_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reels_promoted ON public.reels(is_promoted, promotion_expires_at);
CREATE INDEX idx_reels_created ON public.reels(created_at DESC);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- IDEMPOTENCY KEYS TABLE (Spam/duplicate prevention)
-- ============================================================

CREATE TABLE public.idempotency_keys (
  key UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id),
  operation TEXT NOT NULL,
  response_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-cleanup idempotency keys older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.idempotency_keys
  WHERE created_at < NOW() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_tracking ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is approved
CREATE OR REPLACE FUNCTION is_approved_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND status = 'approved'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- USERS policies
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT USING (auth.uid() = id OR is_approved_user());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id AND is_approved_user());

CREATE POLICY "admin_manage_users" ON public.users
  FOR ALL USING (is_admin_user());

-- PRODUCTS policies: only approved users can create/update
CREATE POLICY "products_read_all" ON public.products
  FOR SELECT USING (TRUE);

CREATE POLICY "products_create_approved" ON public.products
  FOR INSERT WITH CHECK (is_approved_user() AND auth.uid() = farmer_id);

CREATE POLICY "products_update_own" ON public.products
  FOR UPDATE USING (auth.uid() = farmer_id AND is_approved_user());

CREATE POLICY "products_delete_own" ON public.products
  FOR DELETE USING (auth.uid() = farmer_id AND is_approved_user());

-- ORDERS policies
CREATE POLICY "orders_read_participant" ON public.orders
  FOR SELECT USING (
    auth.uid() IN (pengepul_id, farmer_id, distributor_id)
    OR is_admin_user()
  );

CREATE POLICY "orders_create_approved" ON public.orders
  FOR INSERT WITH CHECK (is_approved_user() AND auth.uid() = pengepul_id);

CREATE POLICY "orders_update_participant" ON public.orders
  FOR UPDATE USING (
    auth.uid() IN (pengepul_id, farmer_id, distributor_id)
    AND is_approved_user()
  );

-- CHAT policies
CREATE POLICY "chat_read_participant" ON public.chat_messages
  FOR SELECT USING (
    auth.uid() IN (sender_id, receiver_id)
  );

CREATE POLICY "chat_send_approved" ON public.chat_messages
  FOR INSERT WITH CHECK (
    is_approved_user() AND auth.uid() = sender_id
  );

-- ============================================================
-- UPDATED_AT TRIGGER (Auto-update timestamp)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- GEOSPATIAL STORED PROCEDURE: Find nearby products
-- ============================================================

CREATE OR REPLACE FUNCTION find_nearby_products(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km INTEGER DEFAULT 50,
  commodity TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  commodity_name TEXT,
  price_per_kg NUMERIC,
  available_weight_kg NUMERIC,
  quality product_quality,
  images TEXT[],
  farmer_name TEXT,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.commodity_name,
    p.price_per_kg,
    p.available_weight_kg,
    p.quality,
    p.images,
    u.full_name as farmer_name,
    ROUND(CAST(ST_DistanceSphere(
      p.pickup_location,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
    ) / 1000 AS NUMERIC), 2)::DOUBLE PRECISION AS distance_km
  FROM public.products p
  JOIN public.users u ON p.farmer_id = u.id
  WHERE
    p.is_active = TRUE
    AND u.status = 'approved'
    AND ST_DWithin(
      p.pickup_location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (commodity IS NULL OR p.commodity_name ILIKE '%' || commodity || '%')
  ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;
