import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

export async function POST(req: NextRequest) {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: "LiveKit no está configurado. Agrega LIVEKIT_API_KEY y LIVEKIT_API_SECRET en .env.local" },
      { status: 503 }
    );
  }

  try {
    const { roomName, identity, displayName } = await req.json();

    if (!roomName || !identity) {
      return NextResponse.json({ error: "roomName and identity required" }, { status: 400 });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: displayName || identity,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = at.toJwt();

    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || "wss://livekit.example.com";

    return NextResponse.json({ token, wsUrl });
  } catch (error) {
    console.error("LiveKit token error:", error);
    return NextResponse.json({ error: "Error generating token" }, { status: 500 });
  }
}
