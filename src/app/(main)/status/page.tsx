"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Status } from "@/types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, X, Clock, Check, MoreVertical } from "lucide-react";
import Image from "next/image";

export default function StatusPage() {
  const [isCreatingStatus, setIsCreatingStatus] = useState(false);
  const [statusContent, setStatusContent] = useState("");
  const [statusType, setStatusType] = useState<"text" | "image">("text");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: profile } = useQuery({
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
      return data as Profile;
    },
  });

  const { data: statuses = [] } = useQuery({
    queryKey: ["statuses"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("statuses")
        .select(
          `*,\n         profiles!user_id(*)`,
          { head: false }
        )
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return data as (Status & { profiles: Profile })[];
    },
    enabled: !!profile,
  });

  const createStatusMutation = useMutation({
    mutationFn: async () => {
      if (!profile) return;

      let fileUrl = null;

      if (selectedImage) {
        const fileExt = selectedImage.name.split(".").pop();
        const filePath = `${profile.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("statuses")
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("statuses")
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
      }

      const { error } = await (supabase.from("statuses") as any).insert({
        user_id: profile.id,
        type: statusType,
        content: statusType === "text" ? statusContent : null,
        file_url: fileUrl,
        bg_color: "#075e54",
        caption: null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["statuses"] });
      setIsCreatingStatus(false);
      setStatusContent("");
      setStatusType("text");
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

  const handleCreateStatus = () => {
    if ((statusType === "text" && !statusContent.trim()) || (statusType === "image" && !selectedImage)) return;
    createStatusMutation.mutate();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d`;
    }
  };

  const userStatuses = statuses.filter((s) => s.user_id === profile?.id);
  const otherUserStatuses = statuses.filter((s) => s.user_id !== profile?.id);

  const renderMyStatus = () => {
    if (userStatuses.length > 0) {
      return (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {userStatuses.map((status) => {
            return (
              <div key={status.id} className="flex flex-col items-center gap-1">
                <div className="relative">
                  {status.type === "image" && status.file_url ? (
                    <Image
                      src={status.file_url}
                      alt="Estado"
                      width={60}
                      height={60}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-medium text-white"
                      style={{ backgroundColor: status.bg_color || "#075e54" }}
                    >
                      {(status.profiles as Profile).display_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute -right-1 -top-1 rounded-full bg-[var(--color-bg-app)] p-0.5">
                    <Check className="h-3 w-3 text-[var(--color-wa-green)]" />
                  </div>
                </div>
                <span className="text-xs text-[var(--color-tx-secondary)]">Tú</span>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--color-border-wa)] p-6 text-center">
        <div className="rounded-full bg-[var(--color-bg-panel-2)] p-3">
          <Camera className="h-6 w-6 text-[var(--color-tx-tertiary)]" />
        </div>
        <p className="text-sm text-[var(--color-tx-secondary)]">Agrega un estado</p>
      </div>
    );
  };

  const renderCreateForm = () => {
    if (!isCreatingStatus) return null;
    return (
      <div className="border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel-2)] p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-tx-primary)]">Mi estado</span>
            <button
              onClick={() => setIsCreatingStatus(false)}
              className="text-[var(--color-tx-secondary)] hover:text-[var(--color-tx-primary)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStatusType("text")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${statusType === "text"
                ? "bg-[var(--color-wa-green)] text-white"
                : "bg-[var(--color-bg-hover)] text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-panel-2)]"
                }`}
            >
              Texto
            </button>
            <button
              onClick={() => setStatusType("image")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${statusType === "image"
                ? "bg-[var(--color-wa-green)] text-white"
                : "bg-[var(--color-bg-hover)] text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-panel-2)]"
                }`}
            >
              Imagen
            </button>
          </div>

          {statusType === "text" ? (
            <textarea
              value={statusContent}
              onChange={(e) => setStatusContent(e.target.value)}
              placeholder="Escribe un estado..."
              className="w-full resize-none rounded-md border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-tx-primary)] placeholder:text-[var(--color-tx-tertiary)] focus:border-[var(--color-wa-green)] focus:outline-none"
              rows={3}
            />
          ) : (
            <div className="space-y-2">
              {previewImage ? (
                <div className="relative">
                  <Image
                    src={previewImage}
                    alt="Vista previa"
                    width={400}
                    height={300}
                    className="w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => {
                      setPreviewImage(null);
                      setSelectedImage(null);
                    }}
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border-wa)] bg-[var(--color-bg-panel-2)] p-8 transition-colors hover:border-[var(--color-wa-green)]">
                  <Camera className="mb-2 h-8 w-8 text-[var(--color-tx-tertiary)]" />
                  <span className="text-sm text-[var(--color-tx-secondary)]">Toca para agregar una foto</span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageSelect}
                  />
                </label>
              )}
            </div>
          )}

          <button
            onClick={handleCreateStatus}
            disabled={createStatusMutation.isPending || ((statusType === "text" && !statusContent.trim()) || (statusType === "image" && !selectedImage))}
            className="w-full rounded-md bg-[var(--color-wa-green)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-wa-green-dark)] disabled:opacity-50"
          >
            {createStatusMutation.isPending ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <h1 className="text-xl font-semibold text-[var(--color-tx-primary)]">Estados</h1>
        <button
          onClick={() => setIsCreatingStatus(true)}
          className="rounded-full bg-[var(--color-wa-green)] p-2 text-white hover:bg-[var(--color-wa-green-dark)]"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {renderCreateForm()}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h2 className="mb-3 text-xs font-semibold uppercase text-[var(--color-tx-tertiary)]">Mi estado</h2>
          {renderMyStatus()}
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase text-[var(--color-tx-tertiary)]">Recientes</h2>
          {otherUserStatuses.length > 0 ? (
            <div className="space-y-3">
              {otherUserStatuses.map((status) => {
                const sender = status.profiles as Profile;
                const hasViewed = false;

                return (
                  <div key={status.id} className="flex items-center gap-3">
                    <div className="relative">
                      {status.type === "image" && status.file_url ? (
                        <Image
                          src={status.file_url}
                          alt="Estado"
                          width={50}
                          height={50}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-medium text-white"
                          style={{ backgroundColor: status.bg_color || "#075e54" }}
                        >
                          {sender.display_name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {!hasViewed && (
                        <div className="absolute -right-1 -top-1 rounded-full border-2 border-[var(--color-bg-app)] bg-[var(--color-wa-green)] p-0.5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                        {sender.display_name || sender.username}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-[var(--color-tx-tertiary)]">
                        <Clock className="h-3 w-3" />
                        <span>Hace {formatTimeAgo(status.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-8 text-center">
                <Camera className="mx-auto mb-3 h-12 w-12 text-[var(--color-tx-tertiary)]" />
                <p className="text-[var(--color-tx-secondary)]">No hay estados recientes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
