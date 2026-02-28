import React from "react";
import { Audio, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideData } from "../types";
import AnimatedBackground from "./AnimatedBackground";
import WordByWord from "./WordByWord";

const PURPLE = "rgb(167,139,250)";
const PURPLE_LIGHT = "rgb(200,180,255)";

interface Slide4Props {
  slide: SlideData;
  currentTimeSeconds: number;
  flashcardCount: number;
  quizCount: number;
  estimatedReadTime: number;
  language: string;
}

const Slide4Challenge: React.FC<Slide4Props> = ({
  slide,
  currentTimeSeconds,
  flashcardCount,
  quizCount,
  estimatedReadTime,
  language,
}) => {
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

  // All words spoken check
  const lastWordEnd =
    slide.words.length > 0 ? slide.words[slide.words.length - 1].end : 0;
  const allSpoken = currentTimeSeconds > lastWordEnd && lastWordEnd > 0;

  const isEn = !language.startsWith("fr");
  const chipLabel = isEn ? "min read" : "min";
  const chips = [
    {
      value: flashcardCount,
      label: language.startsWith("fr") ? "Flashcards" : "Flashcards",
    },
    {
      value: quizCount,
      label: language.startsWith("fr") ? "Questions" : "Questions",
    },
    {
      value: estimatedReadTime,
      label: language.startsWith("fr") ? `${chipLabel}` : `${chipLabel}`,
    },
  ];

  return (
    <div style={{ width: 1280, height: 720, position: "relative", overflow: "hidden" }}>
      <AnimatedBackground
        width={1280}
        height={720}
        currentTimeSeconds={currentTimeSeconds}
        accentColor={PURPLE}
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

      {/* Decorative large question mark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: '"Playfair Display", serif',
          fontWeight: "bold",
          fontSize: 180,
          color: PURPLE,
          opacity: 0.08,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        ?
      </div>

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
            color: PURPLE,
            textAlign: "center",
          }}
        >
          {slide.title}
        </div>
        <div
          style={{
            width: separatorWidth,
            height: 2,
            backgroundColor: PURPLE,
            opacity: 0.7,
            marginTop: 12,
          }}
        />
      </div>

      {/* Word-by-word body */}
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
          accentColor={PURPLE_LIGHT}
          maxWidthPx={1150}
        />
      </div>

      {/* Stat chips — appear after all words spoken */}
      {allSpoken && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {chips.map((chip, idx) => {
            const chipScale = spring({
              fps,
              frame: Math.max(0, frame - idx * 5),
              config: { stiffness: 180, damping: 16 },
              durationInFrames: 20,
            });
            return (
              <div
                key={idx}
                style={{
                  border: `1px solid rgba(167,139,250,0.5)`,
                  borderRadius: 999,
                  padding: "8px 20px",
                  fontFamily: '"Playfair Display", serif',
                  fontSize: 16,
                  color: "rgb(200,200,200)",
                  transform: `scale(${chipScale})`,
                  backgroundColor: "rgba(10,15,35,0.6)",
                }}
              >
                {chip.value} {chip.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Progress bar — slide 4 of 4 (full) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: PURPLE,
        }}
      />

      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide4Challenge;
