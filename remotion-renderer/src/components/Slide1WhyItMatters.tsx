import React from "react";
import { Audio, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideData } from "../types";
import AnimatedBackground from "./AnimatedBackground";
import WordByWord from "./WordByWord";

interface Slide1Props {
  slide: SlideData;
  currentTimeSeconds: number;
  language: string;
}

const Slide1WhyItMatters: React.FC<Slide1Props> = ({
  slide,
  currentTimeSeconds,
  language,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title spring animation: slide down from y=-60 to y=0 over frames 0-25
  const titleSpring = spring({
    fps,
    frame,
    config: { stiffness: 120, damping: 14, mass: 1 },
    durationInFrames: 25,
  });
  const titleY = -60 + titleSpring * 60;

  // Separator width animation: 0 → 1200px over frames 20-50
  const separatorWidth = interpolate(frame, [20, 50], [0, 1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        {/* Separator line */}
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

      {/* Word-by-word body at ~y=130 */}
      <div
        style={{
          position: "absolute",
          top: 130,
          left: 0,
          right: 0,
          padding: "0 60px",
        }}
      >
        <WordByWord
          words={slide.words}
          currentTimeSeconds={currentTimeSeconds}
          fontSize={28}
          accentColor={slide.accentColor}
          maxWidthPx={1150}
        />
      </div>

      {/* Progress bar — slide 1 of 4 */}
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
            width: (1 / 4) * 1280,
            height: "100%",
            backgroundColor: slide.accentColor,
          }}
        />
      </div>

      {/* Slide audio */}
      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide1WhyItMatters;
