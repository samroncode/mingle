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
      award_categories: {
        Row: {
          event_id: string;
          id: string;
          position: number;
          revealed_at: string | null;
          status: string;
          text: string;
          vote_count: number;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          id?: string;
          position: number;
          revealed_at?: string | null;
          status?: string;
          text: string;
          vote_count?: number;
        };
        Update: {
          event_id?: string;
          id?: string;
          position?: number;
          revealed_at?: string | null;
          status?: string;
          text?: string;
          vote_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "award_categories_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      award_votes: {
        Row: {
          category_id: string;
          event_id: string;
          updated_at: string;
          voted_for_id: string;
          voter_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          event_id: string;
          updated_at?: string;
          voted_for_id: string;
          voter_id: string;
        };
        Update: {
          category_id?: string;
          event_id?: string;
          updated_at?: string;
          voted_for_id?: string;
          voter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "award_votes_category_id_event_id_fkey";
            columns: ["category_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "award_categories";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "award_votes_event_id_voted_for_id_fkey";
            columns: ["event_id", "voted_for_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["event_id", "user_id"];
          },
          {
            foreignKeyName: "award_votes_event_id_voter_id_fkey";
            columns: ["event_id", "voter_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["event_id", "user_id"];
          },
        ];
      };
      events: {
        Row: {
          code: string;
          created_at: string;
          current_module: string | null;
          current_step: number;
          enabled_modules: string[];
          expires_at: string;
          id: string;
          language: string;
          niche: string;
          party: NonNullable<Json>;
          phase: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          current_module?: string | null;
          current_step?: number;
          enabled_modules?: string[];
          expires_at?: string;
          id?: string;
          language: string;
          niche: string;
          party?: NonNullable<Json>;
          phase?: string;
          status?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          current_module?: string | null;
          current_step?: number;
          enabled_modules?: string[];
          expires_at?: string;
          id?: string;
          language?: string;
          niche?: string;
          party?: NonNullable<Json>;
          phase?: string;
          status?: string;
        };
        Relationships: [];
      };
      hot_take_answers: {
        Row: {
          agree: boolean;
          event_id: string;
          guest_id: string;
          hot_take_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agree: boolean;
          event_id: string;
          guest_id: string;
          hot_take_id: string;
          updated_at?: string;
        };
        Update: {
          agree?: boolean;
          event_id?: string;
          guest_id?: string;
          hot_take_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hot_take_answers_event_id_guest_id_fkey";
            columns: ["event_id", "guest_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["event_id", "user_id"];
          },
          {
            foreignKeyName: "hot_take_answers_hot_take_id_event_id_fkey";
            columns: ["hot_take_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "hot_takes";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      hot_takes: {
        Row: {
          answer_count: number;
          event_id: string;
          id: string;
          position: number;
          revealed_at: string | null;
          status: string;
          text: string;
        };
        ComputedFields: never;
        Insert: {
          answer_count?: number;
          event_id: string;
          id?: string;
          position: number;
          revealed_at?: string | null;
          status?: string;
          text: string;
        };
        Update: {
          answer_count?: number;
          event_id?: string;
          id?: string;
          position?: number;
          revealed_at?: string | null;
          status?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hot_takes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          created_at: string;
          display_name: string | null;
          event_id: string;
          removed_at: string | null;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string | null;
          event_id: string;
          removed_at?: string | null;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          event_id?: string;
          removed_at?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_answer_keys: {
        Row: {
          correct: number;
          question_id: string;
        };
        ComputedFields: never;
        Insert: {
          correct: number;
          question_id: string;
        };
        Update: {
          correct?: number;
          question_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_answer_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "quiz_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_answers: {
        Row: {
          chosen: number;
          event_id: string;
          question_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          chosen: number;
          event_id: string;
          question_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chosen?: number;
          event_id?: string;
          question_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_answers_event_id_user_id_fkey";
            columns: ["event_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["event_id", "user_id"];
          },
          {
            foreignKeyName: "quiz_answers_question_id_event_id_fkey";
            columns: ["question_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "quiz_questions";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      quiz_questions: {
        Row: {
          answer_count: number;
          event_id: string;
          id: string;
          options: string[];
          position: number;
          revealed_at: string | null;
          status: string;
          text: string;
        };
        ComputedFields: never;
        Insert: {
          answer_count?: number;
          event_id: string;
          id?: string;
          options: string[];
          position: number;
          revealed_at?: string | null;
          status?: string;
          text: string;
        };
        Update: {
          answer_count?: number;
          event_id?: string;
          id?: string;
          options?: string[];
          position?: number;
          revealed_at?: string | null;
          status?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      award_progress: {
        Args: { target_event_id: string };
        Returns: {
          revealed: number;
          total: number;
        }[];
      };
      award_results: {
        Args: { target_event_id: string };
        Returns: {
          category_id: string;
          category_position: number;
          category_text: string;
          user_id: string;
          votes: number;
        }[];
      };
      award_tally: {
        Args: { target_category_id: string };
        Returns: {
          user_id: string;
          votes: number;
        }[];
      };
      award_voters: {
        Args: { target_category_id: string };
        Returns: {
          user_id: string;
        }[];
      };
      award_winners: {
        Args: { target_category_id: string };
        Returns: {
          user_id: string;
          votes: number;
        }[];
      };
      awards_won: {
        Args: { target_event_id: string };
        Returns: {
          awards: number;
          user_id: string;
        }[];
      };
      can_answer_hot_take: {
        Args: { target_event_id: string; target_hot_take_id: string };
        Returns: boolean;
      };
      can_answer_quiz_question: {
        Args: { target_event_id: string; target_question_id: string };
        Returns: boolean;
      };
      can_read_award_category: {
        Args: {
          category_position: number;
          category_revealed_at: string;
          category_status: string;
          target_event_id: string;
        };
        Returns: boolean;
      };
      can_read_hot_take: {
        Args: {
          take_position: number;
          take_revealed_at: string;
          take_status: string;
          target_event_id: string;
        };
        Returns: boolean;
      };
      can_read_quiz_key: {
        Args: { target_question_id: string };
        Returns: boolean;
      };
      can_read_quiz_question: {
        Args: {
          question_position: number;
          question_revealed_at: string;
          question_status: string;
          target_event_id: string;
        };
        Returns: boolean;
      };
      can_vote_award: {
        Args: {
          target_category_id: string;
          target_event_id: string;
          target_guest_id: string;
        };
        Returns: boolean;
      };
      claim_host: {
        Args: { caller: string; target_event_id: string };
        Returns: boolean;
      };
      consume_rate_limit: {
        Args: {
          action: string;
          caller: string;
          max_attempts: number;
          window_seconds: number;
        };
        Returns: boolean;
      };
      create_event: {
        Args: {
          admin_key_hash: string;
          awards?: Json;
          caller: string;
          code: string;
          enabled_modules: string[];
          hottakes?: Json;
          language: string;
          niche: string;
          party: Json;
          quiz?: Json;
        };
        Returns: string;
      };
      event_admin_key_hash: {
        Args: { code: string };
        Returns: {
          admin_key_hash: string;
          event_id: string;
        }[];
      };
      hot_take_highlights: {
        Args: { target_event_id: string };
        Returns: {
          agree_count: number;
          disagree_count: number;
          highlight: string;
          hot_take_id: string;
          hot_take_position: number;
          hot_take_text: string;
        }[];
      };
      hot_take_progress: {
        Args: { target_event_id: string };
        Returns: {
          revealed: number;
          total: number;
        }[];
      };
      hot_take_result: {
        Args: { target_hot_take_id: string };
        Returns: {
          agree_count: number;
          disagree_count: number;
        }[];
      };
      is_host: { Args: { target_event_id: string }; Returns: boolean };
      is_member: { Args: { target_event_id: string }; Returns: boolean };
      join_event: {
        Args: { code: string; display_name: string };
        Returns: Database["public"]["CompositeTypes"]["join_result"];
        SetofOptions: {
          from: "*";
          to: "join_result";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_tv: {
        Args: { code: string };
        Returns: Database["public"]["CompositeTypes"]["join_result"];
        SetofOptions: {
          from: "*";
          to: "join_result";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      my_award_votes: {
        Args: { target_category_id: string };
        Returns: {
          votes: number;
        }[];
      };
      my_hot_take_majority: {
        Args: { target_event_id: string };
        Returns: {
          answered: number;
          sided: number;
        }[];
      };
      ping: { Args: never; Returns: boolean };
      quiz_progress: {
        Args: { target_event_id: string };
        Returns: {
          played: number;
          total: number;
        }[];
      };
      quiz_scores: {
        Args: { target_event_id: string };
        Returns: {
          display_name: string;
          place: number;
          score: number;
          user_id: string;
        }[];
      };
      quiz_votes: {
        Args: { target_question_id: string };
        Returns: {
          option: number;
          votes: number;
        }[];
      };
      rate_limit_reached: {
        Args: {
          action: string;
          caller: string;
          max_attempts: number;
          window_seconds: number;
        };
        Returns: boolean;
      };
      remove_guest: {
        Args: { target_event_id: string; target_user_id: string };
        Returns: string;
      };
      rename_guest: {
        Args: {
          new_name: string;
          target_event_id: string;
          target_user_id: string;
        };
        Returns: string;
      };
      set_event_flow: {
        Args: {
          from_module?: string;
          from_phase: string;
          from_status: string;
          from_step: number;
          target_event_id: string;
          to_module?: string;
          to_phase: string;
          to_status: string;
          to_step: number;
        };
        Returns: boolean;
      };
      update_award_categories: {
        Args: { categories: Json; target_event_id: string };
        Returns: string;
      };
      update_event_party: {
        Args: { party: Json; target_event_id: string };
        Returns: string;
      };
      update_hot_takes: {
        Args: { takes: Json; target_event_id: string };
        Returns: string;
      };
      update_quiz_questions: {
        Args: { questions: Json; target_event_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      join_result: {
        event_id: string | null;
        error: string | null;
      };
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
