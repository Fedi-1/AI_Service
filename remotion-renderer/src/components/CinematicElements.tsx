import React from "react";
import {
  Audio,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SlideData, SubtitleCue, VideoLanguage, WordTimestamp } from "../types";

export const WIDTH = 1280;
export const HEIGHT = 720;

export function repairText(text: string): string {
  return text
    .replace(/Ã€/g, "À")
    .replace(/Ã‚/g, "Â")
    .replace(/Ã‰/g, "É")
    .replace(/Ãˆ/g, "È")
    .replace(/ÃÊ/g, "Ê")
    .replace(/Ã /g, "à")
    .replace(/Ã¡/g, "á")
    .replace(/Ã¢/g, "â")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã«/g, "ë")
    .replace(/Ã®/g, "î")
    .replace(/Ã¯/g, "ï")
    .replace(/Ã´/g, "ô")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã¹/g, "ù")
    .replace(/Ã»/g, "û")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã§/g, "ç")
    .replace(/Â«/g, "«")
    .replace(/Â»/g, "»")
    .replace(/Â°/g, "°")
    .replace(/Â /g, " ")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€¦/g, "...");
}

export function clampText(text: string, max = 88): string {
  const clean = repairText(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

const ARABIC_TEXT_RE = /[\u0600-\u06ff]/;

export function normalizeVideoLanguage(language?: string): VideoLanguage {
  const value = (language || "en").trim().toLowerCase();
  if (value.startsWith("fr")) return "fr";
  if (value.startsWith("ar") || value.includes("arab") || ARABIC_TEXT_RE.test(value)) return "ar";
  return "en";
}

export function splitIntoPoints(script: string, wanted = 3): string[] {
  const cleanScript = repairText(script).replace(/\r/g, "").trim();
  const numberedMatches = Array.from(
    cleanScript.matchAll(/(?:^|\n|\s)(\d+)[.)]\s+([\s\S]*?)(?=(?:\n|\s)\d+[.)]\s+|$)/g)
  )
    .map((match) => match[2].trim())
    .filter(Boolean);
  if (numberedMatches.length >= 2) return numberedMatches.slice(0, wanted);

  const bulletParts = cleanScript
    .split(/\n\s*[-*]\s*|^[-*]\s*/m)
    .map((p) => p.trim())
    .filter(Boolean);
  if (bulletParts.length >= 2) return bulletParts.slice(0, wanted);

  const numbered = cleanScript
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
  if (numbered.length >= 2) return numbered.slice(0, wanted);

  const sentences = cleanScript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length >= wanted) return sentences.slice(0, wanted);

  const result = sentences.length ? sentences : [cleanScript];
  while (result.length < wanted) result.push("");
  return result.slice(0, wanted);
}

export function currentCaption(words: WordTimestamp[], seconds: number, maxWords = 11): string {
  if (!words.length) return "";
  const activeIndex = words.findIndex((w) => seconds >= w.start && seconds < w.end);
  const end = activeIndex >= 0 ? activeIndex + 1 : words.findIndex((w) => seconds < w.start);
  const safeEnd = end > 0 ? end : words.length;
  const start = Math.max(0, safeEnd - maxWords);
  return words
    .slice(start, safeEnd)
    .map((w) => w.word)
    .join(" ");
}

function cleanCaptionWord(word: string): string {
  return repairText(word).replace(/\s+/g, " ").trim();
}

function captionTextFromWords(words: WordTimestamp[]): string {
  return words.map((w) => cleanCaptionWord(w.word)).filter(Boolean).join(" ");
}

export function subtitleCuesFromWords(
  words: WordTimestamp[],
  language?: string
): SubtitleCue[] {
  const cleanedWords = words
    .map((word) => ({ ...word, word: cleanCaptionWord(word.word) }))
    .filter((word) => word.word && Number.isFinite(word.start) && Number.isFinite(word.end));

  if (!cleanedWords.length) return [];

  const lang = normalizeVideoLanguage(language);
  const maxWords = lang === "ar" ? 8 : 10;
  const maxChars = lang === "ar" ? 46 : 58;
  const minWordsBeforeSoftBreak = lang === "ar" ? 3 : 4;
  const rawCues: SubtitleCue[] = [];
  let cueWords: WordTimestamp[] = [];
  let cueStart = cleanedWords[0].start;

  for (let i = 0; i < cleanedWords.length; i++) {
    const word = cleanedWords[i];
    const next = cleanedWords[i + 1];

    if (!cueWords.length) cueStart = word.start;
    cueWords.push(word);

    const text = captionTextFromWords(cueWords);
    const enoughForSoftBreak = cueWords.length >= minWordsBeforeSoftBreak;
    const endsSentence = /[.!?؟…]$/.test(word.word);
    const endsPhrase = /[,;:،؛]$/.test(word.word);
    const nextGap = next ? Math.max(0, next.start - word.end) : 0;
    const shouldBreak =
      i === cleanedWords.length - 1 ||
      (endsSentence && enoughForSoftBreak) ||
      nextGap >= 0.45 ||
      cueWords.length >= maxWords ||
      text.length >= maxChars ||
      (endsPhrase && cueWords.length >= 5);

    if (shouldBreak) {
      rawCues.push({
        text,
        start: cueStart,
        end: Math.max(word.end, cueStart + 0.25),
      });
      cueWords = [];
    }
  }

  return rawCues.map((cue, index) => {
    const next = rawCues[index + 1];
    const minEnd = cue.start + 1.05;
    const paddedEnd = cue.end + 0.45;
    const nextLimit = next ? next.start - 0.04 : cue.end + 1.1;
    const end = next
      ? Math.max(cue.end, Math.min(nextLimit, Math.max(minEnd, paddedEnd)))
      : Math.max(minEnd, paddedEnd);

    return { ...cue, end };
  });
}

