export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleCue {
  text: string;
  start: number;
  end: number;
}

export type VideoLanguage = "fr" | "en" | "ar";

export interface SlideData {
  title: string;
  accentColor: string;
  script: string;
  words: WordTimestamp[];
  subtitles?: SubtitleCue[];
  showSubtitles?: boolean;
  audioDurationSeconds: number;
  audioFilePath: string;
}

export interface VideoData {
  slides: [SlideData, SlideData, SlideData, SlideData];
  lessonTitle: string;
  language: VideoLanguage;
  flashcardCount: number;
  quizCount: number;
  estimatedReadTime: number;
}
