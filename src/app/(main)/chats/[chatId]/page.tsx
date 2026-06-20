"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Profile, type Message, type Chat, type ChatMember } from "@/types/database";
import { formatTime, cn } from "@/lib/utils";
import { Send, Paperclip, Smile, Phone, Video, MoreVertical, ArrowLeft, Image as ImageIcon, X, CheckCheck, Check, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient, useSubscription } from "@tanstack/react-query";
import Image from "next/image";

interface ChatPageProps {
  params: { chatId: string };
}

export default function ChatPage({ params }: ChatPageProps) {
  const { chatId } = params;
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const { data: chat, isLoading } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select(
          `*,\n         chat_members!inner(*),\n         profiles!chat_members.user_id(*)`
        )
        .eq("id", chatId)
        .single();

      if (error) throw error;
      return data as Chat & { profiles: Profile[] };
    },
    enabled: !!chatId,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `*,\n         profiles!sender_id(*)`,
          { head: false }
        )
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      return data as (Message & { profiles: Profile })[];
    },
    enabled: !!chatId,
  });

  const { data: chatMembers = [] } = useQuery({
    queryKey: ["chatMembers", chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_members")
        .select(
          `*,\n         profiles!user_id(*)`
        )
        .eq("chat_id", chatId);

      if (error) throw error;
      return data as (ChatMember & { profiles: Profile })[];
    },
    enabled: !!chatId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, type, file, replyTo }: {
      content?: string;
      type?: "text" | "image" | "file" | "audio" | "system";
      file?: File;
      replyTo?: string;
    }) => {
      let fileUrl = null;
      let fileName = null;
      let fileSize = null;

      if (file) {
        setIsUploading(true);
        const fileExt = file.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("chat-files")
          .getPublicUrl(filePath);

        fileUrl = publicUrl;
        fileName = file.name;
        fileSize = file.size;
      }

      const messageData: any = {
        chat_id: chatId,
        sender_id: profile?.id,
        content: content || null,
        type: type || (file ? "image" : "text"),
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        reply_to_id: replyTo || null,
      };

      const { error } = await supabase.from("messages").insert(messageData);

      if (error) throw error;

      await supabase
        .from("chat_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .eq("user_id", profile?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      setMessage("");
      setReplyingTo(null);
      setIsTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() && !fileInputRef.current?.files?.length) return;

    const file = fileInputRef.current?.files?.[0];
    if (file) {
      sendMessageMutation.mutate({
        content: null,
        type: file.type.startsWith("image/") ? "image" : "file",
        file,
        replyTo: replyingTo?.id,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      sendMessageMutation.mutate({
        content: message.trim(),
        type: "text",
        replyTo: replyingTo?.id,
      });
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: profile?.id,
          type: "system",
          content: `${profile?.display_name || profile?.username} está escribiendo...`,
        })
        .catch(() => {});
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleSendMessage();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--color-bg-app)]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--color-wa-green)]"></div>
      </div>
    );
  }

  const otherMembers = chatMembers.filter((m) => m.user_id !== profile?.id);
  const displayName = chat?.type === "direct" 
    ? otherMembers[0]?.profiles?.display_name || otherMembers[0]?.profiles?.username || "Unknown"
    : chat?.name || "Grupo sin nombre";
  const avatarUrl = chat?.type === "direct" 
    ? otherMembers[0]?.profiles?.avatar_url || null
    : chat?.avatar_url || null;

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg-app)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-3">
        <div className="flex items-center gap-3">
          <button className="text-[var(--color-tx-secondary)] hover:text-[var(--color-tx-primary)]">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative h-10 w-10">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName}
                width={40}
                height={40}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: "#3b82f6" }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-sm font-medium text-[var(--color-tx-primary)]">
              {displayName}
            </h2>
            <p className="text-xs text-[var(--color-tx-tertiary)]">
              {chat?.type === "direct" ? "Directo" : "Grupo"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]">
            <Phone className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]">
            <Video className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[var(--color-bg-app)] p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <MessageCircle className="mx-auto mb-3 h-12 w-12 text-[var(--color-tx-tertiary)]" />
              <p className="text-[var(--color-tx-secondary)]">No hay mensajes aún</p>
              <p className="text-sm text-[var(--color-tx-tertiary)]">¡Envía el primer mensaje!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isOwn = msg.sender_id === profile?.id;
              const sender = msg.profiles as Profile;
              const isSystem = msg.type === "system";

              return (
                <div key={msg.id} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                  {!isOwn && isSystem ? (
                    <div className="mx-auto rounded-full bg-[var(--color-bg-panel-2)] px-3 py-1 text-xs text-[var(--color-tx-tertiary)]">
                      {msg.content}
                    </div>
                  ) : (
                    <div className={cn("max-w-xs md:max-w-md lg:max-w-lg", isOwn ? "text-right" : "text-left")}>
                      {!isOwn && !isSystem && (
                        <p className="mb-1 text-xs font-medium text-[var(--color-tx-secondary)]">
                          {sender.display_name || sender.username}
                        </p>
                      )}

                      <div
                        className={cn(
                          "relative inline-block rounded-lg px-3 py-2",
                          isSystem
                            ? "bg-transparent text-[var(--color-tx-tertiary)]"
                            : isOwn
                              ? "bubble-tail-out bg-[var(--color-bubble-out)] text-white"
                              : "bubble-tail-in bg-[var(--color-bubble-in)] text-[var(--color-tx-primary)]"
                        )}
                      >
                        {msg.type === "image" && msg.file_url && (
                          <div className="mb-2">
                            <Image
                              src={msg.file_url}
                              alt={msg.file_name || "Imagen"}
                              width={300}
                              height={300}
                              className="max-h-64 rounded-lg object-cover"
                            />
                          </div>
                        )}

                        {msg.type === "file" && msg.file_name && (
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            <a
                              href={msg.file_url || "#"}
                              download={msg.file_name}
                              className="text-sm font-medium underline hover:no-underline"
                            >
                              {msg.file_name}
                            </a>
                          </div>
                        )}

                        {msg.content && (
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {msg.content}
                          </p>
                        )}

                        <div className="mt-1 flex items-center justify-between gap-1 text-xs opacity-70">
                          <span>{formatTime(msg.created_at)}</span>
                          {isOwn && msg.type === "text" && (
                            <span className="flex items-center gap-0.5">
                              {msg.deleted_at ? (
                                <X className="h-3 w-3" />
                              ) : msg.content ? (
                                msg.created_at === msg.updated_at ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      {replyingTo?.id === msg.id && (
                        <div className="mt-1 rounded border-l-2 border-[var(--color-wa-green)] bg-[var(--color-bg-panel-2)] pl-2 text-xs text-[var(--color-tx-secondary)]">
                          <p className="font-medium">Respuesta a {sender.display_name || sender.username}:</p>
                          <p className="truncate">{msg.content || "[Archivo]"}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {replyingTo && (
        <div className="border-t border-[var(--color-border-wa)] bg-[var(--color-bg-panel-2)] p-2">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs text-[var(--color-tx-tertiary)]">Respondiendo a {replyingTo.profiles?.display_name || replyingTo.profiles?.username}</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-[var(--color-tx-secondary)] hover:text-[var(--color-tx-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-3 py-1 text-sm text-[var(--color-tx-primary)] truncate">
            {replyingTo.content || replyingTo.file_name || "[Archivo]"}
          </div>
        </div>
      )}

      <div className="border-t border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] p-3">
        <div className="flex items-end gap-2">
          <button
            onClick={() => setReplyingTo(null)}
            className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <button
            onClick={() => setReplyingTo(null)}
            className="rounded-full p-2 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            <Smile className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Escribe un mensaje..."
              className="w-full rounded-full border border-[var(--color-border-wa)] bg-[var(--color-bg-input)] px-4 py-2 text-sm text-[var(--color-tx-primary)] placeholder:text-[var(--color-tx-tertiary)] focus:border-[var(--color-wa-green)] focus:outline-none"
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() && !fileInputRef.current?.files?.length}
            className="rounded-full bg-[var(--color-wa-green)] p-2 text-white hover:bg-[var(--color-wa-green-dark)] disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
