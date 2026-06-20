"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Call } from "@/types/database";
import { Phone, Video, Clock, CheckCircle, XCircle, AlertCircle, MoreVertical } from "lucide-react";
import { useEffect, useState } from "react";

export default function CallsPage() {
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [callRecipient, setCallRecipient] = useState<Profile | null>(null);
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

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("calls")
        .select(
          `*,\n         profiles!started_by(*)`,
          { head: false }
        )
        .order("started_at", { ascending: false })
        .limit(50) as any);

      if (error) throw error;
      return data as (Call & { profiles: Profile })[];
    },
    enabled: !!profile,
  });

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

  const getCallIcon = (call: Call) => {
    if (call.type === "video") {
      return <Video className="h-4 w-4" />;
    }
    return <Phone className="h-4 w-4" />;
  };

  const getCallStatusIcon = (status: string) => {
    switch (status) {
      case "answered":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "missed":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "ended":
        return <Clock className="h-4 w-4 text-[var(--color-tx-tertiary)]" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getCallStatusText = (status: string) => {
    switch (status) {
      case "answered":
        return "Recibida";
      case "missed":
        return "Perdida";
      case "declined":
        return "Rechazada";
      case "ended":
        return "Finalizada";
      default:
        return "Iniciada";
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

  const startCall = (type: "audio" | "video", recipient: Profile) => {
    setCallType(type);
    setCallRecipient(recipient);
    setIsInCall(true);

    if (!profile) return;
    const roomName = `call-${crypto.randomUUID()}`;

    (supabase.from("calls") as any).insert({
      room_name: roomName,
      type: type,
      status: "started",
      started_by: profile.id,
    }).then(({ error }: { error: any }) => {
      if (error) {
        console.error("Error starting call:", error);
        setIsInCall(false);
        setCallType(null);
        setCallRecipient(null);
      }
    });
  };

  const endCall = () => {
    if (callType && profile?.id) {
      (supabase.from("calls") as any)
        .update({
          status: isInCall ? "ended" : (callRecipient ? "answered" : "missed"),
          ended_at: new Date().toISOString(),
        })
        .eq("room_name", `call-${crypto.randomUUID()}`)
        .eq("started_by", profile.id)
        .then(({ error }: { error: any }) => {
          if (error) {
            console.error("Error ending call:", error);
          }
        });
    }

    setIsInCall(false);
    setCallType(null);
    setCallRecipient(null);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-4">
        <h1 className="text-xl font-semibold text-[var(--color-tx-primary)]">Llamadas</h1>
        <div className="flex gap-2">
          <button className="rounded-full bg-[var(--color-wa-green)] p-2 text-white hover:bg-[var(--color-wa-green-dark)]">
            <Phone className="h-5 w-5" />
          </button>
          <button className="rounded-full bg-[var(--color-wa-green)] p-2 text-white hover:bg-[var(--color-wa-green-dark)]">
            <Video className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isInCall && callRecipient && callType ? (
        <div className="flex flex-1 flex-col items-center justify-center bg-[var(--color-bg-app)] p-8">
          <div className="relative mb-8">
            {callRecipient.avatar_url ? (
              <img
                src={callRecipient.avatar_url}
                alt={callRecipient.display_name}
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
          </div>
          <h2 className="mb-2 text-xl font-medium text-[var(--color-tx-primary)]">
            {callRecipient.display_name || callRecipient.username}
          </h2>
          <p className="mb-8 text-[var(--color-tx-secondary)]">
            {callType === "audio" ? "Llamada de voz" : "Llamada de video"}
          </p>
          <div className="flex gap-6">
            <button
              onClick={endCall}
              className="rounded-full bg-red-500 p-4 text-white hover:bg-red-600"
            >
              <XCircle className="h-8 w-8" />
            </button>
            {callType === "video" && (
              <button className="rounded-full bg-[var(--color-bg-panel)] p-4 text-[var(--color-tx-primary)] hover:bg-[var(--color-bg-hover)]">
                <Video className="h-8 w-8" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 rounded-lg bg-[var(--color-bg-panel)] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase text-[var(--color-tx-tertiary)]">Contactos recientes</h2>
            <div className="space-y-2">
              {profile && (
                <div className="flex items-center justify-between rounded-lg p-3 hover:bg-[var(--color-bg-panel-2)]">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={profile.display_name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full w-full items-center justify-center rounded-full text-sm font-medium text-white"
                          style={{ backgroundColor: "#3b82f6" }}
                        >
                          {profile.display_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                        {profile.display_name || profile.username}
                      </p>
                      <p className="text-xs text-[var(--color-tx-tertiary)]">Tú</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startCall("audio", profile)}
                      className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => startCall("video", profile)}
                      className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
                    >
                      <Video className="h-5 w-5" />
                    </button>
                  </div>
                </div>
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
                const otherParty = isOutgoing
                  ? call.chat_id
                    ? null
                    : null
                  : call.started_by === profile?.id
                    ? null
                    : call.started_by;

                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--color-bg-panel)] p-3 hover:bg-[var(--color-bg-panel-2)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-[var(--color-bg-panel-2)] p-2">
                        {getCallIcon(call)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-tx-primary)]">
                          {isOutgoing ? "Tú" : otherParty ? "Usuario" : "Desconocido"}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-[var(--color-tx-tertiary)]">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimeAgo(call.started_at)}</span>
                          {getCallDuration(call) && (
                            <>
                              <span>•</span>
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
                      <button className="text-[var(--color-tx-tertiary)] hover:text-[var(--color-tx-primary)]">
                        <MoreVertical className="h-4 w-4" />
                      </button>
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
