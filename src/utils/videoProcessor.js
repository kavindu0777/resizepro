import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

import { makeId } from "./files";

const ASPECT_PRESETS = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1920, height: 1080 },
  standard: { width: 1440, height: 1080 },
};

// "Original" is the default: visually lossless (CRF 18), no bitrate cap,
// no downscaling, high audio bitrate.
const QUALITY_PRESETS = {
  // vp8: settings for WEBM (VP8 constrained quality: lower crf = better).
  Original: { crf: "18", maxrate: "", bufsize: "", audio: "192k", vp8: { crf: "6", cap: "20M" } },
  High: { crf: "24", maxrate: "4000k", bufsize: "8000k", audio: "128k", vp8: { crf: "12", cap: "4000k" } },
  Medium: { crf: "28", maxrate: "2200k", bufsize: "4400k", audio: "96k", vp8: { crf: "20", cap: "2200k" } },
  Low: { crf: "33", maxrate: "1100k", bufsize: "2200k", audio: "96k", vp8: { crf: "30", cap: "1100k" } },
};

// Longest edge for the "Original" frame at each quality.
// Longest edge for the "Original" frame. Original quality never downscales.
const MAX_EDGE = { Original: Infinity, High: 1920, Medium: 1280, Low: 854 };

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;

const CORE_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

let coreUrlsPromise = null;
let ffmpegPromise = null;
let activeFFmpeg = null;

// Video needs even sizes. Round down so we never upscale by a pixel.
function even(value) {
  return Math.max(2, Math.floor(value / 2) * 2);
}

function clampZoom(scalePercent) {
  return Math.min(2, Math.max(0.5, Number(scalePercent) / 100 || 1));
}

export function isCancelled(error) {
  return error?.name === "AbortError";
}

function cancelledError() {
  const error = new Error("Processing was cancelled.");
  error.name = "AbortError";
  return error;
}

/**
 * The size the exported video will have.
 * Used by the processor and by the UI labels, so they always agree.
 * `known: false` means the browser could not read the source size
 * (common for AVI and HEVC .mov). In that case ffmpeg keeps the
 * source shape instead of forcing 1280×720.
 */
export function getOutputSize(video, aspectRatio, quality) {
  const preset = ASPECT_PRESETS[aspectRatio];
  const maxEdge = MAX_EDGE[quality] ?? MAX_EDGE.Original;

  if (preset) {
    return { ...preset, maxEdge, known: true };
  }

  const sourceWidth = Number(video?.width) || 0;
  const sourceHeight = Number(video?.height) || 0;

  if (!sourceWidth || !sourceHeight) {
    return { width: 0, height: 0, maxEdge, known: false };
  }

  const longest = Math.max(sourceWidth, sourceHeight);
  const fit = longest > maxEdge ? maxEdge / longest : 1;

  return {
    width: even(sourceWidth * fit),
    height: even(sourceHeight * fit),
    maxEdge,
    known: true,
  };
}

function inputExtension(videoItem) {
  const name = String(videoItem?.name || "");
  const match = name.match(/\.([a-z0-9]+)$/i);

  if (match) {
    return match[1].toLowerCase();
  }

  const type = videoItem?.file?.type || "";

  if (type.includes("webm")) {
    return "webm";
  }

  if (type.includes("quicktime")) {
    return "mov";
  }

  return "mp4";
}

function outputTarget(outputFormat) {
  if (outputFormat === "WEBM") {
    return { extension: "webm", mimeType: "video/webm", format: "webm" };
  }

  if (outputFormat === "MOV") {
    return { extension: "mov", mimeType: "video/quicktime", format: "mov" };
  }

  return { extension: "mp4", mimeType: "video/mp4", format: "mp4" };
}

function atempoChain(speed) {
  const filters = [];
  let remaining = speed;

  while (remaining < 0.5 - 0.001) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }

  while (remaining > 2 + 0.001) {
    filters.push("atempo=2.0");
    remaining /= 2;
  }

  filters.push(`atempo=${remaining.toFixed(4)}`);
  return filters.join(",");
}

