import React from "react";
import { Audio, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideData } from "../types";
import AnimatedBackground from "./AnimatedBackground";

interface Slide2Props {
  slide: SlideData;
  currentTimeSeconds: number;
}

function parsePoints(script: string): string[] {
  // Split on dash+space at start of line, or " - " inline
  const parts = script.split(/\n\s*[-–]\s*|^[-–]\s*/m).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 3);
  // Fallback: split on newlines
  const lines = script.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 3);
  return [script.trim()];
}

const Slide2KeyConcepts: React.FC<Slide2Props> = ({ slide, currentTimeSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title spring animation
  const titleSpring = spring({
    fps,
    frame,
    config: { stiffness: 120, damping: 14, mass: 1 },
    durationInFrames: 25,
  });
  const titleY = -60 + titleSpring * 60;

  const separatorWidth = interpolate(frame, [20, 50], [0, 1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const points = parsePoints(slide.script);

  // Stagger ranges: [30,55], [55,80], [80,105]
  const bulletRanges: [number, number][] = [
    [30, 55],
    [55, 80],
    [80, 105],
  ];

  return (
    <div style={{ width: 1280, height: 720, position: "relative", overflow: "hidden" }}>
      <AnimatedBackground
        width={1280}
        height={720}
        currentTimeSeconds={currentTimeSeconds}
        accentColor={slide.accentColor}
      />

      {/* Decorative inset border */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          right: 20,
          bottom: 20,
          border: "1px solid rgb(40,45,80)",
          borderRadius: 4,
          pointerEvents: "none",
        }}
      />

      {/* Title section */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${titleY}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 48,
        }}
      >
        <div
          style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: "bold",
            fontSize: 52,
            color: slide.accentColor,
            textAlign: "center",
          }}
        >
          {slide.title}
        </div>
        <div
          style={{
            width: separatorWidth,
            height: 2,
            backgroundColor: slide.accentColor,
            opacity: 0.7,
            marginTop: 12,
          }}
        />
      </div>

      {/* Bullet points */}
      <div
        style={{
          position: "absolute",
          top: 160,
          left: 60,
          right: 60,
          display: "flex",
          flexDirection: "column",
          gap: 48,
        }}
      >
        {points.map((point, idx) => {
          const [startF, endF] = bulletRanges[idx] ?? [30, 55];

          const translateX = interpolate(frame, [startF, endF], [-80, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const opacity = interpolate(frame, [startF, endF], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Bullet circle scale spring
          const bulletScale = spring({
            fps,
            frame: Math.max(0, frame - startF),
            config: { stiffness: 200, damping: 18 },
            durationInFrames: 20,
          });

          // Check if this bullet's words have all been spoken → shimmer
          const bulletWordsDone =
            slide.words.length > 0 &&
            currentTimeSeconds > slide.words[slide.words.length - 1].end * ((idx + 1) / 3);
          const shimmerOpacity = bulletWordsDone
            ? 0.7 + 0.3 * Math.sin(currentTimeSeconds * 4)
            : 1;

          return (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                transform: `translateX(${translateX}px)`,
                opacity,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  backgroundColor: slide.accentColor,
                  flexShrink: 0,
                  transform: `scale(${bulletScale})`,
                  opacity: shimmerOpacity,
                }}
              />
              <div
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 26,
                  color: "rgb(255,255,255)",
                  lineHeight: 1.5,
                }}
              >
                {point}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar — slide 2 of 4 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: "rgb(20,25,50)",
        }}
      >
        <div
          style={{
            width: (2 / 4) * 1280,
            height: "100%",
            backgroundColor: slide.accentColor,
          }}
        />
      </div>

      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide2KeyConcepts;
