// C:\Users\firas\Desktop\PFE Project\learnai-ai-service\remotion-renderer\src\components\Slide3InPractice.tsx
import React from "react";
import {
  Audio,
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SlideData } from "../types";

interface Slide3Props {
  slide: SlideData;
  currentTimeSeconds: number;
}

function parseSteps(script: string): string[] {
  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const numbered = lines
    .filter((l) => /^\d+[.)]\s+/.test(l))
    .map((l) => l.replace(/^\d+[.)]\s+/, "").trim());
  if (numbered.length >= 3) return numbered.slice(0, 3);

  if (lines.length >= 3) return lines.slice(0, 3);

  const sentences = script
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= 3) {
    const chunk = Math.ceil(sentences.length / 3);
    return [
      `${sentences.slice(0, chunk).join(". ")}.`,
      `${sentences.slice(chunk, chunk * 2).join(". ")}.`,
      `${sentences.slice(chunk * 2).join(". ")}.`,
    ];
  }

  const result = numbered.length > 0 ? [...numbered] : [script.trim()];
  while (result.length < 3) result.push("");
  return result.slice(0, 3);
}

const Slide3InPractice: React.FC<Slide3Props> = ({ slide }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideDurationInFrames = Math.max(1, Math.ceil(slide.audioDurationSeconds * 30) + 20);

  const bgGradient = interpolateColors(
    frame,
    [0, Math.floor(slideDurationInFrames / 2), slideDurationInFrames],
    ["#0A0C16", "#111827", "#0b1020"]
  );

  const particle1X = interpolate(frame, [0, slideDurationInFrames], [-50, 70], {
    extrapolateRight: "clamp",
  });
  const particle1Y = interpolate(frame, [0, slideDurationInFrames], [110, -50], {
    extrapolateRight: "clamp",
  });
  const particle2X = interpolate(frame, [0, slideDurationInFrames], [930, 790], {
    extrapolateRight: "clamp",
  });
  const particle2Y = interpolate(frame, [0, slideDurationInFrames], [-80, 70], {
    extrapolateRight: "clamp",
  });
  const particle3X = interpolate(frame, [0, slideDurationInFrames], [210, 350], {
    extrapolateRight: "clamp",
  });
  const particle3Y = interpolate(frame, [0, slideDurationInFrames], [620, 490], {
    extrapolateRight: "clamp",
  });
  const particle4X = interpolate(frame, [0, slideDurationInFrames], [1030, 900], {
    extrapolateRight: "clamp",
  });
  const particle4Y = interpolate(frame, [0, slideDurationInFrames], [550, 420], {
    extrapolateRight: "clamp",
  });

  const slideEnterSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80 },
  });
  const slideTranslateY = interpolate(slideEnterSpring, [0, 1], [60, 0]);
  const slideOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleWords = slide.title.trim().split(/\s+/);
  const lineWidth = interpolate(frame, [8, 20], [0, 300], {
    extrapolateRight: "clamp",
  });

  const steps = parseSteps(slide.script);

  return (
    <div
      style={{
        width: 1280,
        height: 720,
        overflow: "hidden",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 18% 20%, rgba(255,255,255,0.04), transparent 45%), ${bgGradient}`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: particle1X,
          top: particle1Y,
          width: 200,
          height: 200,
          borderRadius: "50%",
          backgroundColor: slide.accentColor,
          opacity: 0.12,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: particle2X,
          top: particle2Y,
          width: 300,
          height: 300,
          borderRadius: "50%",
          backgroundColor: "#7dd3fc",
          opacity: 0.09,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: particle3X,
          top: particle3Y,
          width: 150,
          height: 150,
          borderRadius: "50%",
          backgroundColor: "#f8fafc",
          opacity: 0.08,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: particle4X,
          top: particle4Y,
          width: 250,
          height: 250,
          borderRadius: "50%",
          backgroundColor: slide.accentColor,
          opacity: 0.1,
        }}
      />

      <div
        style={{
          padding: "60px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          transform: `translateY(${slideTranslateY}px)`,
          opacity: slideOpacity,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: -1,
              color: "#ffffff",
              textShadow: `0 0 26px ${slide.accentColor}`,
            }}
          >
            {titleWords.map((word, idx) => {
              const wordFrame = Math.max(0, frame - idx * 4);
              const wordSpring = spring({
                frame: wordFrame,
                fps,
                config: { damping: 14, stiffness: 180 },
              });
              const wordScale = interpolate(wordSpring, [0, 1], [0.7, 1]);
              const wordOpacity = interpolate(wordFrame, [0, 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <span
                  key={`${word}-${idx}`}
                  style={{
                    display: "inline-block",
                    marginRight: 14,
                    transform: `scale(${wordScale})`,
                    opacity: wordOpacity,
                    transformOrigin: "left bottom",
                  }}
                >
                  {word}
                </span>
              );
            })}
          </h1>

          <div
            style={{
              marginTop: 18,
              width: lineWidth,
              height: 3,
              borderRadius: 2,
              backgroundColor: slide.accentColor,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 34,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 960,
          }}
        >
          {steps.map((step, idx) => {
            const startFrame = 24 + idx * 20;
            const entrySpring = spring({
              frame: Math.max(0, frame - startFrame),
              fps,
              config: { damping: 14, stiffness: 170 },
            });
            const translateY = interpolate(entrySpring, [0, 1], [40, 0]);
            const opacity = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const numberScale = spring({
              frame: Math.max(0, frame - startFrame),
              fps,
              config: { damping: 12, stiffness: 220 },
            });

            const connectorWidth = interpolate(frame, [startFrame + 8, startFrame + 28], [0, 100], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div key={`${step}-${idx}`}>
                <div
                  style={{
                    transform: `translateY(${translateY}px)`,
                    opacity,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: slide.accentColor,
                      color: "#0a0c16",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transform: `scale(${interpolate(numberScale, [0, 1], [0.6, 1])})`,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div
                    style={{
                      color: "#ffffff",
                      fontSize: 24,
                      lineHeight: 1.6,
                      fontWeight: 500,
                    }}
                  >
                    {step}
                  </div>
                </div>

                {idx < steps.length - 1 ? (
                  <div
                    style={{
                      marginLeft: 20,
                      marginTop: 8,
                      width: `${connectorWidth}%`,
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: slide.accentColor,
                      opacity: 0.65,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide3InPractice;
