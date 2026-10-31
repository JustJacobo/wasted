import type { NextRequest } from "next/server";
import { userFromRequest } from "@/lib/api-auth";
import { todayIn } from "@/lib/dates";
import { fetchSummary, fetchUpcoming, weekBudget } from "@/lib/report-data";
import { balanceSnapshot } from "@/lib/shortcut-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { weekPlan } from "@/lib/week-plan";
import { respond, UNAUTHORIZED } from "../respond";

/** Saldo y semana en curso para widgets. `Authorization: Bearer <clave>`. */
export async function GET(request: NextRequest) {
  const admin = createAdminClient();
  const user = await userFromRequest(admin, request);
  if (!user) return respond(request, UNAUTHORIZED, 401);

  const today = todayIn();
  const [summary, upcoming] = await Promise.all([
    fetchSummary(admin, today, user.userId),
    fetchUpcoming(admin, today, user.userId),
  ]);
  const week = weekBudget(summary);
  // `cuenta`: el widget de Android la muestra antes de conectar una clave.
  return respond(request, {
    ok: true,
    cuenta: user.email,
    ...balanceSnapshot(week, { plan: weekPlan(week, today, upcoming), today }),
  });
}