export function subtitleCuesFromScript(
  script: string,
  durationSeconds: number,
  language?: string
): SubtitleCue[] {
  const words = repairText(script)
    .replace(/\n+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return [];

  const duration = Math.max(1, durationSeconds);
  const syntheticWords = words.map((word, index) => {
    const start = (index / words.length) * duration;
    const end = ((index + 1) / words.length) * duration;
    return { word, start, end };
  });

  return subtitleCuesFromWords(syntheticWords, language);
}

export function currentSubtitle(cues: SubtitleCue[], seconds: number): string {
  const cue = cues.find((item) => seconds >= item.start && seconds < item.end);
  return cue?.text || "";
}

export function scriptSummaryLines(script: string, wanted = 5): string[] {
  const sentences = repairText(script)
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
  const lines = sentences.length ? sentences : splitIntoPoints(script, wanted);

  return lines.slice(0, wanted).map((line) => clampText(line, 78));
}

export function phraseLabel(text: string, fallback: string): string {
  const words = repairText(text)
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);
  return words.slice(0, 3).join(" ") || fallback;
}

export function extractKeywords(script: string, limit = 8): string[] {
  const stopwords = new Set([
    "avec",
    "dans",
    "donc",
    "elle",
    "elles",
    "leur",
    "leurs",
    "nous",
    "pour",
    "sont",
    "tels",
    "tres",
    "vous",
    "votre",
    "cette",
    "comme",
    "des",
    "les",
    "que",
    "qui",
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "into",
    "your",
  ]);
  const counts = new Map<string, { label: string; count: number }>();
  const words = repairText(script).match(/[\p{L}\p{N}'-]{4,}/gu) || [];

  for (const word of words) {
    const key = word
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (stopwords.has(key)) continue;
    const current = counts.get(key);
    counts.set(key, { label: current?.label || word, count: (current?.count || 0) + 1 });
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || b.label.length - a.label.length)
    .slice(0, limit)
    .map((item) => item.label);
}

export const CinematicStage: React.FC<{
  slide: SlideData;
  currentTimeSeconds: number;
  sceneLabel: string;
  headerTitle?: string;
  language?: string;
  children: React.ReactNode;
}> = ({ slide, currentTimeSeconds, sceneLabel, headerTitle, language, children }) => {
  const frame = useCurrentFrame();
  const videoLanguage = normalizeVideoLanguage(language);
  const subtitleCues = React.useMemo(() => {
    if (slide.subtitles?.length) return slide.subtitles;
    if (slide.words.length) return subtitleCuesFromWords(slide.words, videoLanguage);
    return subtitleCuesFromScript(slide.script, slide.audioDurationSeconds, videoLanguage);
  }, [slide.audioDurationSeconds, slide.script, slide.subtitles, slide.words, videoLanguage]);
  const totalFrames = Math.max(1, Math.ceil(slide.audioDurationSeconds * 30) + 20);
  const cameraX = interpolate(frame, [0, totalFrames], [0, -28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cameraScale = interpolate(frame, [0, totalFrames], [1.02, 1.08], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const vignetteOpacity = interpolate(frame, [0, 24], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#070b13",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <MovingGrid accentColor={slide.accentColor} totalFrames={totalFrames} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${cameraX}px) scale(${cameraScale})`,
          transformOrigin: "center",
        }}
      >
        {children}
      </div>
      <SceneHeader
        title={repairText(headerTitle ?? slide.title)}
        label={repairText(sceneLabel)}
        accentColor={slide.accentColor}
      />
      <NarrationCaption
        text={repairText(currentSubtitle(subtitleCues, currentTimeSeconds))}
        accentColor={slide.accentColor}
        language={videoLanguage}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          boxShadow: "inset 0 0 160px rgba(0,0,0,0.72)",
          opacity: vignetteOpacity,
        }}
      />
      {slide.audioFilePath ? <Audio src={slide.audioFilePath} /> : null}
    </div>
  );
};

export const MovingGrid: React.FC<{ accentColor: string; totalFrames: number }> = ({
  accentColor,
  totalFrames,
}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, totalFrames], [0, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scan = (frame * 4) % HEIGHT;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, #070b13 0%, #101827 46%, #07131a 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -80,
          opacity: 0.34,
          transform: `translate(${drift * -0.25}px, ${drift * 0.2}px)`,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.09) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(120deg, transparent 0%, ${accentColor}22 42%, transparent 72%)`,
          transform: `translateX(${interpolate(frame, [0, totalFrames], [-380, 220], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: scan,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          opacity: 0.35,
        }}
      />
    </div>
  );
};

