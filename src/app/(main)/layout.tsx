import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessageCircle, Phone, Camera, User, MoreVertical } from "lucide-react";
import Link from "next/link";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-full bg-[var(--color-bg-app)]">
      <aside className="hidden w-16 flex-col items-center justify-between border-r border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] py-4 md:flex">
        <div className="flex flex-col items-center gap-6">
          <div className="rounded-full bg-[var(--color-wa-green)] p-3">
            <MessageCircle className="h-6 w-6 text-white" />
          </div>
          <Link
            href="/chats"
            className="rounded-full p-3 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-tx-primary)]"
          >
            <MessageCircle className="h-6 w-6" />
          </Link>
          <Link
            href="/calls"
            className="rounded-full p-3 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-tx-primary)]"
          >
            <Phone className="h-6 w-6" />
          </Link>
          <Link
            href="/status"
            className="rounded-full p-3 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-tx-primary)]"
          >
            <Camera className="h-6 w-6" />
          </Link>
          <Link
            href="/profile"
            className="rounded-full p-3 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-tx-primary)]"
          >
            <User className="h-6 w-6" />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button className="rounded-full p-3 text-[var(--color-tx-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-tx-primary)]">
            <MoreVertical className="h-6 w-6" />
          </button>
          <div className="h-10 w-10 rounded-full bg-gray-400">
            <img
              src={(await supabase.from("profiles").select("avatar_url").eq("id", user.id).single()).data?.avatar_url || ""}
              alt="Profile"
              className="h-full w-full rounded-full object-cover"
            />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-[var(--color-border-wa)] bg-[var(--color-bg-panel)] py-2 md:hidden">
        <Link
          href="/chats"
          className="flex flex-1 flex-col items-center justify-center text-[var(--color-tx-secondary)]"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="text-xs">Chats</span>
        </Link>
        <Link
          href="/calls"
          className="flex flex-1 flex-col items-center justify-center text-[var(--color-tx-secondary)]"
        >
          <Phone className="h-6 w-6" />
          <span className="text-xs">Llamadas</span>
        </Link>
        <Link
          href="/status"
          className="flex flex-1 flex-col items-center justify-center text-[var(--color-tx-secondary)]"
        >
          <Camera className="h-6 w-6" />
          <span className="text-xs">Estados</span>
        </Link>
        <Link
          href="/profile"
          className="flex flex-1 flex-col items-center justify-center text-[var(--color-tx-secondary)]"
        >
          <User className="h-6 w-6" />
          <span className="text-xs">Perfil</span>
        </Link>
      </nav>
    </div>
  );
}
