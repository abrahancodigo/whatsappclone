"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Chat, type ChatMember } from "@/types/database";
import { formatChatListTime } from "@/lib/utils";
import { MessageCircle, Search, Plus, Phone, Video, Users, MoreVertical, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function ChatsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatType, setNewChatType] = useState<"direct" | "group">("direct");
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select(
          `*,\n         chat_members!inner(*),\n         messages!left(content, created_at, sender_id),\n         profiles!chat_members.user_id(*)`
        )
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const processed = (data || []).map((chat) => {
        const otherMembers = (chat.chat_members || []).filter(
          (m: ChatMember) => m.user_id !== profile?.id
        );
        const lastMessage = chat.messages?.[0];
        const otherProfile = otherMembers[0]?.profiles as Profile | undefined;

        return {
          ...chat,
          display_name:
            chat.type === "direct"
              ? otherProfile?.display_name || otherProfile?.username || "Unknown"
              : chat.name || "Grupo sin nombre",
          avatar_url:
            chat.type === "direct"
              ? otherProfile?.avatar_url || null
              : chat.avatar_url || null,
          last_message: lastMessage?.content || null,
          last_message_at: lastMessage?.created_at || chat.last_message_at,
          last_message_sender_id: lastMessage?.sender_id || null,
        };
      });

      return processed as (Chat & {
        display_name: string;
        avatar_url: string | null;
        last_message: string | null;
        last_message_at: string;
        last_message_sender_id: string | null;
      })[];
    },
    enabled: !!profile,
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return null;
      const chatId = crypto.randomUUID();
      const { error } = await supabase.from("chats").insert({
        id: chatId,
        type: newChatType,
        name: newChatType === "group" ? newChatName : null,
        created_by: profile.id,
      });

      if (error) throw error;

      if (newChatType === "direct") {
        await supabase.from("chat_members").insert([
          { chat_id: chatId, user_id: profile.id },
          { chat_id: chatId, user_id: newChatName },
        ]);
      } else {
        await supabase.from("chat_members").insert([
          { chat_id: chatId, user_id: profile.id, role: "admin" },
        ]);
      }

      return chatId;
    },
    onSuccess: (chatId) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setIsCreatingChat(false);
      setNewChatName("");
      if (chatId) router.push(`/chats/${chatId}`);
    },
  });

  const filteredChats = chats.filter((chat) =>
    chat.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[var(--color-wa-green)] p-2">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-tx-primary)]">Chats</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCreatingChat(true)}
            className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-tx-tertiary)]" />
          <input
            type="text"
            placeholder="Buscar chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] py-2 pl-10 pr-4 text-sm text-[var(--color-tx-primary)] placeholder:text-[var(--color-tx-tertiary)] focus:border-[var(--color-wa-green)] focus:outline-none"
          />
        </div>
      </div>

      {isCreatingChat && (
        <div className="border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel-2)] p-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setNewChatType("direct")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  newChatType === "direct"
                    ? "bg-[var(--color-wa-green)] text-white"
                    : "bg-[var(--color-bg-hover)] text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-panel-2)]"
                )}
              >
                Directo
              </button>
              <button
                onClick={() => setNewChatType("group")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  newChatType === "group"
                    ? "bg-[var(--color-wa-green)] text-white"
                    : "bg-[var(--color-bg-hover)] text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-panel-2)]"
                )}
              >
                Grupo
              </button>
            </div>

            {newChatType === "group" && (
              <input
                type="text"
                placeholder="Nombre del grupo"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-tx-primary)] focus:border-[var(--color-wa-green)] focus:outline-none"
              />
            )}

            {newChatType === "direct" && (
              <input
                type="text"
                placeholder="ID de usuario (email)"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-tx-primary)] focus:border-[var(--color-wa-green)] focus:outline-none"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setIsCreatingChat(false)}
                className="flex-1 rounded-md bg-[var(--color-bg-hover)] px-3 py-2 text-sm font-medium text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-panel-2)]"
              >
                Cancelar
              </button>
              <button
                onClick={() => createChatMutation.mutate()}
                disabled={createChatMutation.isPending || !newChatName}
                className="flex-1 rounded-md bg-[var(--color-wa-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-wa-green-dark)] disabled:opacity-50"
              >
                {createChatMutation.isPending ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--color-wa-green)]"></div>
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <MessageCircle className="mb-4 h-12 w-12 text-[var(--color-tx-tertiary)]" />
          <h3 className="mb-2 text-lg font-medium text-[var(--color-tx-primary)]">No hay chats</h3>
          <p className="text-[var(--color-tx-secondary)]">
            {searchQuery ? "No se encontraron chats" : "Crea tu primer chat"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <Link
              key={chat.id}
              href={`/chats/${chat.id}`}
              className="block border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] hover:bg-[var(--color-bg-panel-2)] transition-colors"
            >
              <div className="flex items-center gap-3 p-4">
                <div className="relative h-12 w-12 flex-shrink-0">
                  {chat.avatar_url ? (
                    <img
                      src={chat.avatar_url}
                      alt={chat.display_name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: "#3b82f6" }}
                    >
                      {chat.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="truncate text-sm font-medium text-[var(--color-tx-primary)]">
                      {chat.display_name}
                    </h3>
                    <span className="text-xs text-[var(--color-tx-tertiary)]">
                      {formatChatListTime(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="truncate text-xs text-[var(--color-tx-secondary)]">
                      {chat.last_message_sender_id === profile?.id && "Tú: "}
                      {chat.last_message || "No hay mensajes"}
                    </p>
                    {chat.type === "direct" ? (
                      <Phone className="h-3 w-3 text-[var(--color-tx-tertiary)]" />
                    ) : (
                      <Users className="h-3 w-3 text-[var(--color-tx-tertiary)]" />
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
