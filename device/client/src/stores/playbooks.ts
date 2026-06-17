import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import type { Database, EmergencyType, UserRole, Json } from '@/types/database';

type Playbook = Database['public']['Tables']['playbooks']['Row'];
type PlaybookTask = Database['public']['Tables']['playbook_tasks']['Row'];

export interface PlaybookWithTasks extends Playbook {
  tasks: PlaybookTask[];
}

interface PlaybookState {
  playbooks: Playbook[];
  currentPlaybook: PlaybookWithTasks | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPlaybooks: () => Promise<void>;
  fetchPlaybook: (id: string) => Promise<void>;
  createPlaybook: (data: {
    name: string;
    description?: string;
    emergency_type: EmergencyType;
    is_default?: boolean;
  }) => Promise<{ id: string | null; error: Error | null }>;
  updatePlaybook: (
    id: string,
    data: Partial<Pick<Playbook, 'name' | 'description' | 'is_default'>>
  ) => Promise<{ error: Error | null }>;
  deletePlaybook: (id: string) => Promise<{ error: Error | null }>;

  // Task actions
  createTask: (data: {
    playbook_id: string;
    sequence_number: number;
    title: string;
    description?: string;
    assigned_role?: UserRole;
    estimated_duration?: number;
    depends_on_task_id?: string;
    condition?: Json;
  }) => Promise<{ id: string | null; error: Error | null }>;
  updateTask: (
    id: string,
    data: Partial<Omit<PlaybookTask, 'id' | 'playbook_id' | 'created_at' | 'updated_at'>>
  ) => Promise<{ error: Error | null }>;
  deleteTask: (id: string) => Promise<{ error: Error | null }>;
  reorderTasks: (playbookId: string, taskIds: string[]) => Promise<{ error: Error | null }>;
}

export const usePlaybookStore = create<PlaybookState>((set, get) => ({
  playbooks: [],
  currentPlaybook: null,
  isLoading: false,
  error: null,

  fetchPlaybooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('playbooks')
        .select('*')
        .order('emergency_type')
        .order('name');

      if (error) throw error;

      set({ playbooks: (data ?? []) as Playbook[], isLoading: false });
    } catch (error) {
      console.error('Error fetching playbooks:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchPlaybook: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: playbook, error: playbookError } = await (supabase as any)
        .from('playbooks')
        .select('*')
        .eq('id', id)
        .single();

      if (playbookError) throw playbookError;

      const { data: tasks, error: tasksError } = await (supabase as any)
        .from('playbook_tasks')
        .select('*')
        .eq('playbook_id', id)
        .order('sequence_number');

      if (tasksError) throw tasksError;

      set({
        currentPlaybook: { ...(playbook as Playbook), tasks: (tasks ?? []) as PlaybookTask[] },
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching playbook:', error);
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createPlaybook: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // Get user's organization
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: profile } = await (supabase as any)
        .from('users')
        .select('organization_id')
        .eq('id', userData.user.id)
        .single();

      if (!profile) throw new Error('User profile not found');

      const { data: playbook, error } = await (supabase as any)
        .from('playbooks')
        .insert({
          organization_id: profile.organization_id,
          name: data.name,
          description: data.description ?? null,
          emergency_type: data.emergency_type,
          is_default: data.is_default ?? false,
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh playbooks list
      await get().fetchPlaybooks();

      set({ isLoading: false });
      return { id: (playbook as Playbook).id, error: null };
    } catch (error) {
      console.error('Error creating playbook:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { id: null, error: error as Error };
    }
  },

  updatePlaybook: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await (supabase as any).from('playbooks').update(data).eq('id', id);

      if (error) throw error;

      // Update local state
      set((state) => ({
        playbooks: state.playbooks.map((p) => (p.id === id ? { ...p, ...data } : p)),
        currentPlaybook:
          state.currentPlaybook?.id === id
            ? { ...state.currentPlaybook, ...data }
            : state.currentPlaybook,
        isLoading: false,
      }));

      return { error: null };
    } catch (error) {
      console.error('Error updating playbook:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { error: error as Error };
    }
  },

  deletePlaybook: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await (supabase as any).from('playbooks').delete().eq('id', id);

      if (error) throw error;

      set((state) => ({
        playbooks: state.playbooks.filter((p) => p.id !== id),
        currentPlaybook: state.currentPlaybook?.id === id ? null : state.currentPlaybook,
        isLoading: false,
      }));

      return { error: null };
    } catch (error) {
      console.error('Error deleting playbook:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { error: error as Error };
    }
  },

  createTask: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { data: task, error } = await (supabase as any)
        .from('playbook_tasks')
        .insert({
          playbook_id: data.playbook_id,
          sequence_number: data.sequence_number,
          title: data.title,
          description: data.description ?? null,
          assigned_role: data.assigned_role ?? null,
          estimated_duration: data.estimated_duration ?? null,
          depends_on_task_id: data.depends_on_task_id ?? null,
          condition: data.condition ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update current playbook if it matches
      set((state) => ({
        currentPlaybook:
          state.currentPlaybook?.id === data.playbook_id
            ? {
                ...state.currentPlaybook,
                tasks: [...state.currentPlaybook.tasks, task as PlaybookTask].sort(
                  (a, b) => a.sequence_number - b.sequence_number
                ),
              }
            : state.currentPlaybook,
        isLoading: false,
      }));

      return { id: (task as PlaybookTask).id, error: null };
    } catch (error) {
      console.error('Error creating task:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { id: null, error: error as Error };
    }
  },

  updateTask: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await (supabase as any).from('playbook_tasks').update(data).eq('id', id);

      if (error) throw error;

      // Update current playbook's tasks
      set((state) => ({
        currentPlaybook: state.currentPlaybook
          ? {
              ...state.currentPlaybook,
              tasks: state.currentPlaybook.tasks
                .map((t) => (t.id === id ? { ...t, ...data } : t))
                .sort((a, b) => a.sequence_number - b.sequence_number),
            }
          : null,
        isLoading: false,
      }));

      return { error: null };
    } catch (error) {
      console.error('Error updating task:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { error: error as Error };
    }
  },

  deleteTask: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await (supabase as any).from('playbook_tasks').delete().eq('id', id);

      if (error) throw error;

      set((state) => ({
        currentPlaybook: state.currentPlaybook
          ? {
              ...state.currentPlaybook,
              tasks: state.currentPlaybook.tasks.filter((t) => t.id !== id),
            }
          : null,
        isLoading: false,
      }));

      return { error: null };
    } catch (error) {
      console.error('Error deleting task:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { error: error as Error };
    }
  },

  reorderTasks: async (playbookId, taskIds) => {
    set({ isLoading: true, error: null });
    try {
      // Update sequence numbers based on new order
      const updates = taskIds.map((id, index) =>
        (supabase as any)
          .from('playbook_tasks')
          .update({ sequence_number: index + 1 })
          .eq('id', id)
      );

      await Promise.all(updates);

      // Refresh playbook
      await get().fetchPlaybook(playbookId);

      set({ isLoading: false });
      return { error: null };
    } catch (error) {
      console.error('Error reordering tasks:', error);
      set({ error: (error as Error).message, isLoading: false });
      return { error: error as Error };
    }
  },
}));

// Selector hooks
export const usePlaybooks = () => usePlaybookStore((state) => state.playbooks);
export const useCurrentPlaybook = () => usePlaybookStore((state) => state.currentPlaybook);
export const usePlaybooksByType = (type: EmergencyType) =>
  usePlaybookStore((state) => state.playbooks.filter((p) => p.emergency_type === type));
