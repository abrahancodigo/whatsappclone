"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Status } from "@/types/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Plus, X, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

export default function StatusPage() {
  const [isCreatingStatus, setIsCreatingStatus] = useState(false);
  const [statusContent, setStatusContent] = useState("");
  const [statusType, setStatusType] = useState<"text" | "image">("text");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewerStatuses, setViewerStatuses] = useState<(Status & { profiles: Profile })[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
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

    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const openViewer = (statuses: (Status & { profiles: Profile })[], index: number) => {
    setViewerStatuses(statuses);
    setViewerIndex(index);
    setViewedIds((prev) => new Set(prev).add(statuses[index].id));
  };

  const closeViewer = useCallback(() => {
    setViewerStatuses([]);
    setViewerIndex(0);
  }, []);

  const nextStatus = useCallback(() => {
    if (viewerIndex < viewerStatuses.length - 1) {
      setViewerIndex((prev) => prev + 1);
      setViewedIds((prev) => new Set(prev).add(viewerStatuses[viewerIndex + 1].id));
    } else {
      closeViewer();
    }
  }, [viewerIndex, viewerStatuses, closeViewer]);

  const prevStatus = useCallback(() => {
    if (viewerIndex > 0) {
      setViewerIndex((prev) => prev - 1);
    }
  }, [viewerIndex]);

  useEffect(() => {
    if (viewerStatuses.length === 0) return;
    const timer = setInterval(nextStatus, 5000);
    return () => clearInterval(timer);
  }, [viewerStatuses.length, nextStatus]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (viewerStatuses.length === 0) return;
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowRight") nextStatus();
      if (e.key === "ArrowLeft") prevStatus();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewerStatuses.length, closeViewer, nextStatus, prevStatus]);

  const userStatuses = statuses.filter((s) => s.user_id === profile?.id);
  const otherUserStatuses = statuses.filter((s) => s.user_id !== profile?.id);

  const groupByUser = (list: (Status & { profiles: Profile })[]) => {
    const groups: Record<string, { profile: Profile; statuses: (Status & { profiles: Profile })[] }> = {};
    list.forEach((s) => {
      const uid = s.user_id;
      if (!groups[uid]) {
        groups[uid] = { profile: s.profiles as Profile, statuses: [] };
      }
      groups[uid].statuses.push(s);
    });
    return Object.values(groups);
  };

  const otherGroups = groupByUser(otherUserStatuses);

  if (viewerStatuses.length > 0) {
    const current = viewerStatuses[viewerIndex];
    const sender = current.profiles as Profile;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <button
          onClick={closeViewer}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
        >
          <X className="h-5 w-5" />
        </button>

        {viewerIndex > 0 && (
          <button
            onClick={prevStatus}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {viewerIndex < viewerStatuses.length - 1 && (
          <button
            onClick={nextStatus}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white/20 p-2 text-white hover:bg-white/30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
          {viewerStatuses.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
              <div
                className={cn(
                  "h-full bg-white",
                  i < viewerIndex ? "w-full" : i === viewerIndex ? "animate-progress" : "w-0"
                )}
                style={i === viewerIndex ? { animation: "progress 5s linear" } : undefined}
              />
            </div>
          ))}
        </div>

        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-3 pt-4">
          {sender.avatar_url ? (
            <Image
              src={sender.avatar_url}
              alt={sender.display_name}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-xs font-medium text-white">
              {(sender.display_name || sender.username || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-white">{sender.display_name || sender.username}</p>
            <p className="text-xs text-white/70">Hace {formatTimeAgo(current.created_at)}</p>
          </div>
        </div>

        <div className="flex h-full w-full items-center justify-center p-8">
          {current.type === "image" && current.file_url ? (
            <Image
              src={current.file_url}
              alt="Estado"
              width={600}
              height={800}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-lg p-8 text-center"
              style={{ backgroundColor: current.bg_color || "#075e54" }}
            >
              <p className="max-w-md text-lg font-medium text-white leading-relaxed">
                {current.content}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

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

      {isCreatingStatus && (
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
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h2 className="mb-3 text-xs font-semibold uppercase text-[var(--color-tx-tertiary)]">Mi estado</h2>
          {userStatuses.length > 0 ? (
            <button
              onClick={() => openViewer(userStatuses, 0)}
              className="flex items-center gap-3 rounded-lg p-3 hover:bg-[var(--color-bg-panel)] transition-colors w-full"
            >
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-[var(--color-wa-green)] flex items-center justify-center text-lg font-medium text-white">
                  {profile?.display_name?.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 rounded-full bg-[var(--color-bg-app)] p-0.5">
                  <div className="rounded-full bg-[var(--color-wa-green)] p-0.5">
                    <Plus className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                  Mi estado ({userStatuses.length})
                </p>
                <p className="text-xs text-[var(--color-tx-tertiary)]">
                  Toca para ver
                </p>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setIsCreatingStatus(true)}
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--color-border-wa)] p-6 text-center w-full hover:border-[var(--color-wa-green)] transition-colors"
            >
              <div className="rounded-full bg-[var(--color-bg-panel-2)] p-3">
                <Camera className="h-6 w-6 text-[var(--color-tx-tertiary)]" />
              </div>
              <p className="text-sm text-[var(--color-tx-secondary)]">Agrega un estado</p>
            </button>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase text-[var(--color-tx-tertiary)]">Recientes</h2>
          {otherGroups.length > 0 ? (
            <div className="space-y-3">
              {otherGroups.map((group) => (
                <button
                  key={group.profile.id}
                  onClick={() => openViewer(group.statuses, 0)}
                  className="flex items-center gap-3 rounded-lg p-3 hover:bg-[var(--color-bg-panel)] transition-colors w-full"
                >
                  <div className="relative">
                    {group.profile.avatar_url ? (
                      <Image
                        src={group.profile.avatar_url}
                        alt={group.profile.display_name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-medium text-white"
                        style={{ backgroundColor: "#3b82f6" }}
                      >
                        {(group.profile.display_name || group.profile.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -right-1 -top-1 rounded-full border-2 border-[var(--color-bg-app)] bg-[var(--color-wa-green)] p-0.5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                      {group.profile.display_name || group.profile.username}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-[var(--color-tx-tertiary)]">
                      <Clock className="h-3 w-3" />
                      <span>Hace {formatTimeAgo(group.statuses[0].created_at)}</span>
                      <span>· {group.statuses.length} {group.statuses.length === 1 ? "estado" : "estados"}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-8 text-center">
              <Camera className="mx-auto mb-3 h-12 w-12 text-[var(--color-tx-tertiary)]" />
              <p className="text-[var(--color-tx-secondary)]">No hay estados recientes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
