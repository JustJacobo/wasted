import { ImageResponse } from "next/og";
import { DOT, LOGO_VIEWBOX, W_PATH } from "@/components/logo";

// Íconos PNG de la PWA generados al vuelo: /icons/192, /icons/512, /icons/180.
// Siempre neutros (no siguen el tema): w en papel sobre tinta, punto gris.
const SIZES = new Set([180, 192, 512]);

export async function GET(_request: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  // ~56% del ancho: cabe en la zona segura del ícono maskable (círculo del 80%).
  const width = size * 0.56;
  const height = (width * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#161513",
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
          style={{ marginTop: size * 0.03 }}
        >
          <path d={W_PATH} fill="#f6f5f1" />
          <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="#8a867d" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
