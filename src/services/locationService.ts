// ============================================================
// Location Service: Background GPS tracking for Distributors
// Uses @react-native-community/geolocation with battery-aware
// update intervals. Sends coordinates to Edge Function.
// ============================================================

import Geolocation from '@react-native-community/geolocation';
import { supabase } from './supabase';
import type { GeoPoint } from '../types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const LOCATION_UPDATE_INTERVAL_MS = 10000; // 10 seconds

let watchId: number | 