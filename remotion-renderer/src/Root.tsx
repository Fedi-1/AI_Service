import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { VideoData } from "./types";
import Slide1WhyItMatters from "./components/Slide1WhyItMatters";
import Slide2KeyConcepts from "./components/Slide2KeyConcepts";
import Slide3InPractice from "./components/Slide3InPractice";
import Slide4Challenge from "./components/Slide4Challenge";

export const TRANSITION_FRAMES = 20;

interface SlideWrapperProps {
  children: React.ReactNode;
  /** frame offset relative to this slide's Sequence start */
  localFrame: number;
  totalFrames: number;
}

/** Applies zoom-out-then-in cross-slide transition */
const SlideWrapper: React.FC<SlideWrapperProps> = ({ children, localFrame, totalFrames }) => {
  const outStart = totalFrames - TRANSITION_FRAMES;

  // Incoming: frames 0 → TRANSITION_FRAMES : scale 1.15→1.0, opacity 0→1
  const inScale = interpolate(localFrame, [0, TRANSITION_FRAMES], [1.15, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const inOpacity = interpolate(localFrame, [0, TRANSITION_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Outgoing: frames outStart → totalFrames : scale 1.0→0.85, opacity 1→0
  const outScale = interpolate(localFrame, [outStart, totalFrames], [1.0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const outOpacity = interpolate(localFrame, [outStart, totalFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });

  // Combine: during transition-in window use in*, during transition-out use out*
  const isTransitioningIn = localFrame < TRANSITION_FRAMES;
  const isTransitioningOut = localFrame >= outStart;

  let scale = 1.0;
  let opacity = 1.0;

  if (isTransitioningIn) {
    scale = inScale;
    opacity = inOpacity;
  } else if (isTransitioningOut) {
    scale = outScale;
    opacity = outOpacity;
  }

  return (
    <div
      style={{
        width: 1280,
        height: 720,
        overflow: "hidden",
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

export const Root: React.FC<{ videoData: VideoData }> = ({ videoData }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const slides = videoData.slides;

  // Duration for each slide in frames
  const slideDurations = slides.map(
    (s) => Math.ceil(s.audioDurationSeconds * 30) + TRANSITION_FRAMES
  );

  // Compute start frame for each slide (overlap by TRANSITION_FRAMES)
  const slideStarts: number[] = [];
  let cursor = 0;
  for (let i = 0; i < slides.length; i++) {
    slideStarts.push(cursor);
    cursor += slideDurations[i] - TRANSITION_FRAMES;
  }
  // Last slide has no outgoing overlap, add TRANSITION_FRAMES back
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
            >
              {renderSlide(frame - startFrame, slide)}
            </SlideWrapper>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
