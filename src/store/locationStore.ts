// ============================================================
// Market-In Aja — Location Global State (Zustand)
// ============================================================
import { create } from 'zustand';
import { GeoPoint } from '@types/index';

interface LocationState {
  currentLocation: GeoPoint | null;
  isTracking: boolean;
  setCurrentLocation: (point: GeoPoint) => void;
  setIsTracking: (value: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  currentLocation: null,
  isTracking: false,
  setCurrentLocation: (point) => set({ currentLocation: point }),
  setIsTracking: (value) => set({ isTracking: value }),
}));
