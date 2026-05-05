import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Building = Database['public']['Tables']['buildings']['Row'];
type BuildingInsert = Database['public']['Tables']['buildings']['Insert'];
type BuildingUpdate = Database['public']['Tables']['buildings']['Update'];
type Room = Database['public']['Tables']['rooms']['Row'];
type RoomInsert = Database['public']['Tables']['rooms']['Insert'];
type RoomUpdate = Database['public']['Tables']['rooms']['Update'];
type Beacon = Database['public']['Tables']['beacons']['Row'];

export interface RoomWithBeacons extends Room {
  beacons: Beacon[];
}

export interface BuildingWithRooms extends Building {
  rooms: RoomWithBeacons[];
}

interface BuildingsState {
  buildings: Building[];
  currentBuilding: BuildingWithRooms | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchBuildings: () => Promise<void>;
  fetchBuilding: (id: string) => Promise<void>;
  fetchBuildingRooms: (buildingId: string) => Promise<Room[]>;
  createBuilding: (data: BuildingInsert) => Promise<{ data: Building | null; error: Error | null }>;
  updateBuilding: (id: string, data: BuildingUpdate) => Promise<{ error: Error | null }>;
  deleteBuilding: (id: string) => Promise<{ error: Error | null }>;
  createRoom: (data: RoomInsert) => Promise<{ data: Room | null; error: Error | null }>;
  updateRoom: (id: string, data: RoomUpdate) => Promise<{ error: Error | null }>;
  deleteRoom: (id: string) => Promise<{ error: Error | null }>;
}

export const useBuildingsStore = create<BuildingsState>((set, get) => ({
  buildings: [],
  currentBuilding: null,
  isLoading: false,
  error: null,

  fetchBuildings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('buildings')
        .select('*')
        .order('name');

      if (error) throw error;

      set({ buildings: (data ?? []) as Building[], isLoading: false });
    } catch (error) {
      console.error('Error fetching buildings:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchBuilding: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: building, error: buildingError } = await (supabase as any)
        .from('buildings')
        .select('*')
        .eq('id', id)
        .single();

      if (buildingError) throw buildingError;

      const { data: rooms, error: roomsError } = await (supabase as any)
        .from('rooms')
        .select(`
          *,
          beacons (*)
        `)
        .eq('building_id', id)
        .order('floor_level')
        .order('name');

      if (roomsError) throw roomsError;

      set({
        currentBuilding: {
          ...(building as Building),
          rooms: (rooms ?? []) as RoomWithBeacons[],
        },
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching building:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchBuildingRooms: async (buildingId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('rooms')
        .select('*')
        .eq('building_id', buildingId)
        .order('floor_level')
        .order('name');

      if (error) throw error;

      return (data ?? []) as Room[];
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  },

  createBuilding: async (data: BuildingInsert) => {
    try {
      const { data: created, error } = await (supabase as any)
        .from('buildings')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      await get().fetchBuildings();
      return { data: created as Building, error: null };
    } catch (err) {
      console.error('Error creating building:', err);
      return { data: null, error: err as Error };
    }
  },

  updateBuilding: async (id: string, data: BuildingUpdate) => {
    try {
      const { error } = await (supabase as any)
        .from('buildings')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      await get().fetchBuildings();
      if (get().currentBuilding?.id === id) {
        await get().fetchBuilding(id);
      }
      return { error: null };
    } catch (err) {
      console.error('Error updating building:', err);
      return { error: err as Error };
    }
  },

  deleteBuilding: async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('buildings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      set((state) => ({
        buildings: state.buildings.filter((b) => b.id !== id),
        currentBuilding: state.currentBuilding?.id === id ? null : state.currentBuilding,
      }));
      return { error: null };
    } catch (err) {
      console.error('Error deleting building:', err);
      return { error: err as Error };
    }
  },

  createRoom: async (data: RoomInsert) => {
    try {
      const { data: created, error } = await (supabase as any)
        .from('rooms')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      if (get().currentBuilding?.id === data.building_id) {
        await get().fetchBuilding(data.building_id);
      }
      return { data: created as Room, error: null };
    } catch (err) {
      console.error('Error creating room:', err);
      return { data: null, error: err as Error };
    }
  },

  updateRoom: async (id: string, data: RoomUpdate) => {
    try {
      const { error } = await (supabase as any)
        .from('rooms')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      const buildingId = get().currentBuilding?.id;
      if (buildingId) await get().fetchBuilding(buildingId);
      return { error: null };
    } catch (err) {
      console.error('Error updating room:', err);
      return { error: err as Error };
    }
  },

  deleteRoom: async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('rooms')
        .delete()
        .eq('id', id);
      if (error) throw error;
      const buildingId = get().currentBuilding?.id;
      if (buildingId) await get().fetchBuilding(buildingId);
      return { error: null };
    } catch (err) {
      console.error('Error deleting room:', err);
      return { error: err as Error };
    }
  },
}));

// Selector hooks
export const useBuildings = () => useBuildingsStore((state) => state.buildings);
export const useCurrentBuilding = () => useBuildingsStore((state) => state.currentBuilding);
