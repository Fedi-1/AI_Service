import React from "react";
import { WordTimestamp } from "../types";

interface WordByWordProps {
  words: WordTimestamp[];
  currentTimeSeconds: number;
  fontSize?: number;
  accentColor: string;
  maxWidthPx?: number;
}

const WordByWord: React.FC<WordByWordProps> = ({
  words,
  currentTimeSeconds,
  fontSize = 28,
  accentColor,
  maxWidthPx = 1100,
}) => {
  // Round to 2 decimal places so memo only recomputes on meaningful change
  const roundedTime = Math.round(currentTimeSeconds * 100) / 100;

  const wordStates = React.useMemo(() => {
    return words.map((w) => {
      if (roundedTime >= w.end) return "spoken" as const;
      if (roundedTime >= w.start) return "speaking" as const;
      return "upcoming" as const;
    });
  }, [words, roundedTime]);

  return (
    <div
      style={{
        maxWidth: maxWidthPx,
        lineHeight: 1.7,
        fontFamily: '"Playfair Display", serif',
        fontSize: fontSize,
      }}
    >
      {words.map((w, i) => {
        const state = wordStates[i];

        let color: string;
        let textShadow: string;
        let wordFontSize: number;
        let transition: string | undefined;

        if (state === "spoken") {
          color = "rgb(255,255,255)";
          textShadow = "none";
          wordFontSize = fontSize;
          transition = undefined;
        } else if (state === "speaking") {
          // Lighten the accent color for the speaking state
          color = accentColor.startsWith("#f9")
            ? "rgb(255,210,100)"
            : "rgb(180,190,255)";
          textShadow = `0 0 15px ${accentColor}, 0 0 30px ${accentColor}`;
          wordFontSize = fontSize * 1.05;
          transition = "all 0.08s ease";
        } else {
          color = "rgb(55,62,95)";
          textShadow = "none";
          wordFontSize = fontSize;
          transition = undefined;
        }

        return (
          <span
            key={i}
            style={{
              color,
              textShadow,
              fontSize: wordFontSize,
              transition,
              display: "inline",
            }}
          >
            {w.word}{" "}
          </span>
        );
      })}
    </div>
  );
};

export default WordByWord;
