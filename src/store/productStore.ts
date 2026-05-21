// ============================================================
// Zustand Store: Product Listings Management
// Includes idempotency key logic for spam prevention
// ============================================================

import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { supabase } from '../services/supabase';
import type { Product, ProductQuality } from '../types';

interface ProductState {
  products: Product[];
  nearbyProducts: Product[];
  currentProduct: Product | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isEmpty: boolean;
  errorMessage: string | null;
  // Active idempotency key for current submission form
  activeIdempotencyKey: string | null;

  // Actions
  generateIdempotencyKey: () => void;
  createProduct: (params: CreateProductParams) => Promise<{ error?: string }>;
  fetchNearbyProducts: (lat: number, lng: number, radiusKm?: number, commodity?: string) => Promise<void>;
  fetchMyProducts: (farmerId: string) => Promise<void>;
  resetFormState: () => void;
}

interface CreateProductParams {
  commodity_name: string;
  description?: string;
  price_per_kg: number;
  available_weight_kg: number;
  quality: ProductQuality;
  images?: string[];
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_address: string;
  harvest_date?: string;
  farmer_id: string;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  nearbyProducts: [],
  currentProduct: null,
  isLoading: false,
  isSuccess: false,
  isError: false,
  isEmpty: false,
  errorMessage: null,
  activeIdempotencyKey: null,

  // Generate UUID v4 when submission screen opens
  generateIdempotencyKey: async () => {
    const uuid = await Crypto.randomUUID();
    set({ activeIdempotencyKey: uuid });
  },

  createProduct: async (params) => {
    const { activeIdempotencyKey } = get();
    if (!activeIdempotencyKey) {
      return { error: 'Kunci keunikan tidak tersedia. Silakan muat ulang halaman.' };
    }

    set({ isLoading: true, isError: false, isSuccess: false });

    const pickupLocation = `POINT(${params.pickup_longitude} ${params.pickup_latitude})`;

    // Include idempotency key in request — DB UNIQUE constraint will reject duplicates
    const { error } = await supabase.from('products').insert({
      idempotency_key: activeIdempotencyKey,
      farmer_id: params.farmer_id,
      commodity_name: params.commodity_name,
      description: params.description,
      price_per_kg: params.price_per_kg,
      available_weight_kg: params.available_weight_kg,
      quality: params.quality,
      images: params.images ?? [],
      pickup_location: pickupLocation,
      pickup_address: params.pickup_address,
      harvest_date: params.harvest_date,
    });

    if (error) {
      const isDuplicate = error.code === '23505'; // PostgreSQL unique violation
      set({
        isLoading: false,
        isError: true,
        errorMessage: isDuplicate
          ? 'Produk ini sudah pernah diunggah sebelumnya. Mohon hindari pengiriman ganda.'
          : 'Gagal mengunggah produk. Silakan coba lagi.',
      });
      return { error: isDuplicate ? 'DUPLICATE' : error.message };
    }

    set({ isLoading: false, isSuccess: true, activeIdempotencyKey: null });
    return {};
  },

  fetchNearbyProducts: async (lat, lng, radiusKm = 50, commodity) => {
    set({ isLoading: true, isEmpty: false });

    // Uses PostGIS ST_DWithin + GiST index via stored procedure
    const { data, error } = await supabase.rpc('find_nearby_products', {
      user_lat: lat,
      user_lng: lng,
      radius_km: radiusKm,
      commodity: commodity ?? null,
    });

    if (error) {
      set({ isLoading: false, isError: true, errorMessage: 'Gagal memuat produk terdekat.' });
      return;
    }

    set({
      nearbyProducts: data ?? [],
      isEmpty: !data || data.length === 0,
      isLoading: false,
    });
  },

  fetchMyProducts: async (farmerId) => {
    set({ isLoading: true });

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ isLoading: false, isError: true });
      return;
    }

    set({ products: data ?? [], isEmpty: !data?.length, isLoading: false });
  },

  resetFormState: () =>
    set({ isLoading: false, isSuccess: false, isError: false, errorMessage: null }),
}));
