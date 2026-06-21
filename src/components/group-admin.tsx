"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type ChatMember } from "@/types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UserPlus, UserMinus, Shield, ShieldOff, LogOut } from "lucide-react";

interface GroupAdminProps {
  chatId: string;
  currentUserId: string;
  onClose: () => void;
}

export function GroupAdmin({ chatId, currentUserId, onClose }: GroupAdminProps) {
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["chat-members", chatId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("chat_members")
        .select("*, profiles:user_id(id, username, display_name, avatar_url)")
        .eq("chat_id", chatId) as any);
      if (error) throw error;
      return data as (ChatMember & { profiles: Profile })[];
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .limit(100) as any);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: showAddMember,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase
        .from("chat_members")
        .insert({ chat_id: chatId, user_id: userId, role: "member" } as never) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-members", chatId] });
      setShowAddMember(false);
      setSearchQuery("");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", chatId)
        .eq("user_id", userId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-members", chatId] });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, currentRole }: { userId: string; currentRole: string }) => {
      const newRole = currentRole === "admin" ? "member" : "admin";
      const { error } = await (supabase
        .from("chat_members")
        .update({ role: newRole } as never)
        .eq("chat_id", chatId)
        .eq("user_id", userId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-members", chatId] });
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", chatId)
        .eq("user_id", currentUserId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-members", chatId] });
      onClose();
    },
  });

  const currentMember = members?.find((m) => m.user_id === currentUserId);
  const isAdmin = currentMember?.role === "admin";

  const filteredProfiles = allProfiles?.filter(
    (p) =>
      p.id !== currentUserId &&
      !members?.some((m) => m.user_id === p.id) &&
      (p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-xl bg-[var(--color-bg-panel)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border-wa)] p-4">
          <h2 className="text-lg font-semibold text-[var(--color-tx-primary)]">Administrar grupo</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-[var(--color-bg-hover)]">
            <X className="h-5 w-5 text-[var(--color-tx-secondary)]" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {isAdmin && (
            <div className="mb-4">
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-[var(--color-wa-green)] hover:bg-[var(--color-bg-hover)]"
              >
                <UserPlus className="h-5 w-5" />
                <span className="font-medium">Agregar miembro</span>
              </button>

              {showAddMember && (
                <div className="mt-2 ml-8">
                  <input
                    type="text"
                    placeholder="Buscar por nombre o usuario..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-tx-primary)] focus:border-[var(--color-wa-green)] focus:outline-none"
                    autoFocus
                  />
                  {filteredProfiles && filteredProfiles.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border-wa)]">
                      {filteredProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => addMemberMutation.mutate(profile.id)}
                          className="flex w-full items-center gap-3 p-2 text-left hover:bg-[var(--color-bg-hover)]"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-wa-green)] text-xs font-medium text-white">
                            {profile.display_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--color-tx-primary)]">{profile.display_name}</p>
                            <p className="text-xs text-[var(--color-tx-tertiary)]">@{profile.username}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery && filteredProfiles && filteredProfiles.length === 0 && (
                    <p className="mt-2 text-sm text-[var(--color-tx-tertiary)]">No se encontraron usuarios</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <p className="mb-2 text-xs font-medium uppercase text-[var(--color-tx-tertiary)]">
              Miembros ({members?.length || 0})
            </p>
            {members?.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between rounded-lg p-2 hover:bg-[var(--color-bg-hover)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-wa-green)] text-sm font-medium text-white">
                    {member.profiles?.display_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                        {member.profiles?.display_name}
                      </p>
                      {member.role === "admin" && (
                        <Shield className="h-3.5 w-3.5 text-[var(--color-wa-green)]" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-tx-tertiary)]">@{member.profiles?.username}</p>
                  </div>
                </div>

                {member.user_id !== currentUserId && isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        toggleAdminMutation.mutate({
                          userId: member.user_id,
                          currentRole: member.role,
                        })
                      }
                      className="rounded-full p-1.5 hover:bg-[var(--color-bg-panel-2)]"
                      title={member.role === "admin" ? "Quitar admin" : "Hacer admin"}
                    >
                      {member.role === "admin" ? (
                        <ShieldOff className="h-4 w-4 text-[var(--color-tx-secondary)]" />
                      ) : (
                        <Shield className="h-4 w-4 text-[var(--color-tx-secondary)]" />
                      )}
                    </button>
                    <button
                      onClick={() => removeMemberMutation.mutate(member.user_id)}
                      className="rounded-full p-1.5 text-red-400 hover:bg-red-500/10"
                      title="Eliminar del grupo"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--color-border-wa)] p-4">
          <button
            onClick={() => {
              if (confirm("¿Seguro que quieres salir del grupo?")) {
                leaveGroupMutation.mutate();
              }
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm font-medium text-red-400 hover:bg-red-500/20"
          >
            <LogOut className="h-4 w-4" />
            Salir del grupo
          </button>
        </div>
      </div>
    </div>
  );
}
