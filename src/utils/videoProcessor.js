import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const ASPECT_PRESETS = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1920, height: 1080 },
  standard: { width: 1440, height: 1080 },
};

const QUALITY_PRESETS = {
  High: { crf: "24", maxrate: "4000k", bufsize: "8000k" },
  Medium: { crf: "28", maxrate: "2200k", bufsize: "4400k" },
  Low: { crf: "33", maxrate: "1100k", bufsize: "2200k" },
};

const CORE_BASE =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

let coreUrlsPromise;

function even(value) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function outputSize(video, aspectRatio, quality) {
  const preset = ASPECT_PRESETS[aspectRatio];

  if (preset) {
    return preset;
  }

  const sourceWidth = video.width || 1280;
  const sourceHeight = video.height || 720;
  const maxEdge =
    quality === "Low" ? 854 : quality === "Medium" ? 1280 : 1920;
  const longest = Math.max(sourceWidth, sourceHeight);
  const fit = longest > maxEdge ? maxEdge / longest : 1;

  return {
    width: even(sourceWidth * fit),
    height: even(sourceHeight * fit),
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
    return {
      extension: "webm",
      mimeType: "video/webm",
      format: "webm",
    };
  }

  if (outputFormat === "MOV") {
    return {
      extension: "mov",
      mimeType: "video/quicktime",
      format: "mov",
    };
  }

  return {
    extension: "mp4",
    mimeType: "video/mp4",
    format: "mp4",
  };
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

function videoFilter(width, height, scalePercent, speed) {
  const zoom = Math.min(2, Math.max(0.5, Number(scalePercent) / 100 || 1));
  const steps = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
  ];

  if (zoom > 1.001) {
    steps.push(`scale=${even(width * zoom)}:${even(height * zoom)}`);
    steps.push(`crop=${width}:${height}`);
  } else if (zoom < 0.999) {
    steps.push(`scale=${even(width * zoom)}:${even(height * zoom)}`);
    steps.push(`pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`);
  }

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
    ]).then(([coreURL, wasmURL]) => ({ coreURL, wasmURL }));
  }

  return coreUrlsPromise;
}

export async function processVideo(videoItem, settings, onProgress) {
  const {
    aspectRatio = "original",
    scale = 100,
    speed = 1,
    muted = false,
    outputFormat = "MP4",
    quality = "High",
  } = settings || {};

  const playbackRate = Math.min(2, Math.max(0.25, Number(speed) || 1));
  const { width, height } = outputSize(videoItem, aspectRatio, quality);
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.High;
  const target = outputTarget(outputFormat);
  const ffmpeg = new FFmpeg();

  const report = (value) => {
    const percent = Math.min(99, Math.max(0, Number(value) || 0));
    onProgress?.(percent);
  };

  ffmpeg.on("progress", ({ progress }) => {
    if (typeof progress === "number" && Number.isFinite(progress)) {
      report(progress * 100);
    }
  });

  const inputName = `input-${crypto.randomUUID()}.${inputExtension(videoItem)}`;
  const outputName = `output-${crypto.randomUUID()}.${target.extension}`;

  try {
    const core = await getCoreUrls();

    await ffmpeg.load(core);

    await ffmpeg.writeFile(
      inputName,
      await fetchFile(videoItem.file || videoItem.url)
    );

    const args = [
      "-i",
      inputName,
      "-map",
      "0:v:0",
    ];

    if (!muted) {
      args.push("-map", "0:a:0?");
    }

    args.push(
      "-vf",
      videoFilter(width, height, scale, playbackRate),
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p"
    );

    if (target.format === "webm") {
      args.push(
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        preset.maxrate,
        "-crf",
        preset.crf,
        "-deadline",
        "realtime",
        "-cpu-used",
        "8",
        "-row-mt",
        "1"
      );
    } else {
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        preset.crf,
        "-maxrate",
        preset.maxrate,
        "-bufsize",
        preset.bufsize,
        "-profile:v",
        "high",
        "-level",
        "4.0",
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
        "96k"
      );
    }

    args.push("-f", target.format, outputName);

    const code = await ffmpeg.exec(args);

    if (code !== 0) {
      throw new Error("Video export failed.");
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const copy = new Uint8Array(bytes.byteLength);

    copy.set(bytes);

    const blob = new Blob([copy], { type: target.mimeType });
    const baseName = String(videoItem.name || "video").replace(
      /\.[^/.]+$/,
      ""
    );

    onProgress?.(100);

    return {
      outputUrl: URL.createObjectURL(blob),
      name: `${baseName}_resized.${target.extension}`,
      size: blob.size,
      mimeType: target.mimeType,
      width,
      height,
    };
  } catch (error) {
    const message = String(error?.message || error || "");

    if (
      message.includes("Failed to fetch") ||
      message.includes("ffmpeg") ||
      message.includes("Cannot find module")
    ) {
      throw new Error(
        "Video encoder failed to load. Run: npm install @ffmpeg/ffmpeg @ffmpeg/util"
      );
    }

    throw error;
  } finally {
    try {
      ffmpeg.terminate();
    } catch {
      // The worker may already be gone.
    }
  }
}