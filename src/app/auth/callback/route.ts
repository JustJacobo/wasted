import { NextResponse, type NextRequest } from "next/server";
import { getRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Destino del login con Google y de los enlaces mágicos por correo.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (!(await getRole(supabase, data.user?.email))) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=no_autorizado`);
      }
      return NextResponse.redirect(origin);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=login`);
}
