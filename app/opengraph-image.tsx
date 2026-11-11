import { ImageResponse } from "next/og";

export const alt = "AI DAILY INTEL — daily AI news, Chinese summaries, digest and forecasts";
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
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#0a0d12",
          color: "#e9eef6",
          fontFamily: "sans-serif",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(147,161,181,0.14) 1px, transparent 1.4px)",
          backgroundSize: "28px 28px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "22px", letterSpacing: "5px", color: "#2fe89a" }}>
          <div style={{ display: "flex", width: "12px", height: "12px", borderRadius: "999px", backgroundColor: "#2fe89a" }} />
          SIGNAL RADAR · AI DAILY INTEL
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", fontSize: "92px", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.05 }}>
            AI DAILY INTEL
          </div>
          <div style={{ display: "flex", fontSize: "32px", color: "#93a1b5", lineHeight: 1.35 }}>
            34 sources · Chinese summaries · daily digest, forecasts & impact
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", color: "#5c6a7e" }}>
          <span>ai-news · local intelligence console</span>
          <span>github.com/lhdbot/ai-news</span>
        </div>
      </div>
    ),
    size,
  );
}
