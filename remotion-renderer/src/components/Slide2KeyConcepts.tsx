import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SlideData } from "../types";
import {
  CinematicStage,
  DataStream,
  GlassPanel,
  normalizeVideoLanguage,
  splitIntoPoints,
} from "./CinematicElements";

interface Slide2Props {
  slide: SlideData;
  currentTimeSeconds: number;
  language: string;
}

const nodePositions = [
  { x: 128, y: 192 },
  { x: 840, y: 170 },
  { x: 808, y: 420 },
];

const Slide2KeyConcepts: React.FC<Slide2Props> = ({ slide, currentTimeSeconds, language }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const videoLanguage = normalizeVideoLanguage(language);
  const points = splitIntoPoints(slide.script, 3);
  const corePulse = interpolate(frame % 54, [0, 27, 54], [1, 1.08, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const orbit = frame * 1.2;

  return (
    <CinematicStage
      slide={slide}
      currentTimeSeconds={currentTimeSeconds}
      sceneLabel={
        videoLanguage === "fr" ? "Concepts" : videoLanguage === "ar" ? "المفاهيم" : "Concepts"
      }
      language={videoLanguage}
    >
      {nodePositions.map((pos, index) => (
        <DataStream
          key={index}
          from={[640, 360]}
          to={[pos.x + 175, pos.y + 88]}
          delay={16 + index * 13}
          accentColor={index === 1 ? "#38bdf8" : slide.accentColor}
        />
      ))}

      <div
        style={{
          position: "absolute",
          left: 536,
          top: 256,
          width: 208,
          height: 208,
          borderRadius: "50%",
          border: `2px solid ${slide.accentColor}`,
          backgroundColor: "rgba(15,23,42,0.82)",
          boxShadow: `0 0 70px ${slide.accentColor}44`,
          transform: `scale(${corePulse})`,
        }}
      >
        {[0, 1, 2].map((ring) => (
          <div
            key={ring}
            style={{
              position: "absolute",
              inset: 20 + ring * 28,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.13)",
              transform: `rotate(${orbit + ring * 34}deg)`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <div style={{ color: "#f8fafc", fontSize: 30, fontWeight: 900 }}>Concepts</div>
        </div>
      </div>

      {points.map((point, index) => {
        const pos = nodePositions[index];
        const delay = 24 + index * 18;
        const enter = spring({
          frame: Math.max(0, frame - delay),
          fps,
          config: { damping: 17, stiffness: 150 },
        });
        const lift = interpolate(enter, [0, 1], [28, 0]);
        const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const active = currentTimeSeconds > index * Math.max(1.2, slide.audioDurationSeconds / 4);
        const textSize = point.length > 180 ? 15 : point.length > 120 ? 16 : 18;

        return (
          <GlassPanel
            key={index}
            x={pos.x}
            y={pos.y}
            width={360}
            height={180}
            delay={delay}
            accentColor={index === 1 ? "#38bdf8" : slide.accentColor}
          >
            <div
              style={{
                padding: 20,
                height: "100%",
                transform: `translateY(${lift}px)`,
                opacity,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  color: active ? slide.accentColor : "#94a3b8",
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: active ? slide.accentColor : "rgba(255,255,255,0.1)",
                    color: active ? "#08111f" : "#cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                  }}
                >
                  {index + 1}
                </div>
                CONCEPT {index + 1}
              </div>
              <div
                style={{
                  marginTop: 14,
                  color: "#f8fafc",
                  fontSize: textSize,
                  lineHeight: 1.28,
                  fontWeight: 780,
                }}
              >
                {point}
              </div>
            </div>
          </GlassPanel>
        );
      })}
    </CinematicStage>
  );
};

export default Slide2KeyConcepts;
