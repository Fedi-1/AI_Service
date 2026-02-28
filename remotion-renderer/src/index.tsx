import { registerRoot, Composition } from "remotion";
import React from "react";
import { Root, TRANSITION_FRAMES } from "./Root";
import type { VideoData } from "./types";

// Placeholder VideoData for Remotion Studio preview
const placeholderVideoData: VideoData = {
  lessonTitle: "Lesson Preview",
  language: "en",
  flashcardCount: 10,
  quizCount: 5,
  estimatedReadTime: 3,
  slides: [
    {
      title: "Why does this matter?",
      accentColor: "#f59e0b",
      script: "This is the first slide narration text for preview purposes.",
      words: [
        { word: "This", start: 0, end: 0.3 },
        { word: "is", start: 0.3, end: 0.5 },
        { word: "the", start: 0.5, end: 0.7 },
        { word: "first", start: 0.7, end: 1.0 },
        { word: "slide.", start: 1.0, end: 1.5 },
      ],
      audioDurationSeconds: 5,
      audioFilePath: "",
    },
    {
      title: "Key Takeaway",
      accentColor: "#6366f1",
      script: "- First key point here\n- Second key point here\n- Third key point here",
      words: [
        { word: "First", start: 0, end: 0.4 },
        { word: "key", start: 0.4, end: 0.7 },
        { word: "point.", start: 0.7, end: 1.2 },
      ],
      audioDurationSeconds: 5,
      audioFilePath: "",
    },
    {
      title: "In Practice",
      accentColor: "#f59e0b",
      script: "1. First step here\n2. Second step here\n3. Third step here",
      words: [
        { word: "First", start: 0, end: 0.4 },
        { word: "step.", start: 0.4, end: 0.9 },
      ],
      audioDurationSeconds: 5,
      audioFilePath: "",
    },
    {
      title: "Challenge before the quiz",
      accentColor: "#a78bfa",
      script: "Think carefully about this question. How does this concept apply in real life?",
      words: [
        { word: "Think", start: 0, end: 0.4 },
        { word: "carefully.", start: 0.4, end: 0.9 },
      ],
      audioDurationSeconds: 5,
      audioFilePath: "",
    },
  ],
};

function calcDuration(data: VideoData): number {
  const slideDurations = data.slides.map(
    (s) => Math.ceil(s.audioDurationSeconds * 30) + TRANSITION_FRAMES
  );
  let total = 0;
  for (let i = 0; i < slideDurations.length; i++) {
    total += slideDurations[i] - TRANSITION_FRAMES;
  }
  total += TRANSITION_FRAMES;
  return total;
}

const MyComposition: React.FC<Record<string, unknown>> = (props) => {
  return <Root videoData={props as unknown as VideoData} />;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LessonRecap"
        component={MyComposition}
        durationInFrames={calcDuration(placeholderVideoData)}
        fps={30}
        width={1280}
        height={720}
        defaultProps={placeholderVideoData}
      />
    </>
  );
};

registerRoot(RemotionRoot);
