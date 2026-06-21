"use client";

import {
  LiveKitRoom,
  VideoConference,
  ControlBar,
  RoomAudioRenderer,
  ConnectionState,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { PhoneOff } from "lucide-react";

interface LiveKitRoomProps {
  token: string;
  wsUrl: string;
  onLeave: () => void;
}

export function LiveKitCall({ token, wsUrl, onLeave }: LiveKitRoomProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a2e]">
      <LiveKitRoom
        token={token}
        serverUrl={wsUrl}
        onDisconnected={onLeave}
        connect={true}
        video={false}
        audio={true}
      >
        <div className="flex flex-1 flex-col items-center justify-center">
          <ConnectionState>
            <VideoConference />
          </ConnectionState>
          <RoomAudioRenderer />
        </div>
        <div className="flex justify-center p-4">
          <button
            onClick={onLeave}
            className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-3 text-white hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="h-5 w-5" />
            <span>Finalizar</span>
          </button>
        </div>
      </LiveKitRoom>
    </div>
  );
}

export function useLiveKitToken() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = async (roomName: string, identity: string, displayName: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, identity, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error obteniendo token");
        return null;
      }
      return data as { token: string; wsUrl: string };
    } catch (err) {
      setError("Error de conexión");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { getToken, loading, error };
}