export const SceneHeader: React.FC<{
  title: string;
  label: string;
  accentColor: string;
}> = ({ title, label, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const x = interpolate(enter, [0, 1], [-32, 0]);
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 58,
        top: 36,
        width: 520,
        transform: `translateX(${x}px)`,
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 12,
          lineHeight: 1,
          letterSpacing: 1.8,
          textTransform: "uppercase",
          color: accentColor,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      {title ? (
        <div
          style={{
            marginTop: 10,
            display: "inline-flex",
            maxWidth: 420,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            backgroundColor: "rgba(2,6,23,0.62)",
            color: "#cbd5e1",
            fontSize: 16,
            fontWeight: 760,
            lineHeight: 1.25,
            textShadow: "0 18px 48px rgba(0,0,0,0.55)",
          }}
        >
          {clampText(title, 52)}
        </div>
      ) : null}
    </div>
  );
};

export const NarrationCaption: React.FC<{ text: string; accentColor: string; language?: string }> = ({
  text,
  accentColor,
  language,
}) => {
  const frame = useCurrentFrame();
  const videoLanguage = normalizeVideoLanguage(language);
  const isArabic = videoLanguage === "ar" || ARABIC_TEXT_RE.test(text);
  const opacity = text
    ? interpolate(frame, [18, 30], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 190,
        right: 190,
        bottom: 42,
        minHeight: 78,
        padding: "12px 24px",
        borderRadius: 8,
        backgroundColor: "rgba(0, 0, 0, 0.68)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: `0 18px 46px rgba(0,0,0,0.52), 0 0 34px ${accentColor}18`,
        color: "#ffffff",
        fontFamily: isArabic
          ? "Tahoma, Arial, system-ui, sans-serif"
          : "Inter, Arial, system-ui, sans-serif",
        fontSize: isArabic ? 29 : 26,
        fontWeight: 760,
        lineHeight: 1.25,
        textAlign: "center",
        direction: isArabic ? "rtl" : "ltr",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        textShadow: "0 2px 6px rgba(0,0,0,0.95), 0 0 18px rgba(0,0,0,0.72)",
        whiteSpace: "normal",
      }}
    >
      {text}
    </div>
  );
};

export const GlassPanel: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  delay?: number;
  accentColor: string;
  children: React.ReactNode;
}> = ({ x, y, width, height, delay = 0, accentColor, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 18, stiffness: 140 },
  });
  const translateY = interpolate(enter, [0, 1], [34, 0]);
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.13)",
        backgroundColor: "rgba(15,23,42,0.74)",
        boxShadow: `0 24px 70px rgba(0,0,0,0.38), 0 0 44px ${accentColor}18`,
        overflow: "hidden",
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          opacity: 0.85,
        }}
      />
      {children}
    </div>
  );
};

export const MiniChart: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  accentColor: string;
  delay?: number;
}> = ({ x, y, width, height, accentColor, delay = 0 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const points = [
    [0, 0.78],
    [0.12, 0.55],
    [0.24, 0.62],
    [0.38, 0.35],
    [0.52, 0.42],
    [0.68, 0.22],
    [0.82, 0.3],
    [1, 0.16],
  ];
  const shown = points
    .map(([px, py], index) => {
      const p = Math.min(1, Math.max(0, progress * points.length - index));
      return `${x + px * width * p},${y + py * height}`;
    })
    .join(" ");

  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }}>
      <polyline
        points={shown}
        fill="none"
        stroke={accentColor}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.95}
      />
      {points.map(([px, py], index) => {
        const appear = interpolate(frame, [delay + index * 5, delay + index * 5 + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <circle
            key={index}
            cx={x + px * width}
            cy={y + py * height}
            r={4 + appear * 2}
            fill={accentColor}
            opacity={appear}
          />
        );
      })}
    </svg>
  );
};

export const DataStream: React.FC<{
  from: [number, number];
  to: [number, number];
  delay?: number;
  accentColor: string;
}> = ({ from, to, delay = 0, accentColor }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const packet = (offset: number) => {
    const t = (progress + offset) % 1;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  };

  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }}>
      <line
        x1={from[0]}
        y1={from[1]}
        x2={to[0]}
        y2={to[1]}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={2}
      />
      {[0, 0.34, 0.68].map((offset) => {
        const [cx, cy] = packet(offset);
        return <circle key={offset} cx={cx} cy={cy} r={5} fill={accentColor} opacity={0.82} />;
      })}
    </svg>
  );
};
