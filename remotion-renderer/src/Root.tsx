// C:\Users\firas\Desktop\PFE Project\learnai-ai-service\remotion-renderer\src\Root.tsx
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { VideoData } from "./types";
import Slide1WhyItMatters from "./components/Slide1WhyItMatters";
import Slide2KeyConcepts from "./components/Slide2KeyConcepts";
import Slide3InPractice from "./components/Slide3InPractice";
import Slide4Challenge from "./components/Slide4Challenge";

export const TRANSITION_FRAMES = 20;

interface SlideWrapperProps {
  children: React.ReactNode;
  localFrame: number;
  totalFrames: number;
  slideIndex: number;
  totalSlides: number;
  lessonTitle: string;
  accentColor: string;
}

const SlideWrapper: React.FC<SlideWrapperProps> = ({
  children,
  localFrame,
  totalFrames,
  slideIndex,
  totalSlides,
  lessonTitle,
  accentColor,
}) => {
  const outStart = totalFrames - TRANSITION_FRAMES;

  const inScale = interpolate(localFrame, [0, TRANSITION_FRAMES], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const inOpacity = interpolate(localFrame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const outScale = interpolate(localFrame, [outStart, totalFrames], [1, 0.95], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outOpacity = interpolate(localFrame, [outStart, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const isTransitioningIn = localFrame < TRANSITION_FRAMES;
  const isTransitioningOut = localFrame >= outStart;

  const scale = isTransitioningIn ? inScale : isTransitioningOut ? outScale : 1;
  const opacity = isTransitioningIn ? inOpacity : isTransitioningOut ? outOpacity : 1;

  const safeLessonTitle = lessonTitle.length > 30 ? `${lessonTitle.slice(0, 30)}...` : lessonTitle;
  const badgeOpacity = interpolate(localFrame, [10, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const counterOpacity = interpolate(localFrame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progressWidth = interpolate(localFrame, [0, totalFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 1280,
        height: 720,
        overflow: "hidden",
        transform: `scale(${scale})`,
        opacity,
        position: "relative",
      }}
    >
      {children}

      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          padding: "8px 10px",
          borderRadius: 8,
          backgroundColor: "rgba(0,0,0,0.4)",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 12,
          color: "#94a3b8",
          opacity: badgeOpacity,
          pointerEvents: "none",
        }}
      >
        {safeLessonTitle}
      </div>

      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 16,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
          color: "#94a3b8",
          opacity: counterOpacity,
          pointerEvents: "none",
        }}
      >
        {slideIndex + 1} / {totalSlides}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: "rgba(255,255,255,0.1)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: `${progressWidth}%`,
            height: "100%",
            backgroundColor: accentColor,
          }}
        />
      </div>
    </div>
  );
};

export const Root: React.FC<{ videoData: VideoData }> = ({ videoData }) => {
  const frame = useCurrentFrame();

  const slides = videoData.slides;

  const slideDurations = slides.map(
    (s) => Math.ceil(s.audioDurationSeconds * 30) + TRANSITION_FRAMES
  );

  const slideStarts: number[] = [];
  let cursor = 0;
  for (let i = 0; i < slides.length; i++) {
    slideStarts.push(cursor);
    cursor += slideDurations[i] - TRANSITION_FRAMES;
  }
  cursor += TRANSITION_FRAMES;

  const slideComponents = [
    (localFrame: number, slide: (typeof slides)[0]) => (
      <Slide1WhyItMatters
        slide={slide}
        currentTimeSeconds={localFrame / 30}
        language={videoData.language}
      />
    ),
    (localFrame: number, slide: (typeof slides)[0]) => (
      <Slide2KeyConcepts
        slide={slide}
        currentTimeSeconds={localFrame / 30}
      />
    ),
    (localFrame: number, slide: (typeof slides)[0]) => (
      <Slide3InPractice
        slide={slide}
        currentTimeSeconds={localFrame / 30}
      />
    ),
    (localFrame: number, slide: (typeof slides)[0]) => (
      <Slide4Challenge
        slide={slide}
        currentTimeSeconds={localFrame / 30}
        flashcardCount={videoData.flashcardCount}
        quizCount={videoData.quizCount}
        estimatedReadTime={videoData.estimatedReadTime}
        language={videoData.language}
      />
    ),
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "rgb(10,15,35)" }}>
      {slides.map((slide, i) => {
        const startFrame = slideStarts[i];
        const duration = slideDurations[i];
        const renderSlide = slideComponents[i];

        return (
          <Sequence key={i} from={startFrame} durationInFrames={duration}>
            <SlideWrapper
              localFrame={frame - startFrame}
              totalFrames={duration}
              slideIndex={i}
              totalSlides={slides.length}
              lessonTitle={videoData.lessonTitle}
              accentColor={slide.accentColor}
            >
              {renderSlide(frame - startFrame, slide)}
            </SlideWrapper>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