function videoFilter(size, scalePercent, speed) {
  const zoom = clampZoom(scalePercent);
  const steps = [];

  if (size.known) {
    const { width, height } = size;

    // Fill the frame, then crop the overflow (same as the CSS preview).
    steps.push(
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`
    );

    if (zoom > 1.001) {
      steps.push(
        `scale=${even(width * zoom)}:${even(height * zoom)}`,
        `crop=${width}:${height}`
      );
    } else if (zoom < 0.999) {
      steps.push(
        `scale=${even(width * zoom)}:${even(height * zoom)}`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`
      );
    }
  } else {
    // Source size unknown: keep its shape and only cap the long edge.
    // Commas inside expressions must be escaped in a filtergraph.
    const max = size.maxEdge;

    if (Number.isFinite(max)) {
      steps.push(
        `scale=w=min(iw\\,${max}):h=min(ih\\,${max}):force_original_aspect_ratio=decrease`
      );
    }

    steps.push("scale=trunc(iw/2)*2:trunc(ih/2)*2");

    if (zoom > 1.001) {
      steps.push(
        `scale=trunc(iw*${zoom}/2)*2:trunc(ih*${zoom}/2)*2`,
        `crop=trunc(iw/${zoom}/2)*2:trunc(ih/${zoom}/2)*2`
      );
    } else if (zoom < 0.999) {
      steps.push(
        `scale=trunc(iw*${zoom}/2)*2:trunc(ih*${zoom}/2)*2`,
        `pad=trunc(iw/${zoom}/2)*2:trunc(ih/${zoom}/2)*2:(ow-iw)/2:(oh-ih)/2:black`
      );
    }
  }

  steps.push("setsar=1");

  if (Math.abs(speed - 1) > 0.001) {
    steps.push(`setpts=${(1 / speed).toFixed(5)}*PTS`);
  }

  return steps.join(",");
}

function getCoreUrls() {
  if (!coreUrlsPromise) {
    coreUrlsPromise = Promise.all([
      toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    ])
      .then(([coreURL, wasmURL]) => ({ coreURL, wasmURL }))
      .catch((error) => {
        // Do not cache a failed download, or every later try fails too.
        coreUrlsPromise = null;
        throw error;
      });
  }

  return coreUrlsPromise;
}

// Load ffmpeg once and reuse it for the whole batch.
function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const core = await getCoreUrls();
      await ffmpeg.load(core);
      activeFFmpeg = ffmpeg;
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }

  return ffmpegPromise;
}

function resetFFmpeg(instance = activeFFmpeg) {
  if (!instance) {
    return;
  }

  try {
    instance.terminate();
  } catch {
    // The worker may already be gone.
  }

  if (instance === activeFFmpeg) {
    activeFFmpeg = null;
    ffmpegPromise = null;
  }
}

/** Stop the running export (used when the user leaves the page). */
export function stopVideoProcessing() {
  resetFFmpeg();
}

async function safeDelete(ffmpeg, name) {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    // The file may not exist.
  }
}

/**
 * @param {object} videoItem  { file, url, name, width, height }
 * @param {object} settings   { aspectRatio, scale, speed, muted, outputFormat, quality }
 * @param {(percent:number)=>void} [onProgress]
 * @param {AbortSignal} [signal]
 */
