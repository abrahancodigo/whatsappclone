"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Contact } from "@/types/database";
import { UserPlus, Search, Users, X, MessageCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
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

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("contacts")
        .select("*, profile:profiles!contact_id(*)")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as (Contact & { profile: Profile })[];
    },
    enabled: !!profile,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", profile?.id || "")
        .limit(100);
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: !!profile,
  });

  const contactIds = new Set(contacts.map((c) => c.contact_id));

  const searchResults = allUsers.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    const matchesQuery =
      u.display_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.phone?.includes(q);
    return matchesQuery && !contactIds.has(u.id);
  });

  const addContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!profile) throw new Error("No autenticado");
      const { error } = await (supabase.from("contacts") as any).insert({
        user_id: profile.id,
        contact_id: contactId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setUserSearchQuery("");
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!profile) throw new Error("No autenticado");
      const { error } = await (supabase
        .from("contacts")
        .delete()
        .eq("user_id", profile.id)
        .eq("contact_id", contactId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const startChatMutation = useMutation({
    mutationFn: async (contactId: string) => {
      if (!profile) throw new Error("No autenticado");

      const { data: memberChats } = await (supabase
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", profile.id) as any);

      if (memberChats && memberChats.length > 0) {
        const chatIds = memberChats.map((m: any) => m.chat_id as string);
        const { data: existingChats } = await supabase
          .from("chats")
          .select("id, type, chat_members(user_id)")
          .in("id", chatIds)
          .eq("type", "direct");

        if (existingChats) {
          for (const chat of existingChats as any[]) {
            const members = (chat.chat_members || []) as { user_id: string }[];
            const otherIds = members
              .filter((m) => m.user_id !== profile.id)
              .map((m) => m.user_id);
            if (otherIds.includes(contactId)) {
              return chat.id;
            }
          }
        }
      }

      const chatId = crypto.randomUUID();
      const { error } = await (supabase.from("chats") as any).insert({
        id: chatId,
        type: "direct",
        created_by: profile.id,
      });
      if (error) throw error;

      await (supabase.from("chat_members") as any).insert([
        { chat_id: chatId, user_id: profile.id },
        { chat_id: chatId, user_id: contactId },
      ]);

      return chatId;
    },
    onSuccess: (chatId) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
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

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.profile?.display_name?.toLowerCase().includes(q) ||
      c.profile?.username?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[var(--color-wa-green)] p-2">
            <Users className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-tx-primary)]">Contactos</h1>
        </div>
        <button
          onClick={() => setIsAddingContact(!isAddingContact)}
          className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
        >
          <UserPlus className="h-5 w-5" />
        </button>
      </div>

      {isAddingContact && (
        <div ref={userSearchRef} className="border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel-2)] p-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-tx-tertiary)]" />
              <input
                type="text"
                placeholder="Buscar por nombre, usuario o teléfono..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                autoFocus
                className="w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 pl-10 text-sm text-[var(--color-tx-primary)] placeholder:text-[var(--color-tx-tertiary)] focus:border-[var(--color-wa-green)] focus:outline-none"
              />
            </div>
            {userSearchQuery && searchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-panel)]">
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-hover)]"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-500 text-sm font-medium text-white">
                      {(u.display_name || u.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[var(--color-tx-primary)]">
                        {u.display_name || u.username}
                      </div>
                      <div className="truncate text-xs text-[var(--color-tx-tertiary)]">
                        @{u.username}
                        {u.phone && ` · ${u.phone}`}
                      </div>
                    </div>
                    <button
                      onClick={() => addContactMutation.mutate(u.id)}
                      disabled={addContactMutation.isPending}
                      className="flex-shrink-0 rounded-md bg-[var(--color-wa-green)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-wa-green-dark)] disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}
            {userSearchQuery && searchResults.length === 0 && (
              <div className="rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4 text-center text-sm text-[var(--color-tx-secondary)]">
                No se encontraron usuarios
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-tx-tertiary)]" />
          <input
            type="text"
            placeholder="Buscar contactos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] py-2 pl-10 pr-4 text-sm text-[var(--color-tx-primary)] placeholder:text-[var(--color-tx-tertiary)] focus:border-[var(--color-wa-green)] focus:outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--color-wa-green)]"></div>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <Users className="mb-4 h-12 w-12 text-[var(--color-tx-tertiary)]" />
          <h3 className="mb-2 text-lg font-medium text-[var(--color-tx-primary)]">
            {searchQuery ? "Sin resultados" : "Sin contactos"}
          </h3>
          <p className="text-[var(--color-tx-secondary)]">
            {searchQuery
              ? "No se encontraron contactos con ese nombre"
              : "Toca + para agregar tu primer contacto"}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.map((contact) => {
            const p = contact.profile;
            if (!p) return null;
            return (
              <div
                key={contact.contact_id}
                className="flex items-center gap-3 border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4 hover:bg-[var(--color-bg-panel-2)] transition-colors"
              >
                <div className="h-12 w-12 flex-shrink-0">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.display_name}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: "#3b82f6" }}
                    >
                      {(p.display_name || p.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-[var(--color-tx-primary)]">
                    {p.display_name || p.username}
                  </h3>
                  <p className="truncate text-xs text-[var(--color-tx-tertiary)]">
                    @{p.username}
                    {p.about && ` · ${p.about}`}
                  </p>
                </div>

                <div className="flex flex-shrink-0 gap-1">
                  <button
                    onClick={() => startChatMutation.mutate(contact.contact_id)}
                    disabled={startChatMutation.isPending}
                    className="rounded-full p-2 text-[var(--color-wa-green)] hover:bg-[var(--color-bg-hover)]"
                    title="Enviar mensaje"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => removeContactMutation.mutate(contact.contact_id)}
                    disabled={removeContactMutation.isPending}
                    className="rounded-full p-2 text-[var(--color-tx-tertiary)] hover:bg-red-500/10 hover:text-red-400"
                    title="Eliminar contacto"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
