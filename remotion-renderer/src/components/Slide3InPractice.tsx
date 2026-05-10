import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideData } from "../types";
import {
  CinematicStage,
  GlassPanel,
  normalizeVideoLanguage,
  repairText,
  splitIntoPoints,
} from "./CinematicElements";

interface Slide3Props {
  slide: SlideData;
  currentTimeSeconds: number;
  language: string;
}

const Slide3InPractice: React.FC<Slide3Props> = ({ slide, currentTimeSeconds, language }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const videoLanguage = normalizeVideoLanguage(language);
  const steps = splitIntoPoints(slide.script, 3).filter((step) => repairText(step).trim());
  const activeStep = Math.min(
    Math.max(0, steps.length - 1),
    Math.floor(currentTimeSeconds / Math.max(1, slide.audioDurationSeconds / Math.max(1, steps.length)))
  );

  return (
    <CinematicStage
      slide={slide}
      currentTimeSeconds={currentTimeSeconds}
      sceneLabel={
        videoLanguage === "fr" ? "Application" : videoLanguage === "ar" ? "التطبيق" : "Application"
      }
      language={videoLanguage}
    >
      <GlassPanel x={88} y={102} width={1010} height={500} delay={12} accentColor={slide.accentColor}>
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#f8fafc", fontSize: 25, fontWeight: 900 }}>
                {repairText(slide.title)}
              </div>
              <div style={{ color: "#94a3b8", marginTop: 6, fontSize: 14 }}>
                {videoLanguage === "fr"
                  ? "Actions de la lecon"
                  : videoLanguage === "ar"
                    ? "خطوات تطبيقية"
                    : "Practical steps"}
              </div>
            </div>
            <div
              style={{
                width: 110,
                height: 32,
                borderRadius: 8,
                border: `1px solid ${slide.accentColor}`,
                color: slide.accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {videoLanguage === "fr" ? "PRATIQUE" : videoLanguage === "ar" ? "تطبيق" : "PRACTICE"}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
            {steps.map((step, index) => {
              const delay = 34 + index * 18;
              const fullStep = repairText(step);
              const bodySize = fullStep.length > 260 ? 13.5 : fullStep.length > 190 ? 14.5 : 16;
              const enter = spring({
                frame: Math.max(0, frame - delay),
                fps,
                config: { damping: 16, stiffness: 160 },
              });
              const x = interpolate(enter, [0, 1], [-26, 0]);
              const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const active = activeStep >= index;
              return (
                <div
                  key={index}
                  style={{
                    height: 118,
                    borderRadius: 8,
                    backgroundColor: active ? `${slide.accentColor}18` : "rgba(255,255,255,0.055)",
                    border: `1px solid ${active ? slide.accentColor : "rgba(255,255,255,0.1)"}`,
                    padding: "14px 18px",
                    transform: `translateX(${x}px)`,
                    opacity,
                    boxShadow: active ? `0 0 32px ${slide.accentColor}22` : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: active ? slide.accentColor : "rgba(255,255,255,0.1)",
                        color: active ? "#08111f" : "#cbd5e1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ color: slide.accentColor, fontSize: 12, fontWeight: 900 }}>
                      ACTION SECTION
                    </div>
                  </div>
                  <div style={{ color: "#f8fafc", marginTop: 8, fontSize: bodySize, lineHeight: 1.22, fontWeight: 760 }}>
                    {fullStep}
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

export default Slide3InPractice;