export async function processVideo(videoItem, settings, onProgress, signal) {
  const {
    aspectRatio = "original",
    scale = 100,
    speed = 1,
    muted = false,
    outputFormat = "MP4",
    quality = "Original",
  } = settings || {};

  if (signal?.aborted) {
    throw cancelledError();
  }

  const playbackRate = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(speed) || 1));
  const size = getOutputSize(videoItem, aspectRatio, quality);
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.Original;
  const target = outputTarget(outputFormat);

  let ffmpeg;

  try {
    ffmpeg = await getFFmpeg();
  } catch (error) {
    console.error("FFmpeg load failed:", error);
    throw new Error(
      "The video encoder could not be downloaded. Check your internet connection and try again."
    );
  }

  if (signal?.aborted) {
    throw cancelledError();
  }

  const handleProgress = ({ progress }) => {
    if (typeof progress === "number" && Number.isFinite(progress)) {
      onProgress?.(Math.min(99, Math.max(0, progress * 100)));
    }
  };

  const handleAbort = () => resetFFmpeg(ffmpeg);

  // Keep the last lines of ffmpeg's log so failures can be diagnosed.
  const logTail = [];
  const handleLog = ({ message }) => {
    logTail.push(message);

    if (logTail.length > 40) {
      logTail.shift();
    }
  };

  ffmpeg.on("progress", handleProgress);
  ffmpeg.on("log", handleLog);
  signal?.addEventListener("abort", handleAbort, { once: true });

  const inputName = `input-${makeId()}.${inputExtension(videoItem)}`;
  const outputName = `output-${makeId()}.${target.extension}`;
  let failed = false;

  try {
    await ffmpeg.writeFile(
      inputName,
      await fetchFile(videoItem.file || videoItem.url)
    );

    const args = ["-i", inputName, "-map", "0:v:0"];

    if (!muted) {
      args.push("-map", "0:a:0?");
    }

    // The source frame rate is kept (the old "-r 30" halved 60 fps clips).
    args.push(
      "-vf",
      videoFilter(size, scale, playbackRate),
      "-pix_fmt",
      "yuv420p"
    );

    if (target.format === "webm") {
      // VP8, not VP9: libvpx-vp9 crashes ("memory access out of bounds")
      // in @ffmpeg/core 0.12.x for every setting we tested. VP8 works and
      // plays in all browsers that play WEBM.
      args.push(
        "-c:v",
        "libvpx",
        "-crf",
        preset.vp8.crf,
        "-b:v",
        preset.vp8.cap,
        "-qmin",
        "0",
        "-deadline",
        "good",
        "-cpu-used",
        "4",
        "-auto-alt-ref",
        "0"
      );
    } else {
      // No fixed "-level": x264 picks the right one for the frame size.
      args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", preset.crf);

      if (preset.maxrate) {
        args.push("-maxrate", preset.maxrate, "-bufsize", preset.bufsize);
      }

      args.push(
        "-profile:v",
        "high",
        "-movflags",
        "+faststart"
      );
    }

    if (muted) {
      args.push("-an");
    } else {
      if (Math.abs(playbackRate - 1) > 0.001) {
        args.push("-af", atempoChain(playbackRate));
      }

      args.push(
        "-c:a",
        target.format === "webm" ? "libopus" : "aac",
        "-b:a",
        preset.audio
      );
    }

    args.push("-f", target.format, outputName);

    const code = await ffmpeg.exec(args);

    if (signal?.aborted) {
      throw cancelledError();
    }

    if (code !== 0) {
      throw new Error(
        "This video could not be converted. Try a different output format or a smaller file."
      );
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const blob = new Blob([bytes], { type: target.mimeType });
    // Avoid names like clip_resized_resized.mp4 when re-resizing a file.
    const baseName = String(videoItem.name || "video")
      .replace(/\.[^/.]+$/, "")
      .replace(/(_resized)+$/i, "");

    onProgress?.(100);

    return {
      outputUrl: URL.createObjectURL(blob),
      name: `${baseName}_resized.${target.extension}`,
      size: blob.size,
      mimeType: target.mimeType,
      width: size.width,
      height: size.height,
    };
  } catch (error) {
    failed = true;

    if (signal?.aborted || isCancelled(error)) {
      throw cancelledError();
    }

    const message = String(error?.message || error || "");
    console.error("FFmpeg failed:", message, "\n" + logTail.join("\n"));

    if (/out of memory|memory access out of bounds|Cannot enlarge memory/i.test(message)) {
      throw new Error(
        "This video is too large to process in the browser. Try a shorter or smaller file."
      );
    }

    throw error instanceof Error
      ? error
      : new Error(message || "Video export failed.");
  } finally {
    signal?.removeEventListener("abort", handleAbort);

    try {
      ffmpeg.off("progress", handleProgress);
      ffmpeg.off("log", handleLog);
    } catch {
      // Already terminated.
    }

    if (failed) {
      // A failed run can leave ffmpeg in a bad state. Start fresh next time.
      resetFFmpeg(ffmpeg);
    } else {
      await safeDelete(ffmpeg, inputName);
      await safeDelete(ffmpeg, outputName);
    }
  }
}
