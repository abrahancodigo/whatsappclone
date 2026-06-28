export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          about: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string;
          avatar_url?: string | null;
          about?: string;
          phone?: string | null;
        };
        Update: {
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          about?: string;
          phone?: string | null;
        };
      };
      chats: {
        Row: {
          id: string;
          type: "direct" | "group";
          name: string | null;
          description: string | null;
          avatar_url: string | null;
          created_by: string | null;
          created_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          type?: "direct" | "group";
          name?: string | null;
          description?: string | null;
          avatar_url?: string | null;
          created_by?: string | null;
          last_message_at?: string;
        };
        Update: {
          name?: string | null;
          description?: string | null;
          avatar_url?: string | null;
        };
      };
      chat_members: {
        Row: {
          chat_id: string;
          user_id: string;
          role: "member" | "admin";
          joined_at: string;
          last_read_at: string;
        };
        Insert: {
          chat_id: string;
          user_id: string;
          role?: "member" | "admin";
          last_read_at?: string;
        };
        Update: {
          last_read_at?: string;
          role?: "member" | "admin";
        };
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          sender_id: string;
          content: string | null;
          type: "text" | "image" | "file" | "audio" | "system";
          file_url: string | null;
          file_name: string | null;
          file_size: number | null;
          reply_to_id: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          chat_id: string;
          sender_id: string;
          content?: string | null;
          type?: "text" | "image" | "file" | "audio" | "system";
          file_url?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          reply_to_id?: string | null;
        };
        Update: {
          content?: string | null;
          deleted_at?: string | null;
        };
      };
      statuses: {
        Row: {
          id: string;
          user_id: string;
          type: "text" | "image";
          content: string | null;
          file_url: string | null;
          bg_color: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: "text" | "image";
          content?: string | null;
          file_url?: string | null;
          bg_color?: string;
          caption?: string | null;
        };
        Update: {
          content?: string | null;
          caption?: string | null;
        };
      };
      status_views: {
        Row: {
          status_id: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          status_id: string;
          user_id: string;
        };
        Update: {};
      };
      calls: {
        Row: {
          id: string;
          chat_id: string | null;
          room_name: string;
          type: "audio" | "video";
          status: "started" | "answered" | "declined" | "missed" | "ended";
          started_by: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          chat_id?: string | null;
          room_name: string;
          type?: "audio" | "video";
          status?: "started" | "answered" | "declined" | "missed" | "ended";
          started_by: string;
          ended_at?: string | null;
        };
        Update: {
          status?: "started" | "answered" | "declined" | "missed" | "ended";
          ended_at?: string | null;
        };
      };
      contacts: {
        Row: {
          user_id: string;
          contact_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          contact_id: string;
        };
        Update: {};
      };
    };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Chat = Database["public"]["Tables"]["chats"]["Row"];
export type ChatMember = Database["public"]["Tables"]["chat_members"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Status = Database["public"]["Tables"]["statuses"]["Row"];
export type StatusView = Database["public"]["Tables"]["status_views"]["Row"];
export type Call = Database["public"]["Tables"]["calls"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];

export type ContactWithProfile = Contact & { profile: Profile };

export type MessageWithSender = Message & {
  sender?: Pick<Profile, "id" | "display_name" | "username" | "avatar_url">;
};
