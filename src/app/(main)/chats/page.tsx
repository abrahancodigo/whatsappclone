"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Chat, type ChatMember } from "@/types/database";
import { formatChatListTime } from "@/lib/utils";
import { MessageCircle, Search, Plus, Users, X, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function ChatsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatType, setNewChatType] = useState<"direct" | "group">("direct");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const userSearchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const u = (await supabase.auth.getUser()).data.user;
      if (!u) throw new Error("No autenticado");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", profile?.id || "")
        .limit(50);
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: !!profile,
  });

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.about?.toLowerCase().includes(q)
    );
  });

  const { data: chats = [], isLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data: rawData, error } = await supabase
        .from("chats")
        .select(
          `*,\n         chat_members!inner(*),\n         messages!left(content, created_at, sender_id),\n         profiles!chat_members.user_id(*)`
        )
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const data = rawData as any[] || [];
      const processed = data.map((chat) => {
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
      if (newChatType === "direct" && !selectedUser) return null;

      const existingChat = chats.find((c) => {
        if (c.type !== "direct") return false;
        const chatMembers = (c as any).chat_members || [];
        const otherIds = chatMembers
          .filter((m: ChatMember) => m.user_id !== profile.id)
          .map((m: ChatMember) => m.user_id);
        return otherIds.includes(selectedUser!.id);
      });

      if (existingChat) return existingChat.id;

      const chatId = crypto.randomUUID();
      const { error } = await (supabase.from("chats") as any).insert({
        id: chatId,
        type: newChatType,
        name: newChatType === "group" ? newChatName : null,
        created_by: profile.id,
      });

      if (error) throw error;

      if (newChatType === "direct") {
        await (supabase.from("chat_members") as any).insert([
          { chat_id: chatId, user_id: profile.id },
          { chat_id: chatId, user_id: selectedUser!.id },
        ]);
      } else {
        await (supabase.from("chat_members") as any).insert([
          { chat_id: chatId, user_id: profile.id, role: "admin" },
        ]);
      }

      return chatId;
    },
    onSuccess: (chatId) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setIsCreatingChat(false);
      setNewChatName("");
      setSelectedUser(null);
      setUserSearchQuery("");
      if (chatId) router.push(`/chats/${chatId}`);
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userSearchRef.current && !userSearchRef.current.contains(event.target as Node)) {
        setUserSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredChats = chats.filter((chat) =>
    chat.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canCreate =
    newChatType === "group" ? !!newChatName.trim() : !!selectedUser;

  const handleStartCreate = () => {
    setIsCreatingChat(true);
    setSelectedUser(null);
    setUserSearchQuery("");
    setNewChatName("");
  };

  const handleCancelCreate = () => {
    setIsCreatingChat(false);
    setNewChatName("");
    setSelectedUser(null);
    setUserSearchQuery("");
  };

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
            onClick={handleStartCreate}
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
              <div ref={userSearchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-tx-tertiary)]" />
                  <input
                    type="text"
                    placeholder="Buscar usuario..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 pl-10 text-sm text-[var(--color-tx-primary)] placeholder:text-[var(--color-tx-tertiary)] focus:border-[var(--color-wa-green)] focus:outline-none"
                  />
                </div>
                {userSearchQuery && filteredUsers.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] shadow-lg">
                    {filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setUserSearchQuery("");
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[var(--color-tx-primary)] hover:bg-[var(--color-bg-hover)]"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-xs font-medium text-white">
                          {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{u.display_name || u.username}</div>
                          <div className="text-xs text-[var(--color-tx-tertiary)]">@{u.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedUser && (
                  <div className="mt-2 flex items-center gap-2 rounded-md bg-[var(--color-wa-green)]/10 p-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-xs font-medium text-white">
                      {(selectedUser.display_name || selectedUser.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm text-[var(--color-tx-primary)]">
                      {selectedUser.display_name || selectedUser.username}
                    </span>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="rounded-full p-1 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCancelCreate}
                className="flex-1 rounded-md bg-[var(--color-bg-hover)] px-3 py-2 text-sm font-medium text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-panel-2)]"
              >
                Cancelar
              </button>
              <button
                onClick={() => createChatMutation.mutate()}
                disabled={createChatMutation.isPending || !canCreate}
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
