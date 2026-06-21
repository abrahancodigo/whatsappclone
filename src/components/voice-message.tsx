"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic, Square, Send } from "lucide-react";

interface VoiceRecorderProps {
  onRecord: (blob: Blob) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecord, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm;codecs=opus" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onRecord(audioBlob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
    }
  };

  const handleDiscard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setIsRecording(false);
    onCancel();
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (audioBlob && audioUrl) {
    return (
      <div className="flex items-center gap-3">
        <button onClick={handleDiscard} className="text-red-400 hover:text-red-300">
          <Square className="h-5 w-5" />
        </button>
        <audio src={audioUrl} controls className="h-8 flex-1" />
        <span className="text-xs text-[var(--color-tx-tertiary)]">{formatDuration(duration)}</span>
        <button onClick={handleSend} className="rounded-full bg-[var(--color-wa-green)] p-2 text-white hover:bg-[var(--color-wa-green-dark)]">
          <Send className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {isRecording && (
        <span className="text-xs text-red-400 animate-pulse">{formatDuration(duration)}</span>
      )}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`rounded-full p-2 transition-colors ${
          isRecording
            ? "bg-red-500 text-white animate-pulse"
            : "text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
        }`}
      >
        {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </button>
    </div>
  );
}

interface AudioPlayerProps {
  src: string;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  return <audio src={src} controls className="h-8 max-w-[240px]" />;
}
