export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      rail_station_regions: {
        Row: {
          id: string;
          bounds: unknown;
          revision: string;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          bounds: unknown;
          revision?: string;
          updated_at?: string | null;
        };
        Update: {
          bounds?: unknown;
          revision?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      rail_stations: {
        Row: {
          id: string;
          region_id: string;
          name: string;
          local_name: string;
          kind: string;
          lat: number;
          lng: number;
          location: unknown;
          source: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          region_id: string;
          name: string;
          local_name: string;
          kind: string;
          lat: number;
          lng: number;
          source?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          local_name?: string;
          kind?: string;
          lat?: number;
          lng?: number;
          source?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      anonymous_map_place_votes: {
        Row: {
          created_at: string;
          map_place_id: string;
          token_hash: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          map_place_id: string;
          token_hash: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          map_place_id?: string;
          token_hash?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "anonymous_map_place_votes_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_place_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anonymous_map_place_votes_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_places";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          map_place_id: string;
          status: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          map_place_id: string;
          status?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          map_place_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_place_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_places";
            referencedColumns: ["id"];
          },
        ];
      };
      map_follows: {
        Row: {
          created_at: string;
          map_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          map_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          map_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_follows_map_id_fkey";
            columns: ["map_id"];
            isOneToOne: false;
            referencedRelation: "theme_maps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_follows_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      map_place_votes: {
        Row: {
          map_place_id: string;
          updated_at: string;
          user_id: string;
          value: number;
        };
        Insert: {
          map_place_id: string;
          updated_at?: string;
          user_id: string;
          value: number;
        };
        Update: {
          map_place_id?: string;
          updated_at?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "map_place_votes_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_place_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_place_votes_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_place_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      map_places: {
        Row: {
          added_by: string | null;
          created_at: string;
          id: string;
          map_id: string;
          merged_into_id: string | null;
          place_id: string;
          rationale: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          map_id: string;
          merged_into_id?: string | null;
          place_id: string;
          rationale: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          added_by?: string | null;
          created_at?: string;
          id?: string;
          map_id?: string;
          merged_into_id?: string | null;
          place_id?: string;
          rationale?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_places_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_places_map_id_fkey";
            columns: ["map_id"];
            isOneToOne: false;
            referencedRelation: "theme_maps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_places_merged_into_id_fkey";
            columns: ["merged_into_id"];
            isOneToOne: false;
            referencedRelation: "map_place_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_places_merged_into_id_fkey";
            columns: ["merged_into_id"];
            isOneToOne: false;
            referencedRelation: "map_places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_places_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      our_search_places: {
        Row: {
          address: string;
          alternate_names: string[];
          category: string | null;
          country_code: string;
          imported_at: string;
          latitude: number;
          locality: string | null;
          location: unknown;
          longitude: number;
          primary_name: string;
          region: string | null;
          release: string;
          search_text: string;
          source: string;
          source_id: string;
        };
        Insert: {
          address?: string;
          alternate_names?: string[];
          category?: string | null;
          country_code: string;
          imported_at?: string;
          latitude: number;
          locality?: string | null;
          location?: unknown;
          longitude: number;
          primary_name: string;
          region?: string | null;
          release: string;
          search_text: string;
          source: string;
          source_id: string;
        };
        Update: {
          address?: string;
          alternate_names?: string[];
          category?: string | null;
          country_code?: string;
          imported_at?: string;
          latitude?: number;
          locality?: string | null;
          location?: unknown;
          longitude?: number;
          primary_name?: string;
          region?: string | null;
          release?: string;
          search_text?: string;
          source?: string;
          source_id?: string;
        };
        Relationships: [];
      };
      place_photos: {
        Row: {
          author_id: string | null;
          caption: string;
          cleanup_paths: string[];
          created_at: string;
          file_path: string;
          height: number | null;
          id: string;
          lease: string | null;
          place_id: string;
          status: string;
          thumbnail_path: string;
          updated_at: string;
          width: number | null;
        };
        Insert: {
          author_id?: string | null;
          caption?: string;
          cleanup_paths?: string[];
          created_at?: string;
          file_path: string;
          height?: number | null;
          id: string;
          lease?: string | null;
          place_id: string;
          status?: string;
          thumbnail_path: string;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          author_id?: string | null;
          caption?: string;
          cleanup_paths?: string[];
          created_at?: string;
          file_path?: string;
          height?: number | null;
          id?: string;
          lease?: string | null;
          place_id?: string;
          status?: string;
          thumbnail_path?: string;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "place_photos_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "place_photos_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      places: {
        Row: {
          address: string;
          category: string;
          city: string;
          country: string;
          created_at: string;
          created_by: string | null;
          id: string;
          location: unknown;
          merged_into_id: string | null;
          name: string;
          region: string | null;
          source_type: string;
          status: string;
        };
        Insert: {
          address?: string;
          category?: string;
          city: string;
          country: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location: unknown;
          merged_into_id?: string | null;
          name: string;
          region?: string | null;
          source_type?: string;
          status?: string;
        };
        Update: {
          address?: string;
          category?: string;
          city?: string;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: unknown;
          merged_into_id?: string | null;
          name?: string;
          region?: string | null;
          source_type?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "places_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "places_merged_into_id_fkey";
            columns: ["merged_into_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string;
          created_at: string;
          handle: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          handle: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string;
          created_at?: string;
          handle?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          comment_id: string | null;
          created_at: string;
          id: string;
          map_place_id: string | null;
          photo_id: string | null;
          reason: string;
          reporter_id: string | null;
          status: string;
        };
        Insert: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          map_place_id?: string | null;
          photo_id?: string | null;
          reason: string;
          reporter_id?: string | null;
          status?: string;
        };
        Update: {
          comment_id?: string | null;
          created_at?: string;
          id?: string;
          map_place_id?: string | null;
          photo_id?: string | null;
          reason?: string;
          reporter_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_place_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_photo_id_fkey";
            columns: ["photo_id"];
            isOneToOne: false;
            referencedRelation: "place_photos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saves: {
        Row: {
          created_at: string;
          map_place_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          map_place_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          map_place_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saves_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_place_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saves_map_place_id_fkey";
            columns: ["map_place_id"];
            isOneToOne: false;
            referencedRelation: "map_places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      search_query_aliases: {
        Row: {
          country_code: string;
          created_at: string;
          generator: string;
          japanese_queries: string[];
          normalized_query: string;
          updated_at: string;
        };
        Insert: {
          country_code: string;
          created_at?: string;
          generator?: string;
          japanese_queries?: string[];
          normalized_query: string;
          updated_at?: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          generator?: string;
          japanese_queries?: string[];
          normalized_query?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      theme_maps: {
        Row: {
          bounds: Json;
          city: string;
          country: string;
          created_at: string;
          description: string;
          id: string;
          rules: string;
          slug: string;
          status: string;
          tags: string[];
          title: string;
        };
        Insert: {
          bounds: Json;
          city: string;
          country: string;
          created_at?: string;
          description: string;
          id?: string;
          rules: string;
          slug: string;
          status?: string;
          tags?: string[];
          title: string;
        };
        Update: {
          bounds?: Json;
          city?: string;
          country?: string;
          created_at?: string;
          description?: string;
          id?: string;
          rules?: string;
          slug?: string;
          status?: string;
          tags?: string[];
          title?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      map_place_cards: {
        Row: {
          added_by: string | null;
          address: string | null;
          category: string | null;
          created_at: string | null;
          handle: string | null;
          id: string | null;
          last_verified_at: string | null;
          lat: number | null;
          lng: number | null;
          map_id: string | null;
          map_slug: string | null;
          map_title: string | null;
          name: string | null;
          negative: number | null;
          place_id: string | null;
          positive: number | null;
          rationale: string | null;
          saved_count: number | null;
          status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "map_places_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_places_map_id_fkey";
            columns: ["map_id"];
            isOneToOne: false;
            referencedRelation: "theme_maps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_places_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      search_map_places: { Args: { payload: Json }; Returns: Json };
      search_normalize: { Args: { t: string }; Returns: string };
      search_compact: { Args: { t: string }; Returns: string };
      search_city: { Args: { t: string }; Returns: string };
      search_area: { Args: { t: string }; Returns: string };
      search_category: { Args: { t: string }; Returns: string };
      nearby_rail_stations: { Args: { p: string }; Returns: Json };
      replace_rail_station_region: {
        Args: { r: string; stations: Json };
        Returns: undefined;
      };
      ack_photo_cleanup: {
        Args: { p_id: string; p_paths: string[] };
        Returns: undefined;
      };
      admin_snapshot: { Args: never; Returns: Json };
      community_command: { Args: { payload: Json }; Returns: Json };
      expire_photo_uploads: { Args: never; Returns: string[] };
      fail_place_photo: {
        Args: { p_id: string; p_lease: string };
        Returns: undefined;
      };
      finish_place_photo: {
        Args: {
          p_height: number;
          p_id: string;
          p_lease: string;
          p_width: number;
        };
        Returns: boolean;
      };
      finish_provider: {
        Args: { ms: number; r: string; result: string };
        Returns: undefined;
      };
      link_provider: {
        Args: { external_id_value: string; mp: string; p: string; u: string };
        Returns: undefined;
      };
      map_pending_places: { Args: { m: string }; Returns: Json };
      map_place_for_map: { Args: { m: string; target: string }; Returns: Json };
      map_places_in_bounds: {
        Args: { e: number; m: string; n: number; s: number; w: number };
        Returns: Json;
      };
      map_stats: { Args: { m: string }; Returns: Json };
      map_stats_all: {
        Args: never;
        Returns: {
          contributor_count: number;
          follower_count: number;
          map_id: string;
          place_count: number;
        }[];
      };
      merge_anonymous_votes: { Args: { p_token_hash: string }; Returns: Json };
      my_proposals: { Args: { page_num: number }; Returns: Json };
      overture_place_details: {
        Args: { external_id_value: string; m: string };
        Returns: Json;
      };
      pending_map_place: { Args: { m: string }; Returns: boolean };
      place_check_summary: { Args: { m: string }; Returns: Json };
      record_anonymous_vote: {
        Args: { p_target: string; p_token_hash: string; p_value: number };
        Returns: Json;
      };
      reserve_place_photo: {
        Args: {
          p_caption: string;
          p_id: string;
          p_lease: string;
          p_place: string;
        };
        Returns: Json;
      };
      reserve_provider: {
        Args: {
          cost: number;
          m: string;
          op: string;
          p: string;
          session_id: string;
          u: string;
        };
        Returns: string;
      };
      reserve_search_operation: {
        Args: { operation: string; u: string };
        Returns: boolean;
      };
      resolve_provider: {
        Args: { external_id_value: string; p: string };
        Returns: string;
      };
      resolve_provider_place: {
        Args: { external_id_value: string; p: string };
        Returns: Json;
      };
      saved_place_cards: { Args: never; Returns: Json };
      search_internal_places: { Args: { m: string; q: string }; Returns: Json };
      search_overture_places: { Args: { m: string; q: string }; Returns: Json };
      submit_proposal: { Args: { payload: Json }; Returns: string };
      submit_proposal_result: { Args: { payload: Json }; Returns: Json };
      submit_resolved_proposal: {
        Args: {
          allow_ref: boolean;
          external_id_value: string;
          p: string;
          payload: Json;
          u: string;
        };
        Returns: string;
      };
      submit_resolved_proposal_result: {
        Args: {
          allow_ref: boolean;
          external_id_value: string;
          p: string;
          payload: Json;
          u: string;
        };
        Returns: Json;
      };
      usage_snapshot: { Args: never; Returns: Json };
      viewer_role: { Args: never; Returns: string };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
