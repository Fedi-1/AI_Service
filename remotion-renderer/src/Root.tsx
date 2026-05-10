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
  accentColor: string;
}

const SlideWrapper: React.FC<SlideWrapperProps> = ({
  children,
  localFrame,
  totalFrames,
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

  const transitionSweep = interpolate(localFrame, [0, TRANSITION_FRAMES], [-100, 100], {
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
          inset: 0,
          background: `linear-gradient(105deg, transparent 0%, ${accentColor}00 35%, ${accentColor}40 48%, #ffffff22 50%, ${accentColor}20 54%, transparent 70%)`,
          transform: `translateX(${transitionSweep}%)`,
          opacity: localFrame < TRANSITION_FRAMES ? 1 : 0,
          pointerEvents: "none",
        }}
      />
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
        language={videoData.language}
      />
    ),
    (localFrame: number, slide: (typeof slides)[0]) => (
      <Slide3InPractice
        slide={slide}
        currentTimeSeconds={localFrame / 30}
        language={videoData.language}
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
