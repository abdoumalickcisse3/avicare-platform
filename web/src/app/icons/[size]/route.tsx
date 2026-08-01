import { ImageResponse } from "next/og";
import { colors } from "@/theme/tokens";

/**
 * Generated PWA icons. Serves an opaque, on-brand square (deep green field,
 * white "jawdi" wordmark with the orange accent dot) at a requested pixel size
 * — referenced by the web manifest at /icons/192 and /icons/512. Rendered with
 * next/og so no square source asset or image tooling is needed.
 */
export const dynamic = "force-static";

const ALLOWED = new Set([192, 512]);

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

export function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  return ctx.params.then(({ size }) => {
    const n = ALLOWED.has(Number(size)) ? Number(size) : 512;
    const fontSize = Math.round(n * 0.24);
    const dot = Math.round(n * 0.06);
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.primary[800],
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <span
              style={{
                fontSize,
                fontWeight: 800,
                color: colors.neutral[0],
                letterSpacing: -fontSize * 0.03,
              }}
            >
              jawdi
            </span>
            <span
              style={{
                width: dot,
                height: dot,
                borderRadius: dot,
                background: colors.accent[400],
                marginLeft: dot * 0.4,
                marginTop: dot * 0.4,
              }}
            />
          </div>
        </div>
      ),
      { width: n, height: n },
    );
  });
}
