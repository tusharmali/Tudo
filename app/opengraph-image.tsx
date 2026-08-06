import { ImageResponse } from "next/og";

export const alt = "Tudo — Everything your team does, in one place";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7178dd 0%, #9b7ad6 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 28,
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              fontWeight: 800,
            }}
          >
            T
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, letterSpacing: -3 }}>Tudo</div>
        </div>
        <div style={{ display: "flex", fontSize: 38, marginTop: 30, opacity: 0.92 }}>
          Everything your team does, in one place.
        </div>
      </div>
    ),
    { ...size },
  );
}
