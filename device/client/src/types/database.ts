// Database types generated from Supabase schema
// Run: supabase gen types typescript --local > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'security' | 'teacher' | 'volunteer';
export type EmergencyType = 'fire' | 'lockdown' | 'medical' | 'weather' | 'evacuation' | 'other';
export type EmergencyStatus = 'active' | 'resolved' | 'cancelled';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      buildings: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          address: string | null;
          floor_plans: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          address?: string | null;
          floor_plans?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          address?: string | null;
          floor_plans?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          building_id: string;
          name: string;
          floor_level: number;
          boundary: unknown | null;
          centroid: unknown | null;
          capacity: number | null;
          room_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          name: string;
          floor_level?: number;
          boundary?: unknown | null;
          centroid?: unknown | null;
          capacity?: number | null;
          room_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          building_id?: string;
          name?: string;
          floor_level?: number;
          boundary?: unknown | null;
          centroid?: unknown | null;
          capacity?: number | null;
          room_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      beacons: {
        Row: {
          id: string;
          room_id: string | null;
          hardware_id: string;
          name: string | null;
          position: unknown | null;
          floor_level: number;
          tx_power_1m: number | null;
          is_bridge: boolean;
          battery_level: number | null;
          last_seen_at: string | null;
          firmware_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id?: string | null;
          hardware_id: string;
          name?: string | null;
          position?: unknown | null;
          floor_level?: number;
          tx_power_1m?: number | null;
          is_bridge?: boolean;
          battery_level?: number | null;
          last_seen_at?: string | null;
          firmware_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string | null;
          hardware_id?: string;
          name?: string | null;
          position?: unknown | null;
          floor_level?: number;
          tx_power_1m?: number | null;
          is_bridge?: boolean;
          battery_level?: number | null;
          last_seen_at?: string | null;
          firmware_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          primary_building_id: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          primary_building_id?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          primary_building_id?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      playbooks: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          emergency_type: EmergencyType;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          emergency_type: EmergencyType;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          emergency_type?: EmergencyType;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      playbook_tasks: {
        Row: {
          id: string;
          playbook_id: string;
          sequence_number: number;
          title: string;
          description: string | null;
          assigned_role: UserRole | null;
          assigned_user_id: string | null;
          estimated_duration: number | null;
          depends_on_task_id: string | null;
          condition: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          playbook_id: string;
          sequence_number: number;
          title: string;
          description?: string | null;
          assigned_role?: UserRole | null;
          assigned_user_id?: string | null;
          estimated_duration?: number | null;
          depends_on_task_id?: string | null;
          condition?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          playbook_id?: string;
          sequence_number?: number;
          title?: string;
          description?: string | null;
          assigned_role?: UserRole | null;
          assigned_user_id?: string | null;
          estimated_duration?: number | null;
          depends_on_task_id?: string | null;
          condition?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      emergency_events: {
        Row: {
          id: string;
          organization_id: string;
          building_id: string | null;
          emergency_type: EmergencyType;
          status: EmergencyStatus;
          triggered_by_user_id: string | null;
          triggered_at_beacon_id: string | null;
          active_playbook_id: string | null;
          notes: string | null;
          started_at: string;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          building_id?: string | null;
          emergency_type: EmergencyType;
          status?: EmergencyStatus;
          triggered_by_user_id?: string | null;
          triggered_at_beacon_id?: string | null;
          active_playbook_id?: string | null;
          notes?: string | null;
          started_at?: string;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          building_id?: string | null;
          emergency_type?: EmergencyType;
          status?: EmergencyStatus;
          triggered_by_user_id?: string | null;
          triggered_at_beacon_id?: string | null;
          active_playbook_id?: string | null;
          notes?: string | null;
          started_at?: string;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      emergency_task_instances: {
        Row: {
          id: string;
          emergency_event_id: string;
          playbook_task_id: string;
          status: TaskStatus;
          completed_by_user_id: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          emergency_event_id: string;
          playbook_task_id: string;
          status?: TaskStatus;
          completed_by_user_id?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          emergency_event_id?: string;
          playbook_task_id?: string;
          status?: TaskStatus;
          completed_by_user_id?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      location_updates: {
        Row: {
          id: string;
          user_id: string;
          room_id: string | null;
          position: unknown | null;
          floor_level: number | null;
          confidence: number | null;
          beacon_readings: Json | null;
          emergency_event_id: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          room_id?: string | null;
          position?: unknown | null;
          floor_level?: number | null;
          confidence?: number | null;
          beacon_readings?: Json | null;
          emergency_event_id?: string | null;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          room_id?: string | null;
          position?: unknown | null;
          floor_level?: number | null;
          confidence?: number | null;
          beacon_readings?: Json | null;
          emergency_event_id?: string | null;
          recorded_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          details: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      trigger_emergency: {
        Args: {
          p_emergency_type: EmergencyType;
          p_building_id?: string | null;
          p_beacon_id?: string | null;
          p_notes?: string | null;
        };
        Returns: string;
      };
      resolve_emergency: {
        Args: {
          p_event_id: string;
          p_notes?: string | null;
        };
        Returns: void;
      };
      complete_task: {
        Args: {
          p_task_instance_id: string;
          p_notes?: string | null;
        };
        Returns: void;
      };
      record_location: {
        Args: {
          p_room_id?: string | null;
          p_latitude?: number | null;
          p_longitude?: number | null;
          p_floor_level?: number | null;
          p_confidence?: number | null;
          p_beacon_readings?: Json | null;
        };
        Returns: string;
      };
      get_active_emergency: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          emergency_type: EmergencyType;
          status: EmergencyStatus;
          building_id: string | null;
          building_name: string | null;
          started_at: string;
          playbook_id: string | null;
          playbook_name: string | null;
          total_tasks: number;
          completed_tasks: number;
        }[];
      };
      get_my_tasks: {
        Args: Record<string, never>;
        Returns: {
          task_instance_id: string;
          task_id: string;
          sequence_number: number;
          title: string;
          description: string | null;
          status: TaskStatus;
          completed_at: string | null;
          depends_on_completed: boolean;
        }[];
      };
      get_personnel_locations: {
        Args: Record<string, never>;
        Returns: {
          user_id: string;
          user_name: string | null;
          user_role: UserRole;
          room_id: string | null;
          room_name: string | null;
          building_name: string | null;
          floor_level: number | null;
          confidence: number | null;
          last_update: string | null;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      emergency_type: EmergencyType;
      emergency_status: EmergencyStatus;
      task_status: TaskStatus;
    };
  };
}
