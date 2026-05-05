import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type Beacon = Database['public']['Tables']['beacons']['Row'];
type BeaconInsert = Database['public']['Tables']['beacons']['Insert'];
type BeaconUpdate = Database['public']['Tables']['beacons']['Update'];

export interface BeaconWithRoom extends Beacon {
  rooms: {
    id: string;
    name: string;
    building_id: string;
    buildings: { id: string; name: string } | null;
  } | null;
}

interface BeaconsState {
  beacons: BeaconWithRoom[];
  isLoading: boolean;
  error: string | null;

  fetchBeacons: () => Promise<void>;
  createBeacon: (data: BeaconInsert) => Promise<{ error: Error | null }>;
  updateBeacon: (id: string, data: BeaconUpdate) => Promise<{ error: Error | null }>;
  deleteBeacon: (id: string) => Promise<{ error: Error | null }>;
}

export const useBeaconsStore = create<BeaconsState>((set, get) => ({
  beacons: [],
  isLoading: false,
  error: null,

  fetchBeacons: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('beacons')
        .select(`
          *,
          rooms (
            id,
            name,
            building_id,
            buildings ( id, name )
          )
        `)
        .order('name');

      if (error) throw error;
      set({ beacons: (data ?? []) as BeaconWithRoom[], isLoading: false });
    } catch (err) {
      console.error('Error fetching beacons:', err);
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  createBeacon: async (data: BeaconInsert) => {
    try {
      const { error } = await (supabase as any).from('beacons').insert(data);
      if (error) throw error;
      await get().fetchBeacons();
      return { error: null };
    } catch (err) {
      console.error('Error creating beacon:', err);
      return { error: err as Error };
    }
  },

  updateBeacon: async (id: string, data: BeaconUpdate) => {
    try {
      const { error } = await (supabase as any)
        .from('beacons')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      await get().fetchBeacons();
      return { error: null };
    } catch (err) {
      console.error('Error updating beacon:', err);
      return { error: err as Error };
    }
  },

  deleteBeacon: async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('beacons')
        .delete()
        .eq('id', id);
      if (error) throw error;
      set((state) => ({ beacons: state.beacons.filter((b) => b.id !== id) }));
      return { error: null };
    } catch (err) {
      console.error('Error deleting beacon:', err);
      return { error: err as Error };
    }
  },
}));

export const useBeacons = () => useBeaconsStore((state) => state.beacons);
