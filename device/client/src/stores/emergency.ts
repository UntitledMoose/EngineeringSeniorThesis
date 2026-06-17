import { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';

import { fireEmergencyNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { EmergencyType, TaskStatus } from '@/types/database';

interface ActiveEmergency {
  id: string;
  emergency_type: EmergencyType;
  status: 'active' | 'resolved' | 'cancelled';
  building_id: string | null;
  building_name: string | null;
  started_at: string;
  playbook_id: string | null;
  playbook_name: string | null;
  total_tasks: number;
  completed_tasks: number;
}

interface MyTask {
  task_instance_id: string;
  task_id: string;
  sequence_number: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  completed_at: string | null;
  depends_on_completed: boolean;
}

interface EmergencyState {
  activeEmergency: ActiveEmergency | null;
  myTasks: MyTask[];
  isLoading: boolean;
  error: string | null;
  realtimeChannel: RealtimeChannel | null;

  // Actions
  fetchActiveEmergency: () => Promise<void>;
  fetchMyTasks: () => Promise<void>;
  triggerEmergency: (
    type: EmergencyType,
    buildingId?: string,
    beaconId?: string,
    notes?: string,
    playbookId?: string | null
  ) => Promise<{ eventId: string | null; error: Error | null }>;
  resolveEmergency: (eventId: string, notes?: string) => Promise<{ error: Error | null }>;
  completeTask: (taskInstanceId: string, notes?: string) => Promise<{ error: Error | null }>;
  subscribeToEmergencies: () => void;
  unsubscribe: () => void;
}

export const useEmergencyStore = create<EmergencyState>((set, get) => ({
  activeEmergency: null,
  myTasks: [],
  isLoading: false,
  error: null,
  realtimeChannel: null,

  fetchActiveEmergency: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.rpc('get_active_emergency') as {
        data: ActiveEmergency[] | null;
        error: Error | null;
      };

      if (error) throw error;

      set({
        activeEmergency: data && data.length > 0 ? data[0] : null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching active emergency:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchMyTasks: async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_tasks') as {
        data: MyTask[] | null;
        error: Error | null;
      };

      if (error) throw error;

      set({ myTasks: data ?? [] });
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  },

  triggerEmergency: async (type, buildingId, beaconId, notes, playbookId) => {
    set({ isLoading: true, error: null });
    try {
      // @ts-expect-error - Custom RPC function not in generated types
      const { data, error } = await supabase.rpc('trigger_emergency', {
        p_emergency_type: type,
        p_building_id: buildingId ?? null,
        p_beacon_id: beaconId ?? null,
        p_notes: notes ?? null,
        p_playbook_id: playbookId ?? null,
      }) as { data: string | null; error: Error | null };

      if (error) throw error;

      // Refresh emergency state
      await get().fetchActiveEmergency();
      await get().fetchMyTasks();

      set({ isLoading: false });
      return { eventId: data, error: null };
    } catch (error) {
      console.error('Error triggering emergency:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { eventId: null, error: error as Error };
    }
  },

  resolveEmergency: async (eventId, notes) => {
    set({ isLoading: true, error: null });
    try {
      // @ts-expect-error - Custom RPC function not in generated types
      const { error } = await supabase.rpc('resolve_emergency', {
        p_event_id: eventId,
        p_notes: notes ?? null,
      }) as { error: Error | null };

      if (error) throw error;

      set({ activeEmergency: null, myTasks: [], isLoading: false });
      return { error: null };
    } catch (error) {
      console.error('Error resolving emergency:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { error: error as Error };
    }
  },

  completeTask: async (taskInstanceId, notes) => {
    try {
      // @ts-expect-error - Custom RPC function not in generated types
      const { error } = await supabase.rpc('complete_task', {
        p_task_instance_id: taskInstanceId,
        p_notes: notes ?? null,
      }) as { error: Error | null };

      if (error) throw error;

      // Update local state optimistically
      set((state) => ({
        myTasks: state.myTasks.map((task) =>
          task.task_instance_id === taskInstanceId
            ? { ...task, status: 'completed' as TaskStatus, completed_at: new Date().toISOString() }
            : task
        ),
        activeEmergency: state.activeEmergency
          ? {
              ...state.activeEmergency,
              completed_tasks: state.activeEmergency.completed_tasks + 1,
            }
          : null,
      }));

      return { error: null };
    } catch (error) {
      console.error('Error completing task:', error);
      return { error: error as Error };
    }
  },

  subscribeToEmergencies: () => {
    const channel = supabase
      .channel('emergency-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_events',
        },
        async (payload) => {
          console.log('Emergency event change:', payload);
          await get().fetchActiveEmergency();
          if (
            (payload.eventType === 'INSERT' ||
              (payload.eventType === 'UPDATE' && (payload.new as { status?: string })?.status === 'active')) &&
            (payload.new as { emergency_type?: EmergencyType })?.emergency_type
          ) {
            const type = (payload.new as { emergency_type: EmergencyType }).emergency_type;
            fireEmergencyNotification(type).catch(console.error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_task_instances',
        },
        async (payload) => {
          console.log('Task instance change:', payload);
          await get().fetchMyTasks();
          await get().fetchActiveEmergency(); // Update task counts
        }
      )
      .subscribe();

    set({ realtimeChannel: channel });
  },

  unsubscribe: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      set({ realtimeChannel: null });
    }
  },
}));

// Selector hooks
export const useActiveEmergency = () => useEmergencyStore((state) => state.activeEmergency);
export const useMyTasks = () => useEmergencyStore((state) => state.myTasks);
export const useHasActiveEmergency = () => useEmergencyStore((state) => state.activeEmergency !== null);
