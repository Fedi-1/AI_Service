import React from "react";
import { SlideData } from "../types";
import {
  CinematicStage,
  extractKeywords,
  GlassPanel,
  phraseLabel,
  repairText,
  splitIntoPoints,
} from "./CinematicElements";

interface Slide1Props {
  slide: SlideData;
  currentTimeSeconds: number;
  language: string;
}

const Slide1WhyItMatters: React.FC<Slide1Props> = ({ slide, currentTimeSeconds }) => {
  const points = splitIntoPoints(slide.script, 3).filter((point) => repairText(point).trim());
  const lessonLabels = points.map((point, index) =>
    phraseLabel(point, ["Key idea", "Context", "Application"][index])
  );
  const keywords = extractKeywords(slide.script, 9);
  const displayedKeywords = keywords.length > 0 ? keywords : lessonLabels;

  return (
    <CinematicStage
      slide={slide}
      currentTimeSeconds={currentTimeSeconds}
      sceneLabel="Lesson analysis"
    >
      <GlassPanel x={100} y={154} width={270} height={394} delay={8} accentColor={slide.accentColor}>
        <div style={{ padding: 22 }}>
          <div style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 800 }}>KEY TERMS</div>
          <div
            style={{
              marginTop: 20,
              minHeight: 246,
              borderRadius: 8,
              backgroundColor: "rgba(248,250,252,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: 16,
              display: "flex",
              flexWrap: "wrap",
              alignContent: "flex-start",
              gap: 10,
            }}
          >
            {displayedKeywords.map((keyword, index) => (
              <div
                key={`${keyword}-${index}`}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${index < 3 ? slide.accentColor : "rgba(255,255,255,0.14)"}`,
                  backgroundColor: index < 3 ? `${slide.accentColor}1c` : "rgba(255,255,255,0.06)",
                  color: index < 3 ? "#f8fafc" : "#cbd5e1",
                  padding: "8px 10px",
                  fontSize: 13,
                  lineHeight: 1.1,
                  fontWeight: 800,
                }}
              >
                {keyword}
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 18,
              color: "#94a3b8",
              fontSize: 13,
              lineHeight: 1.35,
              fontWeight: 700,
            }}
          >
            {points.length} connected ideas detected from this lesson.
          </div>
        </div>
      </GlassPanel>

      <GlassPanel x={400} y={104} width={780} height={500} delay={18} accentColor={slide.accentColor}>
        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#f8fafc", fontSize: 24, fontWeight: 850 }}>Lesson map</div>
              <div style={{ marginTop: 6, color: "#94a3b8", fontSize: 14 }}>
                {repairText(slide.title)}
              </div>
            </div>
            <div
              style={{
                color: "#08111f",
                backgroundColor: slide.accentColor,
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                fontWeight: 850,
              }}
            >
              ANALYZING
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 13, marginTop: 24 }}>
            {lessonLabels.map((label, index) => {
              const paragraph = repairText(points[index] || "");
              const paragraphSize = paragraph.length > 230 ? 13.5 : paragraph.length > 160 ? 14.5 : 15.5;
              return (
                <div
                  key={`${label}-${index}`}
                  style={{
                    minHeight: 112,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(255,255,255,0.052)",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11, color: "#cbd5e1" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: slide.accentColor,
                        color: "#08111f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 900,
                      }}
                    >
                      {index + 1}
                    </div>
                    <span style={{ fontSize: 14, color: slide.accentColor, fontWeight: 900 }}>{label}</span>
                  </div>
                  <div
                    style={{
                      marginTop: 9,
                      color: "#f8fafc",
                      fontSize: paragraphSize,
                      lineHeight: 1.28,
                      fontWeight: 680,
                    }}
                  >
                    {paragraph}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GlassPanel>
    </CinematicStage>
  );
};

export default Slide1WhyItMatters;
