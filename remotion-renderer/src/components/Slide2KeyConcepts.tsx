// C:\Users\firas\Desktop\PFE Project\learnai-ai-service\remotion-renderer\src\components\Slide2KeyConcepts.tsx
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

interface Slide2Props {
  slide: SlideData;
  currentTimeSeconds: number;
}

function parsePoints(script: string): string[] {
  const parts = script
    .split(/\n\s*-\s*|^-\s*/m)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 3);

  const lines = script
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 3);

  return [script.trim()];
}

const Slide2KeyConcepts: React.FC<Slide2Props> = ({ slide }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideDurationInFrames = Math.max(1, Math.ceil(slide.audioDurationSeconds * 30) + 20);

  const bgGradient = interpolateColors(
    frame,
    [0, Math.floor(slideDurationInFrames / 2), slideDurationInFrames],
    ["#0F1117", "#111827", "#0b1220"]
  );

  const particle1X = interpolate(frame, [0, slideDurationInFrames], [-50, 70], {
    extrapolateRight: "clamp",
  });
  const particle1Y = interpolate(frame, [0, slideDurationInFrames], [120, -40], {
    extrapolateRight: "clamp",
  });
  const particle2X = interpolate(frame, [0, slideDurationInFrames], [960, 820], {
    extrapolateRight: "clamp",
  });
  const particle2Y = interpolate(frame, [0, slideDurationInFrames], [-70, 60], {
    extrapolateRight: "clamp",
  });
  const particle3X = interpolate(frame, [0, slideDurationInFrames], [180, 320], {
    extrapolateRight: "clamp",
  });
  const particle3Y = interpolate(frame, [0, slideDurationInFrames], [610, 470], {
    extrapolateRight: "clamp",
  });
  const particle4X = interpolate(frame, [0, slideDurationInFrames], [1020, 890], {
    extrapolateRight: "clamp",
  });
  const particle4Y = interpolate(frame, [0, slideDurationInFrames], [570, 420], {
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

  const points = parsePoints(slide.script).slice(0, 3);

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
          background: `radial-gradient(circle at 15% 25%, rgba(255,255,255,0.04), transparent 45%), ${bgGradient}`,
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
          opacity: 0.11,
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
          backgroundColor: "#93c5fd",
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
            maxWidth: 920,
          }}
        >
          {points.map((point, idx) => {
            const startFrame = 26 + idx * 15;
            const entrySpring = spring({
              frame: Math.max(0, frame - startFrame),
              fps,
              config: { damping: 14, stiffness: 160 },
            });
            const translateX = interpolate(entrySpring, [0, 1], [-40, 0]);
            const opacity = interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            const dotScale = spring({
              frame: Math.max(0, frame - startFrame),
              fps,
              config: { damping: 12, stiffness: 220 },
            });
            const dotPulse = interpolate(dotScale, [0, 1], [0, 1]);

            return (
              <div
                key={`${point}-${idx}`}
                style={{
                  transform: `translateX(${translateX}px)`,
                  opacity,
                  borderLeft: `3px solid ${slide.accentColor}`,
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: slide.accentColor,
                    transform: `scale(${dotPulse})`,
                    marginTop: 10,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: 24,
                    color: "#ffffff",
                    lineHeight: 1.6,
                    fontWeight: 500,
                  }}
                >
                  {point}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide2KeyConcepts;
