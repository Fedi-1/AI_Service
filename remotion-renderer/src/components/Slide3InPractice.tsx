import React from "react";
import { Audio, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideData } from "../types";
import AnimatedBackground from "./AnimatedBackground";

interface Slide3Props {
  slide: SlideData;
  currentTimeSeconds: number;
}

function parseSteps(script: string): string[] {
  // Split on numbered patterns: "1." "1)" "1 -"
  const parts = script.split(/\n\s*\d+[.)]\s*|^\s*\d+[.)]\s*/m).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, 3);
  const lines = script.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 3);
  return [script.trim()];
}

const Slide3InPractice: React.FC<Slide3Props> = ({ slide, currentTimeSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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

  // Vertical connecting timeline line: height 0→430px over frames 20-90
  const timelineHeight = interpolate(frame, [20, 90], [0, 430], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const steps = parseSteps(slide.script);
  const stepFrameStarts = [25, 55, 85];

  // Per-step fill bar: fraction of step words spoken
  const totalWords = slide.words.length;
  const wordsPerStep = totalWords > 0 ? Math.ceil(totalWords / 3) : 1;

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

      {/* Title */}
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

      {/* Vertical timeline line at x=85, y=130→560 */}
      <div
        style={{
          position: "absolute",
          left: 85,
          top: 130,
          width: 2,
          height: timelineHeight,
          backgroundColor: slide.accentColor,
          opacity: 0.4,
        }}
      />

      {/* Steps */}
      {steps.map((step, idx) => {
        const startF = stepFrameStarts[idx] ?? 25;

        const opacity = interpolate(frame, [startF, startF + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const circleScale = spring({
          fps,
          frame: Math.max(0, frame - startF),
          config: { stiffness: 200, damping: 18 },
          durationInFrames: 20,
        });

        // Fill bar: fraction of this step's word chunk that has been spoken
        const stepWordStart = idx * wordsPerStep;
        const stepWordEnd = Math.min(stepWordStart + wordsPerStep, totalWords);
        const stepWords = slide.words.slice(stepWordStart, stepWordEnd);
        const spokenCount = stepWords.filter(
          (w) => w.end <= currentTimeSeconds
        ).length;
        const fillFraction = stepWords.length > 0 ? spokenCount / stepWords.length : 0;
        const fillBarWidth = fillFraction * 300;

        const topY = 140 + idx * 145;

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              top: topY,
              left: 60,
              right: 60,
              opacity,
              display: "flex",
              alignItems: "flex-start",
              gap: 24,
            }}
          >
            {/* Step number circle at x≈70 relative to left:60 → absolute ~130 */}
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: `2px solid ${slide.accentColor}`,
                backgroundColor: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transform: `scale(${circleScale})`,
              }}
            >
              <span
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: "bold",
                  fontSize: 18,
                  color: slide.accentColor,
                }}
              >
                {idx + 1}
              </span>
            </div>

            {/* Step text + fill bar */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 24,
                  color: "rgb(255,255,255)",
                  lineHeight: 1.5,
                  marginBottom: 10,
                }}
              >
                {step}
              </div>
              {/* Fill bar */}
              <div
                style={{
                  width: 300,
                  height: 3,
                  backgroundColor: "rgb(30,35,60)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    width: fillBarWidth,
                    height: "100%",
                    backgroundColor: slide.accentColor,
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Progress bar — slide 3 of 4 */}
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
            width: (3 / 4) * 1280,
            height: "100%",
            backgroundColor: slide.accentColor,
          }}
        />
      </div>

      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide3InPractice;
