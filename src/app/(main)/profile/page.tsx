"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile } from "@/types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, User, Edit3, Check, X } from "lucide-react";
import Image from "next/image";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("No autenticado");
      const { data, error } = await (supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single() as any);
      if (error) throw error;
      setDisplayName(data.display_name);
      setAbout(data.about);
      return data as Profile;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;

      let avatarUrl = profile.avatar_url;

      if (selectedImage) {
        const fileExt = selectedImage.name.split(".").pop();
        const filePath = `${profile.id}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      const { error } = await (supabase
        .from("profiles")
        .update({
          display_name: displayName,
          about: about,
          avatar_url: avatarUrl,
        } as never)
        .eq("id", profile.id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setIsEditing(false);
      setSelectedImage(null);
      setPreviewImage(null);
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!displayName.trim()) return;
    updateProfileMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-bg-app)]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--color-wa-green)]"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      <div className="border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <h1 className="text-xl font-semibold text-[var(--color-tx-primary)]">Perfil</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            {previewImage || profile?.avatar_url ? (
              <Image
                src={previewImage || profile?.avatar_url || ""}
                alt="Profile"
                width={120}
                height={120}
                className="h-30 w-30 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-30 w-30 items-center justify-center rounded-full text-4xl font-medium text-white"
                style={{ backgroundColor: "#3b82f6" }}
              >
                {profile?.display_name?.charAt(0).toUpperCase()}
              </div>
            )}
            {isEditing && (
              <label className="absolute bottom-0 right-0 rounded-full bg-[var(--color-wa-green)] p-2 text-white hover:bg-[var(--color-wa-green-dark)]">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </label>
            )}
          </div>

          {isEditing ? (
            <div className="w-full max-w-md space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-tx-secondary)]">Nombre para mostrar</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-tx-primary)] focus:border-[var(--color-wa-green)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-tx-secondary)]">Acerca de</label>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="w-full resize-none rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-tx-primary)] focus:border-[var(--color-wa-green)] focus:outline-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-md bg-[var(--color-bg-hover)] px-3 py-2 text-sm font-medium text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-panel-2)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!displayName.trim() || updateProfileMutation.isPending}
                  className="flex-1 rounded-md bg-[var(--color-wa-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-wa-green-dark)] disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md space-y-4">
              <div className="rounded-lg border border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-lg font-medium text-[var(--color-tx-primary)]">Información personal</h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[var(--color-tx-tertiary)]">Nombre de usuario</p>
                    <p className="text-sm text-[var(--color-tx-primary)]">{profile?.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-tx-tertiary)]">Nombre para mostrar</p>
                    <p className="text-sm text-[var(--color-tx-primary)]">{profile?.display_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-tx-tertiary)]">Acerca de</p>
                    <p className="text-sm text-[var(--color-tx-primary)]">{profile?.about}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
                <h2 className="mb-3 text-lg font-medium text-[var(--color-tx-primary)]">Configuración</h2>
                <div className="space-y-2">
                  <button className="w-full rounded-lg p-3 text-left text-sm text-[var(--color-tx-primary)] hover:bg-[var(--color-bg-hover)]">
                    Notificaciones
                  </button>
                  <button className="w-full rounded-lg p-3 text-left text-sm text-[var(--color-tx-primary)] hover:bg-[var(--color-bg-hover)]">
                    Privacidad
                  </button>
                  <button className="w-full rounded-lg p-3 text-left text-sm text-[var(--color-tx-primary)] hover:bg-[var(--color-bg-hover)]">
                    Archivos multimedia
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
