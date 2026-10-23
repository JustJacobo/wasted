import { ImageResponse } from "next/og";

// Íconos PNG de la PWA generados al vuelo: /icons/192, /icons/512, /icons/180.
const SIZES = new Set([180, 192, 512]);

export async function GET(_request: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#16a34a",
          color: "#ffffff",
          fontSize: size * 0.5,
          fontWeight: 800,
          letterSpacing: -size * 0.02,
        }}
      >
        W
      </div>
    ),
    { width: size, height: size },
  );
}
