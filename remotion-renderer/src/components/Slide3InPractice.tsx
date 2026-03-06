import React from "react";
import { Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideData } from "../types";
import AnimatedBackground from "./AnimatedBackground";
import SlideIllustration from "./SlideIllustration";

interface Slide3Props {
  slide: SlideData;
  currentTimeSeconds: number;
}

/**
 * Parse the script into exactly 3 step strings.
 * Prioritises lines that start with a digit + dot/paren (e.g. "1. Step one").
 */
function parseSteps(script: string): string[] {
  const lines = script
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Try numbered lines first: "1. ...", "2) ...", etc.
  const numbered = lines
    .filter((l) => /^\d+[.)]\s+/.test(l))
    .map((l) => l.replace(/^\d+[.)]\s+/, "").trim());
  if (numbered.length >= 3) return numbered.slice(0, 3);

  // Fallback: non-empty lines
  if (lines.length >= 3) return lines.slice(0, 3);

  // Last fallback: split on sentences
  const sentences = script
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= 3) {
    const chunk = Math.ceil(sentences.length / 3);
    return [
      sentences.slice(0, chunk).join(". ") + ".",
      sentences.slice(chunk, chunk * 2).join(". ") + ".",
      sentences.slice(chunk * 2).join(". ") + ".",
    ];
  }

  // Pad to 3 if we have fewer
  const result = numbered.length > 0 ? [...numbered] : [script.trim()];
  while (result.length < 3) result.push("");
  return result.slice(0, 3);
}

const Slide3InPractice: React.FC<Slide3Props> = ({ slide, currentTimeSeconds }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title spring
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

  const steps = parseSteps(slide.script);

  // Each step appears at 1/3, 2/3, 3/3 of the slide duration (in seconds)
  const slideDuration = durationInFrames / fps;
  const stepThresholds = [0, slideDuration / 3, (slideDuration * 2) / 3];

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

      {/* Terminal glow — purely decorative */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: 140,
          color: slide.accentColor,
          opacity: 0.05,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {`>`}
      </div>

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

      {/* Step cards */}
      <div
        style={{
          position: "absolute",
          top: 148,
          left: 60,
          right: 60,
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        {steps.map((step, idx) => {
          const isVisible = currentTimeSeconds >= stepThresholds[idx];

          // Frame-based stagger for smooth entrance
          const entryFrame = Math.round(stepThresholds[idx] * fps);
          const localFrame = Math.max(0, frame - entryFrame);

          const translateX = interpolate(localFrame, [0, 22], [-60, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const opacity = interpolate(localFrame, [0, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const numberScale = spring({
            fps,
            frame: localFrame,
            config: { stiffness: 200, damping: 18 },
            durationInFrames: 20,
          });

          // Fill bar grows after step is fully entered
          const barWidth = interpolate(localFrame, [22, 52], [0, 100], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={idx}
              style={{
                display: isVisible ? "flex" : "none",
                alignItems: "flex-start",
                gap: 20,
                transform: `translateX(${translateX}px)`,
                opacity,
              }}
            >
              {/* Step number circle */}
              <div
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: slide.accentColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: '"Playfair Display", serif',
                  fontWeight: "bold",
                  fontSize: 18,
                  color: "rgb(10,15,35)",
                  transform: `scale(${numberScale})`,
                }}
              >
                {idx + 1}
              </div>

              {/* Text + fill bar */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontSize: 25,
                    color: "rgb(255,255,255)",
                    lineHeight: 1.5,
                    marginBottom: 8,
                  }}
                >
                  {step}
                </div>
                <div
                  style={{
                    height: 2,
                    backgroundColor: "rgb(30,35,70)",
                    borderRadius: 1,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${barWidth}%`,
                      backgroundColor: slide.accentColor,
                      opacity: 0.6,
                      borderRadius: 1,
                      transition: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Illustration */}
      <SlideIllustration
        slideNumber={3}
        currentTimeSeconds={currentTimeSeconds}
        accentColor={slide.accentColor}
        size={160}
      />

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
