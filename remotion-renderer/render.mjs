/**
 * render.mjs — Remotion CLI renderer called by FastAPI via subprocess.
 *
 * Usage:
 *   node render.mjs --data /path/to/data.json --output /path/to/out.mp4
 *
 * Optimisations:
 *  - Calls ensureBrowser() so Chrome is downloaded once and reused.
 *  - Caches the webpack bundle in .remotion-bundle-cache/ so subsequent
 *    renders skip the ~30 s bundling step entirely.
 */

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Parse CLI arguments ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--data" && argv[i + 1]) args.data = argv[++i];
    else if (argv[i] === "--output" && argv[i + 1]) args.output = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.data || !args.output) {
  console.error("[render.mjs] ERROR: --data and --output arguments are required");
  process.exit(1);
}

// ── Load VideoData ─────────────────────────────────────────────────────────────
let videoData;
try {
  const raw = readFileSync(path.resolve(args.data), "utf-8");
  videoData = JSON.parse(raw);
} catch (err) {
  console.error("[render.mjs] ERROR: Failed to read/parse data file:", err.message);
  process.exit(1);
}

// ── Convert audio file paths → base64 data URLs ───────────────────────────────
// Remotion's <Audio> only accepts http(s):// or data: URLs, not file:// paths.
// We read each MP3 from disk here (in Node) and inline it as a data URL so
// the browser renderer can play it without any file-system access.
for (const slide of videoData.slides) {
  if (slide.audioFilePath && !slide.audioFilePath.startsWith("data:")) {
    try {
      const absPath = path.resolve(slide.audioFilePath);
      const b64 = readFileSync(absPath).toString("base64");
      slide.audioFilePath = `data:audio/mpeg;base64,${b64}`;
      console.log(`[render.mjs] Inlined audio for slide (${Math.round(b64.length * 0.75 / 1024)} KB)`);
    } catch (err) {
      console.warn(`[render.mjs] Warning: Could not read audio file ${slide.audioFilePath}: ${err.message}`);
      slide.audioFilePath = "";
    }
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────
const entryPoint = path.join(__dirname, "src", "index.tsx");

// ── Bundle cache ───────────────────────────────────────────────────────────────
const cacheDir = path.join(__dirname, ".remotion-bundle-cache");
const cacheMetaFile = path.join(cacheDir, "bundle-meta.json");

function collectSourceFiles(dir) {
  const entries = readdirSync(dir).sort();
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx|json)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function getBundleCacheKey() {
  const hash = createHash("md5");
  const sourceFiles = collectSourceFiles(path.join(__dirname, "src"));
  const dependencyFiles = ["package.json", "package-lock.json", "tsconfig.json"]
    .map((file) => path.join(__dirname, file))
    .filter((file) => existsSync(file));

  for (const file of [...sourceFiles, ...dependencyFiles]) {
    hash.update(path.relative(__dirname, file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }

  return hash.digest("hex");
}

function readBundleCache() {
  try {
    if (!existsSync(cacheMetaFile)) return null;
    const meta = JSON.parse(readFileSync(cacheMetaFile, "utf-8"));
    if (meta.key !== getBundleCacheKey()) return null;
    if (!existsSync(meta.serveUrl)) return null;
    return meta.serveUrl;
  } catch {
    return null;
  }
}

function writeBundleCache(serveUrl) {
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(
      cacheMetaFile,
      JSON.stringify({ key: getBundleCacheKey(), serveUrl }),
      "utf-8"
    );
  } catch (e) {
    console.warn("[render.mjs] Warning: Could not write bundle cache:", e.message);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Use the existing puppeteer-cached Chrome — no download needed
  const CHROME_PATH = "C:\\Users\\firas\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe";
  console.log(`[render.mjs] Using existing Chrome: ${CHROME_PATH}`);

  // 2. Bundle (use cache if available)
  let bundled = readBundleCache();
  if (bundled) {
    console.log("[render.mjs] Using cached bundle.");
  } else {
    console.log("[render.mjs] Bundling composition (first run — may take ~30 s)…");
    try {
      bundled = await bundle({
        entryPoint,
        webpackOverride: (config) => config,
      });
      writeBundleCache(bundled);
      console.log("[render.mjs] Bundle complete. Cached for future runs.");
    } catch (err) {
      console.error("[render.mjs] ERROR: Bundle failed:", err.message);
      process.exit(1);
    }
  }

  // 3. Select composition
  console.log("[render.mjs] Selecting composition…");
  let composition;
  try {
    composition = await selectComposition({
      serveUrl: bundled,
      id: "LessonRecap",
      inputProps: videoData,
      browserExecutable: CHROME_PATH,
    });
  } catch (err) {
    console.error("[render.mjs] ERROR: selectComposition failed:", err.message);
    process.exit(1);
  }

  // 4. Override duration from actual VideoData
  const TRANSITION_FRAMES = 20;
  const slideDurations = videoData.slides.map(
    (s) => Math.ceil(s.audioDurationSeconds * 30) + TRANSITION_FRAMES
  );
  let totalFrames = 0;
  for (let i = 0; i < slideDurations.length; i++) {
    totalFrames += slideDurations[i] - TRANSITION_FRAMES;
  }
  totalFrames += TRANSITION_FRAMES;
  composition.durationInFrames = totalFrames;

  console.log(`[render.mjs] Rendering ${totalFrames} frames → ${args.output}`);

  // 5. Render
  try {
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: path.resolve(args.output),
      inputProps: videoData,
      fps: 30,
      imageFormat: "jpeg",
      audioCodec: "aac",
      browserExecutable: CHROME_PATH,
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        process.stdout.write(`\r[render.mjs] Rendering: ${pct}%   `);
      },
    });
  } catch (err) {
    console.error("\n[render.mjs] ERROR: renderMedia failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }

  console.log(`\n[render.mjs] Done → ${args.output}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[render.mjs] Unhandled error:", err);
  process.exit(1);
});
