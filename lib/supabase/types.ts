export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      actions: {
        Row: {
          id: string;
          label: string;
        };
        Insert: {
          id: string;
          label: string;
        };
        Update: {
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      inventory_edit_log: {
        Row: {
          after_data: Json;
          before_data: Json;
          changed_at: string | null;
          changed_by: string | null;
          id: string;
          reason: string | null;
          row_id: string;
          table_name: string;
        };
        Insert: {
          after_data: Json;
          before_data: Json;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          reason?: string | null;
          row_id: string;
          table_name: string;
        };
        Update: {
          after_data?: Json;
          before_data?: Json;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          reason?: string | null;
          row_id?: string;
          table_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_edit_log_changed_by_fkey';
            columns: ['changed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      issues: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          delete_reason: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          dest_site_id: string | null;
          id: string;
          is_deleted: boolean | null;
          issue_date: string;
          issued_to_legacy: string | null;
          item_id: string;
          location_ref_id: string | null;
          party_id: string | null;
          qty: number;
          rate: number | null;
          remarks: string | null;
          site_id: string;
          unit: string;
          updated_at: string | null;
          worker_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dest_site_id?: string | null;
          id?: string;
          is_deleted?: boolean | null;
          issue_date?: string;
          issued_to_legacy?: string | null;
          item_id: string;
          location_ref_id?: string | null;
          party_id?: string | null;
          qty: number;
          rate?: number | null;
          remarks?: string | null;
          site_id: string;
          unit: string;
          updated_at?: string | null;
          worker_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          dest_site_id?: string | null;
          id?: string;
          is_deleted?: boolean | null;
          issue_date?: string;
          issued_to_legacy?: string | null;
          item_id?: string;
          location_ref_id?: string | null;
          party_id?: string | null;
          qty?: number;
          rate?: number | null;
          remarks?: string | null;
          site_id?: string;
          unit?: string;
          updated_at?: string | null;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'issues_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_dest_site_id_fkey';
            columns: ['dest_site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_location_ref_id_fkey';
            columns: ['location_ref_id'];
            isOneToOne: false;
            referencedRelation: 'location_references';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_party_id_fkey';
            columns: ['party_id'];
            isOneToOne: false;
            referencedRelation: 'parties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_unit_fkey';
            columns: ['unit'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'issues_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          },
        ];
      };
      item_categories: {
        Row: {
          id: string;
          label: string;
        };
        Insert: {
          id: string;
          label: string;
        };
        Update: {
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      items: {
        Row: {
          category_id: string | null;
          code: string | null;
          created_at: string | null;
          hsn_code: string | null;
          id: string;
          name: string;
          reorder_level: number | null;
          stock_unit: string;
        };
        Insert: {
          category_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          hsn_code?: string | null;
          id?: string;
          name: string;
          reorder_level?: number | null;
          stock_unit: string;
        };
        Update: {
          category_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          hsn_code?: string | null;
          id?: string;
          name?: string;
          reorder_level?: number | null;
          stock_unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'items_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'item_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'items_stock_unit_fkey';
            columns: ['stock_unit'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['id'];
          },
        ];
      };
      location_references: {
        Row: {
          created_at: string | null;
          full_code: string;
          full_path: string;
          id: string;
          site_id: string;
          template_node_id: string | null;
          unit_id: string;
        };
        Insert: {
          created_at?: string | null;
          full_code: string;
          full_path: string;
          id?: string;
          site_id: string;
          template_node_id?: string | null;
          unit_id: string;
        };
        Update: {
          created_at?: string | null;
          full_code?: string;
          full_path?: string;
          id?: string;
          site_id?: string;
          template_node_id?: string | null;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_references_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_references_template_node_id_fkey';
            columns: ['template_node_id'];
            isOneToOne: false;
            referencedRelation: 'location_template_nodes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_references_unit_id_fkey';
            columns: ['unit_id'];
            isOneToOne: false;
            referencedRelation: 'location_units';
            referencedColumns: ['id'];
          },
        ];
      };
      location_template_nodes: {
        Row: {
          code: string;
          id: string;
          name: string;
          parent_id: string | null;
          position: number | null;
          template_id: string;
          type: string;
        };
        Insert: {
          code: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          position?: number | null;
          template_id: string;
          type: string;
        };
        Update: {
          code?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          position?: number | null;
          template_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_template_nodes_parent_id_fkey';
            columns: ['parent_id'];
            isOneToOne: false;
            referencedRelation: 'location_template_nodes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_template_nodes_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'location_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_template_nodes_type_fkey';
            columns: ['type'];
            isOneToOne: false;
            referencedRelation: 'location_types';
            referencedColumns: ['id'];
          },
        ];
      };
      location_templates: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      location_types: {
        Row: {
          id: string;
          label: string;
        };
        Insert: {
          id: string;
          label: string;
        };
        Update: {
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      location_units: {
        Row: {
          code: string;
          id: string;
          name: string;
          position: number | null;
          site_id: string;
          template_id: string | null;
          type: string;
        };
        Insert: {
          code: string;
          id?: string;
          name: string;
          position?: number | null;
          site_id: string;
          template_id?: string | null;
          type: string;
        };
        Update: {
          code?: string;
          id?: string;
          name?: string;
          position?: number | null;
          site_id?: string;
          template_id?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_units_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_units_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'location_templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_units_type_fkey';
            columns: ['type'];
            isOneToOne: false;
            referencedRelation: 'location_types';
            referencedColumns: ['id'];
          },
        ];
      };
      modules: {
        Row: {
          id: string;
          label: string;
        };
        Insert: {
          id: string;
          label: string;
        };
        Update: {
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      parties: {
        Row: {
          address: string | null;
          created_at: string | null;
          gstin: string | null;
          id: string;
          name: string;
          phone: string | null;
          short_code: string | null;
          type: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          gstin?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          short_code?: string | null;
          type: string;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          gstin?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          short_code?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'parties_type_fkey';
            columns: ['type'];
            isOneToOne: false;
            referencedRelation: 'party_types';
            referencedColumns: ['id'];
          },
        ];
      };
      party_types: {
        Row: {
          id: string;
          label: string;
        };
        Insert: {
          id: string;
          label: string;
        };
        Update: {
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string | null;
          full_name: string;
          id: string;
          is_active: boolean | null;
          phone: string | null;
          role_id: string;
          updated_at: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          full_name: string;
          id: string;
          is_active?: boolean | null;
          phone?: string | null;
          role_id?: string;
          updated_at?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean | null;
          phone?: string | null;
          role_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_approved_by_fkey';
            columns: ['approved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profiles_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      purchases: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          delete_reason: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          hsn_sac: string | null;
          id: string;
          invoice_date: string | null;
          invoice_no: string | null;
          is_deleted: boolean | null;
          item_id: string;
          manufacturer: string | null;
          rate: number | null;
          receipt_date: string;
          received_qty: number;
          received_unit: string;
          remarks: string | null;
          site_id: string;
          stock_qty: number | null;
          stock_unit: string;
          supplier_part_no: string | null;
          total_amount: number | null;
          unit_conv_factor: number;
          updated_at: string | null;
          vendor_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          hsn_sac?: string | null;
          id?: string;
          invoice_date?: string | null;
          invoice_no?: string | null;
          is_deleted?: boolean | null;
          item_id: string;
          manufacturer?: string | null;
          rate?: number | null;
          receipt_date?: string;
          received_qty: number;
          received_unit: string;
          remarks?: string | null;
          site_id: string;
          stock_qty?: number | null;
          stock_unit: string;
          supplier_part_no?: string | null;
          total_amount?: number | null;
          unit_conv_factor?: number;
          updated_at?: string | null;
          vendor_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          delete_reason?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          hsn_sac?: string | null;
          id?: string;
          invoice_date?: string | null;
          invoice_no?: string | null;
          is_deleted?: boolean | null;
          item_id?: string;
          manufacturer?: string | null;
          rate?: number | null;
          receipt_date?: string;
          received_qty?: number;
          received_unit?: string;
          remarks?: string | null;
          site_id?: string;
          stock_qty?: number | null;
          stock_unit?: string;
          supplier_part_no?: string | null;
          total_amount?: number | null;
          unit_conv_factor?: number;
          updated_at?: string | null;
          vendor_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_deleted_by_fkey';
            columns: ['deleted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_received_unit_fkey';
            columns: ['received_unit'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_stock_unit_fkey';
            columns: ['stock_unit'];
            isOneToOne: false;
            referencedRelation: 'units';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'parties';
            referencedColumns: ['id'];
          },
        ];
      };
      role_permissions: {
        Row: {
          action_id: string;
          id: string;
          module_id: string;
          role_id: string;
        };
        Insert: {
          action_id: string;
          id?: string;
          module_id: string;
          role_id: string;
        };
        Update: {
          action_id?: string;
          id?: string;
          module_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_action_id_fkey';
            columns: ['action_id'];
            isOneToOne: false;
            referencedRelation: 'actions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_permissions_module_id_fkey';
            columns: ['module_id'];
            isOneToOne: false;
            referencedRelation: 'modules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
        ];
      };
      roles: {
        Row: {
          description: string | null;
          id: string;
          label: string;
          level: number;
        };
        Insert: {
          description?: string | null;
          id: string;
          label: string;
          level: number;
        };
        Update: {
          description?: string | null;
          id?: string;
          label?: string;
          level?: number;
        };
        Relationships: [];
      };
      site_user_access: {
        Row: {
          granted_at: string | null;
          granted_by: string | null;
          id: string;
          role_id: string;
          site_id: string;
          user_id: string;
        };
        Insert: {
          granted_at?: string | null;
          granted_by?: string | null;
          id?: string;
          role_id: string;
          site_id: string;
          user_id: string;
        };
        Update: {
          granted_at?: string | null;
          granted_by?: string | null;
          id?: string;
          role_id?: string;
          site_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'site_user_access_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_user_access_role_id_fkey';
            columns: ['role_id'];
            isOneToOne: false;
            referencedRelation: 'roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_user_access_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_user_access_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      site_user_permission_overrides: {
        Row: {
          access_id: string;
          action_id: string;
          granted: boolean;
          id: string;
          module_id: string;
        };
        Insert: {
          access_id: string;
          action_id: string;
          granted?: boolean;
          id?: string;
          module_id: string;
        };
        Update: {
          access_id?: string;
          action_id?: string;
          granted?: boolean;
          id?: string;
          module_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'site_user_permission_overrides_access_id_fkey';
            columns: ['access_id'];
            isOneToOne: false;
            referencedRelation: 'site_user_access';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_user_permission_overrides_action_id_fkey';
            columns: ['action_id'];
            isOneToOne: false;
            referencedRelation: 'actions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'site_user_permission_overrides_module_id_fkey';
            columns: ['module_id'];
            isOneToOne: false;
            referencedRelation: 'modules';
            referencedColumns: ['id'];
          },
        ];
      };
      sites: {
        Row: {
          address: string | null;
          code: string;
          created_at: string | null;
          id: string;
          name: string;
          type: string | null;
        };
        Insert: {
          address?: string | null;
          code: string;
          created_at?: string | null;
          id?: string;
          name: string;
          type?: string | null;
        };
        Update: {
          address?: string | null;
          code?: string;
          created_at?: string | null;
          id?: string;
          name?: string;
          type?: string | null;
        };
        Relationships: [];
      };
      units: {
        Row: {
          category: string | null;
          id: string;
          label: string;
        };
        Insert: {
          category?: string | null;
          id: string;
          label: string;
        };
        Update: {
          category?: string | null;
          id?: string;
          label?: string;
        };
        Relationships: [];
      };
      workers: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          current_site_id: string;
          full_name: string;
          home_city: string | null;
          id: string;
          is_active: boolean;
          phone: string | null;
        };
        Insert: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          current_site_id: string;
          full_name: string;
          home_city?: string | null;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          current_site_id?: string;
          full_name?: string;
          home_city?: string | null;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'workers_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workers_current_site_id_fkey';
            columns: ['current_site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_site_assignments: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string;
          effective_to: string | null;
          id: string;
          reason: string | null;
          site_id: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          effective_to?: string | null;
          id?: string;
          reason?: string | null;
          site_id: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          reason?: string | null;
          site_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_site_assignments_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_site_assignments_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_site_assignments_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          },
        ];
      };
      worker_affiliations: {
        Row: {
          contractor_party_id: string | null;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          effective_to: string | null;
          employment_type: Database['public']['Enums']['employment_type'];
          id: string;
          worker_id: string;
        };
        Insert: {
          contractor_party_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          effective_to?: string | null;
          employment_type: Database['public']['Enums']['employment_type'];
          id?: string;
          worker_id: string;
        };
        Update: {
          contractor_party_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          employment_type?: Database['public']['Enums']['employment_type'];
          id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'worker_affiliations_contractor_party_id_fkey';
            columns: ['contractor_party_id'];
            isOneToOne: false;
            referencedRelation: 'parties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_affiliations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'worker_affiliations_worker_id_fkey';
            columns: ['worker_id'];
            isOneToOne: false;
            referencedRelation: 'workers';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      item_weighted_avg_cost: {
        Row: {
          item_id: string | null;
          site_id: string | null;
          wac_per_stock_unit: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_balance: {
        Row: {
          current_stock: number | null;
          gei_code: string | null;
          item_id: string | null;
          item_name: string | null;
          net_issued: number | null;
          site_id: string | null;
          total_received: number | null;
          unit: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_item_id_fkey';
            columns: ['item_id'];
            isOneToOne: false;
            referencedRelation: 'items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchases_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      can_user: {
        Args: {
          p_action_id: string;
          p_module_id: string;
          p_site_id: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      is_admin_anywhere: { Args: { p_user_id: string }; Returns: boolean };
      resolve_location: {
        Args: { p_code: string; p_site_id: string };
        Returns: string;
      };
    };
    Enums: {
      employment_type: 'DIRECT' | 'CONTRACTOR_EMPLOYEE' | 'SUBCONTRACTOR_LENT';
      txn_party_type: 'SITE_STORE' | 'LOCATION' | 'CONTRACTOR' | 'EXTERNAL_SITE' | 'SUPPLIER';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      employment_type: ['DIRECT', 'CONTRACTOR_EMPLOYEE', 'SUBCONTRACTOR_LENT'],
      txn_party_type: ['SITE_STORE', 'LOCATION', 'CONTRACTOR', 'EXTERNAL_SITE', 'SUPPLIER'],
    },
  },
} as const;
