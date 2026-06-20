import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chats");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg-app)] p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
