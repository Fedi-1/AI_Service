// C:\Users\firas\Desktop\PFE Project\learnai-ai-service\remotion-renderer\src\components\Slide1WhyItMatters.tsx
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

interface Slide1Props {
  slide: SlideData;
  currentTimeSeconds: number;
  language: string;
}

const Slide1WhyItMatters: React.FC<Slide1Props> = ({ slide, currentTimeSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slideDurationInFrames = Math.max(1, Math.ceil(slide.audioDurationSeconds * 30) + 20);

  const bgGradient = interpolateColors(
    frame,
    [0, Math.floor(slideDurationInFrames / 2), slideDurationInFrames],
    ["#0D0F1A", "#111827", "#0F172A"]
  );

  const particle1X = interpolate(frame, [0, slideDurationInFrames], [-50, 80], {
    extrapolateRight: "clamp",
  });
  const particle1Y = interpolate(frame, [0, slideDurationInFrames], [100, -50], {
    extrapolateRight: "clamp",
  });

  const particle2X = interpolate(frame, [0, slideDurationInFrames], [920, 780], {
    extrapolateRight: "clamp",
  });
  const particle2Y = interpolate(frame, [0, slideDurationInFrames], [-90, 50], {
    extrapolateRight: "clamp",
  });

  const particle3X = interpolate(frame, [0, slideDurationInFrames], [200, 340], {
    extrapolateRight: "clamp",
  });
  const particle3Y = interpolate(frame, [0, slideDurationInFrames], [620, 480], {
    extrapolateRight: "clamp",
  });

  const particle4X = interpolate(frame, [0, slideDurationInFrames], [1040, 900], {
    extrapolateRight: "clamp",
  });
  const particle4Y = interpolate(frame, [0, slideDurationInFrames], [560, 400], {
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
          background: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05), transparent 45%), ${bgGradient}`,
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
          backgroundColor: "#60a5fa",
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
            marginTop: 38,
            alignSelf: "center",
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
      </div>

      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export default Slide1WhyItMatters;
