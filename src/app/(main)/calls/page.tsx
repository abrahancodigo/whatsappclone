"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Call } from "@/types/database";
import { Phone, Video, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function CallsPage() {
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [callRecipient, setCallRecipient] = useState<Profile | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const queryClient = useQueryClient();

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

  const { data: contacts = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", profile?.id || "")
        .limit(20);
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: !!profile,
  });

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("calls")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50) as any);

      if (error) throw error;
      return data as Call[];
    },
    enabled: !!profile,
  });

  const startCallMutation = useMutation({
    mutationFn: async ({ type, recipient }: { type: "audio" | "video"; recipient: Profile }) => {
      const roomName = `call-${crypto.randomUUID()}`;
      const { data, error } = await (supabase.from("calls") as any)
        .insert({
          room_name: roomName,
          type: type,
          status: "started",
          started_by: profile!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Call;
    },
    onSuccess: (call, variables) => {
      setActiveCallId(call.id);
      setCallType(variables.type);
      setCallRecipient(variables.recipient);
      setIsInCall(true);
    },
  });

  const endCallMutation = useMutation({
    mutationFn: async () => {
      if (!activeCallId) return;
      const { error } = await (supabase.from("calls") as any)
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", activeCallId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      setIsInCall(false);
      setCallType(null);
      setCallRecipient(null);
      setActiveCallId(null);
    },
  });

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  const getCallIcon = (call: Call) => {
    if (call.type === "video") return <Video className="h-4 w-4" />;
    return <Phone className="h-4 w-4" />;
  };

  const getCallStatusIcon = (status: string) => {
    switch (status) {
      case "answered": return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "missed": return <XCircle className="h-4 w-4 text-red-400" />;
      case "declined": return <XCircle className="h-4 w-4 text-red-400" />;
      case "ended": return <Clock className="h-4 w-4 text-[var(--color-tx-tertiary)]" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getCallStatusText = (status: string) => {
    switch (status) {
      case "answered": return "Recibida";
      case "missed": return "Perdida";
      case "declined": return "Rechazada";
      case "ended": return "Finalizada";
      default: return "Iniciada";
    }
  };

  const getCallDuration = (call: Call) => {
    if (!call.ended_at) return null;
    const start = new Date(call.started_at);
    const end = new Date(call.ended_at);
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <div className="flex items-center gap-3">
          {isInCall && (
            <button
              onClick={() => {
                setIsInCall(false);
                setCallType(null);
                setCallRecipient(null);
                setActiveCallId(null);
              }}
              className="text-[var(--color-tx-secondary)] hover:text-[var(--color-tx-primary)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-[var(--color-tx-primary)]">
            {isInCall ? (callType === "video" ? "Video Llamada" : "Llamada") : "Llamadas"}
          </h1>
        </div>
      </div>

      {isInCall && callRecipient && callType ? (
        <div className="flex flex-1 flex-col items-center justify-center bg-[var(--color-bg-app)] p-8">
          <div className="relative mb-8">
            {callRecipient.avatar_url ? (
              <Image
                src={callRecipient.avatar_url}
                alt={callRecipient.display_name}
                width={128}
                height={128}
                className="h-32 w-32 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-32 w-32 items-center justify-center rounded-full text-4xl font-medium text-white"
                style={{ backgroundColor: "#3b82f6" }}
              >
                {callRecipient.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 rounded-full bg-green-500 p-2">
              <Phone className="h-4 w-4 text-white" />
            </div>
          </div>
          <h2 className="mb-2 text-xl font-medium text-[var(--color-tx-primary)]">
            {callRecipient.display_name || callRecipient.username}
          </h2>
          <p className="mb-4 text-sm text-[var(--color-tx-secondary)]">
            {callType === "audio" ? "Llamada de voz" : "Llamada de video"}
          </p>
          <p className="mb-8 text-[var(--color-wa-green)]">
            Conectando...
          </p>
          <div className="flex gap-6">
            <button
              onClick={() => endCallMutation.mutate()}
              className="rounded-full bg-red-500 p-4 text-white hover:bg-red-600 transition-colors"
            >
              <XCircle className="h-8 w-8" />
            </button>
          </div>
          <p className="mt-4 text-xs text-[var(--color-tx-tertiary)]">
            Llamada de demostración — sin conexión real
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 rounded-lg bg-[var(--color-bg-panel)] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--color-tx-tertiary)]">Contactos</h2>
            <div className="space-y-2">
              {contacts.length === 0 ? (
                <p className="text-sm text-[var(--color-tx-tertiary)] text-center py-2">
                  No hay contactos disponibles
                </p>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between rounded-lg p-3 hover:bg-[var(--color-bg-panel-2)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 flex-shrink-0">
                        {contact.avatar_url ? (
                          <Image
                            src={contact.avatar_url}
                            alt={contact.display_name}
                            width={48}
                            height={48}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center rounded-full text-sm font-medium text-white"
                            style={{ backgroundColor: "#3b82f6" }}
                          >
                            {(contact.display_name || contact.username || "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                          {contact.display_name || contact.username}
                        </p>
                        <p className="text-xs text-[var(--color-tx-tertiary)]">@{contact.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startCallMutation.mutate({ type: "audio", recipient: contact })}
                        disabled={startCallMutation.isPending}
                        className="rounded-full p-2 text-[var(--color-wa-green)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <Phone className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => startCallMutation.mutate({ type: "video", recipient: contact })}
                        disabled={startCallMutation.isPending}
                        className="rounded-full p-2 text-[var(--color-wa-green)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <Video className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--color-tx-tertiary)]">Historial de llamadas</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[var(--color-wa-green)]"></div>
            </div>
          ) : calls.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-8 text-center">
              <Phone className="mx-auto mb-3 h-12 w-12 text-[var(--color-tx-tertiary)]" />
              <p className="text-[var(--color-tx-secondary)]">No hay historial de llamadas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {calls.map((call) => {
                const isOutgoing = call.started_by === profile?.id;

                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--color-bg-panel)] p-3 hover:bg-[var(--color-bg-panel-2)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-[var(--color-bg-panel-2)] p-2">
                        {getCallIcon(call)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                          {isOutgoing ? "Tú" : "Contacto"}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-[var(--color-tx-tertiary)]">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(call.started_at)}</span>
                          {getCallDuration(call) && (
                            <>
                              <span>·</span>
                              <span>{getCallDuration(call)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getCallStatusIcon(call.status)}
                      <span className="text-xs text-[var(--color-tx-secondary)]">
                        {getCallStatusText(call.status)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
