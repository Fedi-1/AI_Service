import React from "react";
import { SlideData } from "../types";
import { CinematicStage, GlassPanel, repairText } from "./CinematicElements";

interface Slide4Props {
  slide: SlideData;
  currentTimeSeconds: number;
  flashcardCount: number;
  quizCount: number;
  estimatedReadTime: number;
  language: string;
}

function extractQuestion(script: string): string {
  const clean = repairText(script).replace(/\s+/g, " ").trim();
  const questions = clean.match(/[^.!?]*\?/g);
  if (questions && questions.length > 0) {
    return questions[questions.length - 1].trim();
  }

  return clean;
}

const Slide4Challenge: React.FC<Slide4Props> = ({
  slide,
  currentTimeSeconds,
  language,
}) => {
  const question = extractQuestion(slide.script);
  const timer = Math.max(0, 30 - Math.floor(currentTimeSeconds * 2));
  const isEn = !language.startsWith("fr");
  const questionSize = question.length > 190 ? 27 : question.length > 130 ? 31 : 36;

  return (
    <CinematicStage
      slide={slide}
      currentTimeSeconds={currentTimeSeconds}
      sceneLabel={isEn ? "Quiz question" : "Question du quiz"}
      headerTitle=""
    >
      <GlassPanel x={150} y={148} width={900} height={360} delay={12} accentColor={slide.accentColor}>
        <div style={{ padding: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: slide.accentColor, fontSize: 13, fontWeight: 900 }}>QUESTION</div>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                border: `2px solid ${slide.accentColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f8fafc",
                fontSize: 24,
                fontWeight: 900,
                boxShadow: `0 0 30px ${slide.accentColor}33`,
              }}
            >
              {timer}
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              borderRadius: 8,
              border: `1px solid ${slide.accentColor}`,
              backgroundColor: `${slide.accentColor}14`,
              padding: "28px 32px",
              minHeight: 210,
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ color: "#f8fafc", fontSize: questionSize, lineHeight: 1.18, fontWeight: 900 }}>
              {question}
            </div>
          </div>
        </div>
      </GlassPanel>
    </CinematicStage>
  );
};

export default Slide4Challenge;
