export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SlideData {
  title: string;
  accentColor: string;
  script: string;
  words: WordTimestamp[];
  audioDurationSeconds: number;
  audioFilePath: string;
}

export interface VideoData {
  slides: [SlideData, SlideData, SlideData, SlideData];
  lessonTitle: string;
  language: "fr" | "en";
  flashcardCount: number;
  quizCount: number;
  estimatedReadTime: number;
}
