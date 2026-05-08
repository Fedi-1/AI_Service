// C:\Users\firas\Desktop\PFE Project\learnai-ai-service\remotion-renderer\src\components\Slide4Challenge.tsx
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
  const slideDurationInFrames = Math.max(1, Math.ceil(slide.audioDurationSeconds * 30) + 20);

  const bgGradient = interpolateColors(
    frame,
    [0, Math.floor(slideDurationInFrames / 2), slideDurationInFrames],
    ["#0D0F1A", "#111827", "#0f172a"]
  );

  const particle1X = interpolate(frame, [0, slideDurationInFrames], [-50, 80], {
    extrapolateRight: "clamp",
  });
  const particle1Y = interpolate(frame, [0, slideDurationInFrames], [110, -40], {
    extrapolateRight: "clamp",
  });
  const particle2X = interpolate(frame, [0, slideDurationInFrames], [940, 800], {
    extrapolateRight: "clamp",
  });
  const particle2Y = interpolate(frame, [0, slideDurationInFrames], [-80, 60], {
    extrapolateRight: "clamp",
  });
  const particle3X = interpolate(frame, [0, slideDurationInFrames], [190, 350], {
    extrapolateRight: "clamp",
  });
  const particle3Y = interpolate(frame, [0, slideDurationInFrames], [620, 470], {
    extrapolateRight: "clamp",
  });
  const particle4X = interpolate(frame, [0, slideDurationInFrames], [1050, 900], {
    extrapolateRight: "clamp",
  });
  const particle4Y = interpolate(frame, [0, slideDurationInFrames], [560, 410], {
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

  const qSpring = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 160 },
  });
  const questionScale = interpolate(qSpring, [0, 1], [0, 1]);

  const ringScale = interpolate(frame % 60, [0, 30, 60], [1, 1.15, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(frame % 60, [0, 30, 60], [0.6, 0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lastWordEnd = slide.words.length > 0 ? slide.words[slide.words.length - 1].end : 0;
  const allSpoken = currentTimeSeconds > lastWordEnd && lastWordEnd > 0;
  const isEn = !language.startsWith("fr");
  const chips = [
    { value: flashcardCount, label: "Flashcards" },
    { value: quizCount, label: language.startsWith("fr") ? "Questions" : "Questions" },
    { value: estimatedReadTime, label: isEn ? "min read" : "min" },
  ];

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
          background: `radial-gradient(circle at 18% 24%, rgba(255,255,255,0.04), transparent 45%), ${bgGradient}`,
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
          backgroundColor: "#c4b5fd",
          opacity: 0.1,
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
          opacity: 0.09,
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
            alignItems: "center",
            gap: 22,
          }}
        >
          <div style={{ position: "relative", width: 180, height: 180 }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 160,
                height: 160,
                marginLeft: -80,
                marginTop: -80,
                borderRadius: "50%",
                border: `2px solid ${slide.accentColor}`,
                transform: `scale(${ringScale})`,
                opacity: ringOpacity,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) scale(${questionScale})`,
                fontSize: 120,
                fontWeight: 800,
                color: slide.accentColor,
                textShadow: `0 0 24px ${slide.accentColor}`,
              }}
            >
              ?
            </div>
          </div>

          <div
            style={{
              maxWidth: 800,
              lineHeight: 1.8,
              fontSize: 28,
              textAlign: "center",
            }}
          >
            {slide.words.map((w, idx) => {
              const isPast = currentTimeSeconds >= w.end;
              const isSpeaking = currentTimeSeconds >= w.start && currentTimeSeconds < w.end;

              const wordStartFrame = Math.max(0, Math.floor(w.start * fps));
              const bounce = spring({
                frame: Math.max(0, frame - wordStartFrame),
                fps,
                config: { damping: 12, stiffness: 200 },
              });
              const bounceScale = interpolate(bounce, [0, 1], [0.95, 1]);
              const speakingScale = isSpeaking ? 1.08 : 1;

              const color = isSpeaking ? slide.accentColor : isPast ? "#ffffff" : "#475569";
              const opacity = isSpeaking ? 1 : isPast ? 0.7 : 0.5;

              return (
                <span
                  key={`${w.word}-${idx}`}
                  style={{
                    display: "inline-block",
                    marginRight: 8,
                    color,
                    opacity,
                    fontWeight: isSpeaking ? 700 : 500,
                    transform: `scale(${bounceScale * speakingScale})`,
                    textShadow: isSpeaking ? `0 0 20px ${slide.accentColor}CC` : "none",
                  }}
                >
                  {w.word}
                </span>
              );
            })}
          </div>

          {allSpoken ? (
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {chips.map((chip, idx) => {
                const chipScale = spring({
                  frame: Math.max(0, frame - (idx * 5 + 20)),
                  fps,
                  config: { damping: 16, stiffness: 180 },
                });
                return (
                  <div
                    key={`${chip.label}-${idx}`}
                    style={{
                      border: `1px solid ${slide.accentColor}`,
                      borderRadius: 999,
                      padding: "8px 16px",
                      fontSize: 14,
                      color: "#cbd5e1",
                      backgroundColor: "rgba(0,0,0,0.35)",
                      transform: `scale(${interpolate(chipScale, [0, 1], [0.8, 1])})`,
                    }}
                  >
                    {chip.value} {chip.label}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide4Challenge;
