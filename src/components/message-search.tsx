"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { type MessageWithSender } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { formatTime } from "@/lib/utils";

interface MessageSearchProps {
  chatId: string;
  onJumpToMessage: (messageId: string) => void;
  onClose: () => void;
}

export function MessageSearch({ chatId, onJumpToMessage, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const { data: results, isFetching } = useQuery({
    queryKey: ["message-search", chatId, query],
    queryFn: async () => {
      if (!query.trim() || query.length < 2) return [];
      const { data, error } = await (supabase
        .from("messages")
        .select("id, content, created_at, sender:user_id(display_name)")
        .eq("chat_id", chatId)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20) as any);
      if (error) throw error;
      return data as { id: string; content: string; created_at: string; sender: { display_name: string } }[];
    },
    enabled: query.length >= 2,
  });

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
      >
        <Search className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-app)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-3">
        <button onClick={onClose} className="rounded-full p-1 hover:bg-[var(--color-bg-hover)]">
          <ArrowLeft className="h-5 w-5 text-[var(--color-tx-secondary)]" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-tx-tertiary)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar mensajes..."
            className="w-full rounded-lg bg-[var(--color-bg-input)] py-2 pl-9 pr-8 text-sm text-[var(--color-tx-primary)] placeholder-[var(--color-tx-tertiary)] focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-[var(--color-tx-tertiary)]" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isFetching && query.length >= 2 && (
          <div className="flex justify-center p-8">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[var(--color-wa-green)]"></div>
          </div>
        )}

        {results && results.length === 0 && !isFetching && query.length >= 2 && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Search className="mb-3 h-12 w-12 text-[var(--color-tx-tertiary)]" />
            <p className="text-[var(--color-tx-secondary)]">No se encontraron mensajes</p>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="divide-y divide-[var(--color-border-wa)]">
            {results.map((msg) => (
              <button
                key={msg.id}
                onClick={() => {
                  onJumpToMessage(msg.id);
                  onClose();
                }}
                className="flex w-full flex-col gap-1 p-4 text-left hover:bg-[var(--color-bg-hover)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--color-wa-green)]">
                    {msg.sender?.display_name}
                  </span>
                  <span className="text-xs text-[var(--color-tx-tertiary)]">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-[var(--color-tx-primary)]">{msg.content}</p>
              </button>
            ))}
          </div>
        )}

        {query.length < 2 && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Search className="mb-3 h-12 w-12 text-[var(--color-tx-tertiary)]" />
            <p className="text-sm text-[var(--color-tx-secondary)]">Escribe al menos 2 caracteres para buscar</p>
          </div>
        )}
      </div>
    </div>
  );
}
