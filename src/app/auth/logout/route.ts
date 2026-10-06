import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  // This device only (CEO2-C). The default "global" scope also ended the member's other
  // phones and the saved E2E login.
  await supabase.auth.signOut({ scope: "local" });
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
