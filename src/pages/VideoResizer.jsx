import { useEffect, useMemo, useRef, useState } from "react";

import "./VideoResizer.css";

import ResultsPanel from "../components/ResultsPanel";

import {
  MAX_SPEED,
  MIN_SPEED,
  getOutputSize,
  isCancelled,
  processVideo,
  stopVideoProcessing,
} from "../utils/videoProcessor";
import {
  createZip,
  downloadBlob,
  downloadMany,
  downloadUrl,
  makeId,
} from "../utils/files";

// ffmpeg.wasm keeps the input and the output in browser memory.
// Much above this, tabs start crashing, especially on phones.
const MAX_FILE_SIZE = 300 * 1024 * 1024;
const MAX_FILE_LABEL = "300 MB";

const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|avi|webm|mkv|mpe?g|3gp|wmv|flv|ogv)$/i;

const ASPECT_RATIOS = [
  { id: "original", name: "Original", label: "Original", ratio: null, size: "Original video" },
  { id: "square", name: "Square", label: "1:1", ratio: 1, size: "1080 × 1080" },
  { id: "story", name: "Story", label: "9:16", ratio: 9 / 16, size: "1080 × 1920" },
  { id: "portrait", name: "Portrait", label: "4:5", ratio: 4 / 5, size: "1080 × 1350" },
  { id: "landscape", name: "Landscape", label: "16:9", ratio: 16 / 9, size: "1920 × 1080" },
  { id: "standard", name: "Standard", label: "4:3", ratio: 4 / 3, size: "1440 × 1080" },
];

const SPEEDS = [0.25, 0.5, 1, 2, 4];

const FEATURES = [
  {
    title: "Social Media Presets",
    text: "Ready frames for posts and stories. Choose 1:1, 4:5, 9:16, 16:9, or 4:3 and keep every video in the same shape.",
    icon: "star",
  },
  {
    title: "Scale the Frame",
    text: "Zoom inside the frame from 50% to 200%. The preview updates before you process anything.",
    icon: "scale",
  },
  {
    title: "Playback Speed",
    text: "Drag the bar or type any speed from 0.25× to 4×. The same speed is used for every video in the batch.",
    icon: "speed",
  },
  {
    title: "Portrait or Landscape",
    text: "Turn a vertical video into a wide frame, or a wide video into a story, with the aspect options.",
    icon: "play",
  },
  {
    title: "Format and Quality",
    text: "Save as MP4, WEBM, or MOV. Original quality is the default; High, Medium, or Low make smaller files.",
    icon: "refresh",
  },
  {
    title: "Complete Privacy",
    text: "Videos are prepared in your browser. They are not uploaded to a ResizePro server while you resize them.",
    icon: "shield",
  },
];

function FeatureIcon({ name }) {
  if (name === "star") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5 14.2 9l5.8.4-4.5 3.7 1.5 5.6L12 15.8 6.9 18.7 8.4 13 4 9.4 9.8 9 12 3.5Z" />
      </svg>
    );
  }

  if (name === "scale") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 8H4v4" />
        <path d="M16 16h4v-4" />
        <path d="M4 8l6 6" />
        <path d="M20 16l-6-6" />
      </svg>
    );
  }

  if (name === "speed") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h4l2-4 3 8 2-4h3" />
      </svg>
    );
  }

  if (name === "play") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M10 9.5v5l4.5-2.5L10 9.5Z" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 12a8 8 0 1 1-2.2-5.5" />
        <path d="M20 4v5h-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 19 6.5v5.2c0 4.2-2.8 7.2-7 8.8-4.2-1.6-7-4.6-7-8.8V6.5L12 3.5Z" />
      <path d="m8.8 12 2.1 2.1 4.3-4.4" />
    </svg>
  );
}

function UiIcon({ name }) {
  if (name === "remove") {
    return (
      <svg className="ui-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 5l10 10" />
        <path d="M15 5 5 15" />
      </svg>
    );
  }

  return (
    <svg className="ui-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.25v9.2" />
      <path d="m6.1 9.2 3.9 3.9 3.9-3.9" />
      <path d="M4.25 16.75h11.5" />
    </svg>
  );
}

function useMediaValue(query, matchValue, otherValue) {
  const [value, setValue] = useState(otherValue);

  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setValue(media.matches ? matchValue : otherValue);

    apply();
    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [query, matchValue, otherValue]);

  return value;
}

// Only the cards near the visible area are rendered, so 100+ videos stay fast.
function useVirtualRange(count, itemSize, gap) {
  const [node, setNode] = useState(null);
  const [range, setRange] = useState({ start: 0, end: 4 });

  useEffect(() => {
    if (!node) {
      return undefined;
    }

    let frame = 0;

    const measure = () => {
      const scroll = node.scrollLeft;
      const view = Math.max(node.clientWidth, itemSize);
      const stride = itemSize + gap;
      const start = Math.max(0, Math.floor(scroll / stride) - 2);
      const end = Math.min(count, Math.ceil((scroll + view) / stride) + 2);

      setRange((current) =>
        current.start === start && current.end === end ? current : { start, end }
      );
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    node.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [node, count, itemSize, gap]);

  return {
    setNode,
    start: Math.min(range.start, count),
    end: Math.min(count, Math.max(range.end, range.start + 1)),
    total: count === 0 ? 0 : count * itemSize + Math.max(0, count - 1) * gap,
  };
}

// Type any speed, e.g. 1.3. Applied when the value is valid.
function SpeedInput({ value, disabled, onCommit }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const number = Number(draft);

    if (draft !== "" && Number.isFinite(number) && number > 0) {
      onCommit(number);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <input
      className="speed-number"
      type="number"
      inputMode="decimal"
      min={MIN_SPEED}
      max={MAX_SPEED}
      step="0.05"
      value={draft}
      disabled={disabled}
      aria-label="Speed"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 MB";
  }

  const mb = bytes / (1024 * 1024);

  if (mb < 1) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${mb.toFixed(1)} MB`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00:00";
  }

  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function previewDuration(video, speed) {
  return formatDuration((Number(video.duration) || 0) / (Number(speed) || 1));
}

// Uses the same function as the encoder, so the label matches the file.
function outputSizeLabel(video, aspectRatio, quality) {
  if (video.status === "loading") {
    return "Reading video...";
  }

  const size = getOutputSize(video, aspectRatio, quality);

  if (size.known) {
    return `${size.width} × ${size.height}`;
  }

  return "Size unknown · keeps the source shape";
}

function createVideoObject(file) {
  return {
    id: makeId(),
    file,
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file),
    thumbnailUrl: "",
    duration: 0,
    width: 0,
    height: 0,
    status: "loading",
    progress: 0,
    outputUrl: "",
    outputName: "",
    outputSize: 0,
    outputMimeType: "",
    outputWidth: 0,
    outputHeight: 0,
    outputKey: "",
    error: "",
  };
}

function getPreviewRatio(aspectRatio, video) {
  const selected = ASPECT_RATIOS.find((item) => item.id === aspectRatio);

  if (selected?.ratio) {
    return selected.ratio;
  }

  if (video?.width > 0 && video?.height > 0) {
    return video.width / video.height;
  }

  return 16 / 9;
}

function fileTypeLabel(video) {
  const name = video.outputName || video.name || "";
  const match = name.match(/\.([a-z0-9]+)$/i);

  if (match) {
    return match[1].toUpperCase();
  }

  if ((video.outputMimeType || "").includes("webm")) {
    return "WEBM";
  }

  if ((video.outputMimeType || "").includes("quicktime")) {
    return "MOV";
  }

  return "MP4";
}

function revokeVideoUrls(video) {
  if (video?.url) {
    URL.revokeObjectURL(video.url);
  }

  if (video?.outputUrl) {
    URL.revokeObjectURL(video.outputUrl);
  }
}

function validateVideoFile(file) {
  if (!file) {
    return { valid: false, message: "Invalid video file." };
  }

  // Some systems give .mkv/.avi an empty or generic type, so check the name too.
  const genericType = !file.type || file.type === "application/octet-stream";
  const looksLikeVideo =
    file.type.startsWith("video/") ||
    (genericType && VIDEO_EXTENSIONS.test(file.name));

  if (!looksLikeVideo) {
    return { valid: false, message: `${file.name} is not a video file.` };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: `${file.name} is larger than ${MAX_FILE_LABEL}.`,
    };
  }

  return { valid: true, message: "" };
}

function loadVideoDetails(videoObject) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    let timer = 0;

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      window.clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const settle = (partial = {}) => {
      if (settled) {
        return;
      }

      settled = true;

      const width = partial.width ?? (video.videoWidth || 0);
      const height = partial.height ?? (video.videoHeight || 0);
      const duration = partial.duration ?? (Number(video.duration) || 0);
      let thumbnailUrl = "";

      if (width && height && video.readyState >= 2) {
        try {
          const canvas = document.createElement("canvas");
          const fit = Math.min(1, 720 / Math.max(width, height));
          canvas.width = Math.max(2, Math.round(width * fit));
          canvas.height = Math.max(2, Math.round(height * fit));
          const context = canvas.getContext("2d");

          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbnailUrl = canvas.toDataURL("image/jpeg", 0.85);
          }
        } catch (error) {
          console.warn("Thumbnail generation failed:", error);
        }
      }

      cleanup();
      resolve({
        width,
        height,
        duration: Number.isFinite(duration) ? duration : 0,
        thumbnailUrl,
      });
    };

    video.onloadedmetadata = () => {
      const duration = Number(video.duration) || 0;
      const seekTime = duration > 0.1 ? Math.min(0.15, duration) : 0;

      if (seekTime === 0) {
        settle();
        return;
      }

      try {
        video.currentTime = seekTime;
      } catch {
        settle();
      }
    };

    video.onseeked = () => settle();

    // AVI and HEVC files often cannot be read by the browser.
    // They can still be converted; ffmpeg keeps their original shape.
    video.onerror = () => settle({ width: 0, height: 0, duration: 0 });

    timer = window.setTimeout(() => settle(), 5000);
    video.src = videoObject.url;
  });
}

function VideoResizer() {
  const [videos, setVideos] = useState([]);
  const [aspectRatio, setAspectRatio] = useState("original");
  const [scale, setScale] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [outputFormat, setOutputFormat] = useState("MP4");
  const [quality, setQuality] = useState("Original");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [screen, setScreen] = useState("editor");
  const [selectedIds, setSelectedIds] = useState([]);
  const [zipping, setZipping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [resultsError, setResultsError] = useState("");

  const cardWidth = useMediaValue("(max-width: 600px)", 280, 304);
  const videoWindow = useVirtualRange(videos.length, cardWidth, 16);
  const fileInputRef = useRef(null);
  const videoRefs = useRef({});
  const videosRef = useRef([]);
  const jobVersionRef = useRef({});
  const abortRef = useRef(null);

  // Every output remembers the settings it was made with.
  // When the settings change, those videos are processed again.
  const settingsKey = useMemo(
    () =>
      JSON.stringify({ aspectRatio, scale, speed, muted, outputFormat, quality }),
    [aspectRatio, scale, speed, muted, outputFormat, quality]
  );

  const isCurrent = (video) =>
    video.status === "done" &&
    Boolean(video.outputUrl) &&
    video.outputKey === settingsKey;

  const currentCount = videos.filter(isCurrent).length;
  const staleCount = videos.filter(
    (video) => video.status === "done" && video.outputKey !== settingsKey
  ).length;
  const isReading = videos.some((video) => video.status === "loading");
  const allCurrent = videos.length > 0 && currentCount === videos.length;

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    const editorOpen = screen !== "results" && videos.length > 0;

    document.body.classList.toggle("hide-site-footer", editorOpen);
    document.body.classList.toggle("lock-video-editor", editorOpen);

    return () => {
      document.body.classList.remove("hide-site-footer");
      document.body.classList.remove("lock-video-editor");
    };
  }, [screen, videos.length]);

  useEffect(() => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.playbackRate = Number(speed);
        video.muted = Boolean(muted);
      }
    });
  }, [speed, muted]);

  // On phones the editor is long, so the "Process all" button sits far down
  // the page. Without this, the results page opened at that same scroll
  // position and looked like it had jumped to the bottom.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [screen]);

  // Warn before closing the tab in the middle of an export.
  useEffect(() => {
    if (!isProcessing) {
      return undefined;
    }

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isProcessing]);

  // Leaving the page stops ffmpeg and frees memory.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopVideoProcessing();
      videosRef.current.forEach(revokeVideoUrls);
    };
  }, []);

  const handleChooseVideos = () => {
    if (isProcessing || isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  const addVideos = async (fileList) => {
    if (isProcessing) {
      return;
    }

    if (isUploading) {
      setUploadMessage("Please wait until the current videos finish loading.");
      return;
    }

    const files = Array.from(fileList || []);

    if (!files.length) {
      return;
    }

    const validFiles = [];
    const rejected = [];

    files.forEach((file) => {
      const result = validateVideoFile(file);

      if (result.valid) {
        validFiles.push(file);
      } else {
        rejected.push(result.message);
      }
    });

    setUploadMessage(rejected.join(" "));

    if (!validFiles.length) {
      return;
    }

    const newVideos = validFiles.map(createVideoObject);
    const alreadyHasVideos = videosRef.current.length > 0;
    const prepared = [];

    setIsUploading(true);

    if (alreadyHasVideos) {
      setVideos((previous) => [...previous, ...newVideos]);
    }

    try {
      for (const videoObject of newVideos) {
        const details = await loadVideoDetails(videoObject);
        const nextVideo = { ...videoObject, ...details, status: "ready" };

        if (alreadyHasVideos) {
          setVideos((previous) =>
            previous.map((item) => (item.id === videoObject.id ? nextVideo : item))
          );
        } else {
          prepared.push(nextVideo);
        }
      }

      if (!alreadyHasVideos && prepared.length) {
        setVideos((previous) => [...previous, ...prepared]);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = async (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    input.value = "";
    await addVideos(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();

    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();

    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setIsDragging(false);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);

    if (!isProcessing) {
      await addVideos(event.dataTransfer.files);
    }
  };

  const removeVideo = (id) => {
    if (isProcessing) {
      return;
    }

    const video = videosRef.current.find((item) => item.id === id);

    if (!video) {
      return;
    }

    revokeVideoUrls(video);
    delete videoRefs.current[id];
    delete jobVersionRef.current[id];

    const next = videosRef.current.filter((item) => item.id !== id);
    videosRef.current = next;
    setVideos(next);
    setSelectedIds((previous) => previous.filter((item) => item !== id));

    if (activeVideoId === id) {
      setActiveVideoId(null);
      setPlayingVideoId(null);
    }

    // Removing the last result used to leave an empty results page
    // with no way to upload again.
    if (!next.length) {
      setScreen("editor");
      setProcessingMessage("");
    }
  };

  const clearVideos = () => {
    if (isProcessing || isUploading) {
      return;
    }

    videosRef.current.forEach(revokeVideoUrls);
    videosRef.current = [];
    videoRefs.current = {};
    jobVersionRef.current = {};
    setVideos([]);
    setActiveVideoId(null);
    setPlayingVideoId(null);
    setUploadMessage("");
    setSelectedIds([]);
    setProcessingMessage("");
    setResultsError("");
  };

  const playVideo = async (id, event) => {
    event?.stopPropagation();

    const video = videoRefs.current[id];

    if (!video) {
      return;
    }

    Object.entries(videoRefs.current).forEach(([videoId, element]) => {
      if (videoId !== String(id) && element && !element.paused) {
        element.pause();
      }
    });

    video.muted = Boolean(muted);
    video.playbackRate = Number(speed);

    if (video.ended) {
      video.currentTime = 0;
    }

    try {
      setActiveVideoId(id);
      await video.play();
      setPlayingVideoId(id);
    } catch (error) {
      console.error("Video play failed:", error);
      setPlayingVideoId(null);
      setUploadMessage(
        "This browser cannot preview that video, but it can still be converted."
      );
    }
  };

  const pausePlayback = () => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video && !video.paused) {
        video.pause();
      }
    });

    setPlayingVideoId(null);
    setActiveVideoId(null);
  };

  const handleScaleChange = (value) => {
    const number = Number(value);

    if (!isProcessing && Number.isFinite(number)) {
      setScale(Math.min(200, Math.max(50, number)));
    }
  };

  // Any speed between MIN_SPEED and MAX_SPEED, rounded to 2 decimals.
  const handleSpeedChange = (value) => {
    const number = Number(value);

    if (!isProcessing && Number.isFinite(number) && number > 0) {
      const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, number));
      setSpeed(Math.round(clamped * 100) / 100);
    }
  };

  /** @returns {"done" | "error" | "cancelled" | "skipped"} */
  const runVideoProcess = async (videoId, { onProgress, signal }) => {
    const video = videosRef.current.find((item) => item.id === videoId);

    if (!video) {
      return "skipped";
    }

    const version = (jobVersionRef.current[videoId] || 0) + 1;
    jobVersionRef.current[videoId] = version;
    const stillCurrent = () => jobVersionRef.current[videoId] === version;

    const key = settingsKey;
    const settings = {
      aspectRatio,
      scale: Number(scale),
      speed: Number(speed),
      muted: Boolean(muted),
      outputFormat,
      quality,
    };

    if (video.outputUrl) {
      URL.revokeObjectURL(video.outputUrl);
    }

    const updateVideo = (patch) => {
      setVideos((previous) => {
        const next = previous.map((item) =>
          item.id === videoId ? { ...item, ...patch } : item
        );
        videosRef.current = next;
        return next;
      });
    };

    updateVideo({
      status: "processing",
      progress: 0,
      outputUrl: "",
      outputName: "",
      outputSize: 0,
      outputMimeType: "",
      outputWidth: 0,
      outputHeight: 0,
      outputKey: "",
      error: "",
    });

    let lastProgress = 0;

    try {
      const result = await processVideo(
        video,
        settings,
        (progress) => {
          if (!stillCurrent()) {
            return;
          }

          const safe = Math.min(99, Math.max(lastProgress, Math.round(Number(progress) || 0)));

          if (safe === lastProgress) {
            return;
          }

          lastProgress = safe;
          updateVideo({ progress: safe });
          onProgress?.(safe);
        },
        signal
      );

      if (!stillCurrent()) {
        URL.revokeObjectURL(result.outputUrl);
        return "skipped";
      }

      updateVideo({
        status: "done",
        progress: 100,
        outputUrl: result.outputUrl,
        outputName: result.name,
        outputSize: result.size,
        outputMimeType: result.mimeType,
        outputWidth: result.width,
        outputHeight: result.height,
        outputKey: key,
        error: "",
      });

      onProgress?.(100);
      return "done";
    } catch (error) {
      if (!stillCurrent()) {
        return "skipped";
      }

      if (isCancelled(error)) {
        updateVideo({ status: "ready", progress: 0, error: "" });
        return "cancelled";
      }

      console.error(`Processing failed for ${video.name}:`, error);
      updateVideo({
        status: "error",
        progress: 0,
        error: error?.message || "Processing failed.",
      });
      onProgress?.(100);
      return "error";
    }
  };

  const selectFinished = () => {
    setSelectedIds(
      videosRef.current
        .filter((video) => video.status === "done" && video.outputUrl)
        .map((video) => video.id)
    );
  };

  const processAll = async () => {
    if (!videos.length || isProcessing || isReading || isUploading) {
      return;
    }

    pausePlayback();

    const queue = videosRef.current
      .filter((video) => video.status !== "loading")
      .filter(
        (video) => !(video.status === "done" && video.outputKey === settingsKey)
      )
      .map((video) => video.id);

    setScreen("results");
    setResultsError("");

    if (!queue.length) {
      setProcessingMessage("Every video is already processed with these settings.");
      selectFinished();
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setIsProcessing(true);
    setProcessingProgress(0);

    let successCount = 0;
    let cancelled = false;
    // Track finished ids here. videosRef may not have the last update yet,
    // which is why the last video used to stay unticked.
    const doneIds = [];

    try {
      for (let index = 0; index < queue.length; index += 1) {
        if (controller.signal.aborted) {
          cancelled = true;
          break;
        }

        const id = queue[index];
        const current = videosRef.current.find((video) => video.id === id);

        setProcessingMessage(
          `Processing ${index + 1} of ${queue.length}${current ? `: ${current.name}` : ""}`
        );

        const result = await runVideoProcess(id, {
          signal: controller.signal,
          onProgress: (value) => {
            const overall =
              ((index + Math.min(100, Number(value) || 0) / 100) / queue.length) * 100;
            setProcessingProgress(Math.round(overall));
          },
        });

        if (result === "done") {
          successCount += 1;
          doneIds.push(id);
        }

        if (result === "cancelled") {
          cancelled = true;
          break;
        }
      }

      setProcessingProgress(100);
      setProcessingMessage(
        cancelled
          ? `Cancelled. ${successCount} of ${queue.length} videos were processed.`
          : `${successCount} of ${queue.length} videos processed.`
      );

      const alreadyDone = videosRef.current
        .filter((video) => video.status === "done" && video.outputUrl)
        .map((video) => video.id);
      setSelectedIds([...new Set([...alreadyDone, ...doneIds])]);
    } finally {
      abortRef.current = null;
      setIsProcessing(false);
    }
  };

  const cancelProcessing = () => {
    abortRef.current?.abort();
  };

  const handleDownload = (video) => {
    if (video?.outputUrl) {
      downloadUrl(
        video.outputUrl,
        video.outputName ||
          `${video.name.replace(/\.[^/.]+$/, "")}_resized.${outputFormat.toLowerCase()}`
      );
    }
  };

  const readyVideos = videos.filter(
    (video) => video.status === "done" && video.outputUrl
  );
  const selectedVideos = readyVideos.filter((video) => selectedIds.includes(video.id));
  const allReadySelected =
    readyVideos.length > 0 && readyVideos.every((video) => selectedIds.includes(video.id));

  const resultItems = videos.map((video) => {
    const ready = video.status === "done" && Boolean(video.outputUrl);
    let state = isProcessing ? "waiting" : "idle";

    if (video.status === "processing") {
      state = "processing";
    } else if (video.status === "error") {
      state = "error";
    } else if (ready) {
      state = video.outputKey === settingsKey ? "done" : "stale";
    }

    return {
      id: video.id,
      name: video.outputName || video.name,
      thumb: video.thumbnailUrl,
      bytes: ready ? video.outputSize : 0,
      type: fileTypeLabel(video),
      state,
      progress: video.progress,
      error: video.error,
      ready,
    };
  });

  const toggleSelected = (id) => {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allReadySelected ? [] : readyVideos.map((video) => video.id));
  };

  const downloadZip = async (list, zipName) => {
    if (!list.length || zipping) {
      return;
    }

    setZipping(true);
    setResultsError("");

    try {
      const files = [];

      for (const video of list) {
        const response = await fetch(video.outputUrl);
        files.push({
          name: video.outputName || `${video.name.replace(/\.[^/.]+$/, "")}_resized.mp4`,
          blob: await response.blob(),
        });
      }

      downloadBlob(await createZip(files), zipName);
    } catch (error) {
      console.error("ZIP download failed:", error);
      setResultsError(error?.message || "Could not create the ZIP file.");
    } finally {
      setZipping(false);
    }
  };

  const downloadSeparately = (list) => {
    downloadMany(list.map((video) => ({ url: video.outputUrl, name: video.outputName })));
  };

  const startNewBatch = () => {
    clearVideos();
    setScreen("editor");
  };

  const scalePercent = ((scale - 50) / 150) * 100;
  const speedPercent = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;

  const statusLabel = isProcessing
    ? processingMessage || "Processing..."
    : isReading || isUploading
      ? "Reading videos..."
      : allCurrent
        ? "All videos ready"
        : staleCount > 0
          ? "Settings changed. Process again to apply them."
          : "Ready to process";

  return (
    <div className="video-page">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mkv,.avi,.mov"
        multiple
        hidden
        onChange={handleFileInput}
      />

      <main className="video-resizer-page">
        {videos.length === 0 && (
          <section className="video-page-header">
            <div className="video-header-content">
              <span className="video-header-label">VIDEO TOOL</span>

              <h1>
                Resize your <span>video</span>
              </h1>

              <p>Resize, scale, change speed, mute audio, and optimize your videos.</p>
            </div>
          </section>
        )}

        {videos.length === 0 && (
          <section className="video-upload-section">
            <div
              className={`video-drop-zone ${isDragging ? "dragging" : ""} ${
                isUploading ? "uploading" : ""
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleChooseVideos}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleChooseVideos();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Choose videos to resize"
              aria-busy={isUploading}
            >
              <div className="video-upload-icon" aria-hidden="true">
                ↑
              </div>

              <h2>{isUploading ? "Reading videos..." : "Drag & Drop your videos"}</h2>

              <p>
                {isUploading ? (
                  "Your files stay on this device"
                ) : (
                  <>
                    or <span className="browse-text">browse your files</span>
                  </>
                )}
              </p>

              {isUploading ? (
                <div className="upload-progress-track" aria-hidden="true">
                  <div className="upload-progress-fill" />
                </div>
              ) : (
                // Not a nested <button>: the whole drop zone is already the button.
                <span className="choose-video-button" aria-hidden="true">
                  Choose Videos
                </span>
              )}

              <div className="upload-formats">
                <span>MP4 • MOV • AVI • WEBM</span>
                <span>Maximum {MAX_FILE_LABEL} per video</span>
              </div>
            </div>

            {uploadMessage && (
              <p className="upload-message" role="alert">
                {uploadMessage}
              </p>
            )}
          </section>
        )}

        {videos.length === 0 && (
          <section className="video-feature-section">
            <div className="video-feature-grid">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="video-feature-card">
                  <div className="video-feature-icon">
                    <FeatureIcon name={feature.icon} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {screen !== "results" && videos.length > 0 && (
          <section className="video-editor-section">
            <div className="video-editor-toolbar">
              <div className="toolbar-left">
                <span className="video-count">
                  {videos.length} {videos.length === 1 ? "VIDEO" : "VIDEOS"}
                </span>

                <button
                  type="button"
                  className="toolbar-add-button"
                  disabled={isProcessing || isUploading}
                  onClick={handleChooseVideos}
                >
                  <span className="plus-icon">+</span>
                  Add Videos
                </button>

                <button
                  type="button"
                  className="toolbar-clear-button"
                  disabled={isProcessing || isUploading}
                  onClick={clearVideos}
                >
                  Clear
                </button>
              </div>

              <div className="processing-status" role="status">
                <span
                  className={`status-dot ${
                    isProcessing ? "processing" : allCurrent ? "complete" : ""
                  }`}
                />
                {statusLabel}
              </div>
            </div>

            {uploadMessage && (
              <p className="upload-message toolbar-message" role="alert">
                {uploadMessage}
              </p>
            )}

            {isUploading && (
              <div className="upload-banner" role="status">
                <span className="upload-banner-spin" />
                <strong>Reading your videos</strong>
                <div className="upload-progress-track">
                  <div className="upload-progress-fill" />
                </div>
              </div>
            )}

            <div className="editor-layout">
              <aside className="video-settings">
                <div className="settings-heading">
                  <h2>Resize Settings</h2>
                  <p>Settings apply to all videos</p>
                </div>

                <div className="settings-scroll">
                  <div className="setting-group">
                    <div className="setting-title-row">
                      <div>
                        <h3>Aspect Ratio</h3>
                        <p>Choose video frame</p>
                      </div>
                    </div>

                    <div className="aspect-grid">
                      {ASPECT_RATIOS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={isProcessing}
                          aria-pressed={aspectRatio === item.id}
                          className={`aspect-option ${
                            aspectRatio === item.id ? "active" : ""
                          }`}
                          onClick={() => setAspectRatio(item.id)}
                        >
                          <div className={`aspect-shape ${item.id}`}>{item.label}</div>
                          <strong>{item.name}</strong>
                          <small>{item.size}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="setting-group">
                    <div className="setting-title-row">
                      <div>
                        <h3>Scale</h3>
                        <p>Zoom video inside frame</p>
                      </div>

                      <strong className="yellow-value">{scale}%</strong>
                    </div>

                    <div className="slider-row">
                      <button
                        type="button"
                        className="small-control"
                        disabled={isProcessing || scale <= 50}
                        aria-label="Zoom out"
                        onClick={() => handleScaleChange(scale - 10)}
                      >
                        −
                      </button>

                      <input
                        type="range"
                        min="50"
                        max="200"
                        step="5"
                        value={scale}
                        disabled={isProcessing}
                        aria-label="Scale"
                        onChange={(event) => handleScaleChange(event.target.value)}
                        className="yellow-slider"
                        style={{ "--slider-fill": `${scalePercent}%` }}
                      />

                      <button
                        type="button"
                        className="small-control"
                        disabled={isProcessing || scale >= 200}
                        aria-label="Zoom in"
                        onClick={() => handleScaleChange(scale + 10)}
                      >
                        +
                      </button>
                    </div>

                    <div className="slider-labels">
                      <span>50%</span>
                      <span>125%</span>
                      <span>200%</span>
                    </div>
                  </div>

                  <div className="setting-group">
                    <div className="setting-title-row">
                      <div>
                        <h3>Speed</h3>
                        <p>Change video speed</p>
                      </div>

                      <strong className="yellow-value">{speed}×</strong>
                    </div>

                    <div className="speed-buttons">
                      {SPEEDS.map((speedValue) => (
                        <button
                          key={speedValue}
                          type="button"
                          disabled={isProcessing}
                          aria-pressed={speed === speedValue}
                          className={speed === speedValue ? "active" : ""}
                          onClick={() => handleSpeedChange(speedValue)}
                        >
                          {speedValue}×
                        </button>
                      ))}
                    </div>

                    <div className="speed-slider-row">
                      <input
                        type="range"
                        min={MIN_SPEED}
                        max={MAX_SPEED}
                        step="0.05"
                        value={speed}
                        disabled={isProcessing}
                        aria-label="Speed"
                        onChange={(event) => handleSpeedChange(event.target.value)}
                        className="yellow-slider"
                        style={{ "--slider-fill": `${speedPercent}%` }}
                      />

                      <SpeedInput
                        value={speed}
                        disabled={isProcessing}
                        onCommit={handleSpeedChange}
                      />
                      <span>×</span>
                    </div>

                    <div className="slider-labels">
                      <span>{MIN_SPEED}×</span>
                      <span>1×</span>
                      <span>{MAX_SPEED}×</span>
                    </div>
                  </div>

                  <div className="setting-group">
                    <div className="setting-title-row">
                      <div>
                        <h3>Audio</h3>
                        <p>Control video sound</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessing}
                      aria-pressed={muted}
                      className={`mute-button ${muted ? "active" : ""}`}
                      onClick={() => setMuted((value) => !value)}
                    >
                      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
                      {muted ? "Audio Muted" : "Mute Audio"}
                    </button>
                  </div>

                  <div className="setting-group output-group">
                    <h3>Output</h3>

                    <div className="output-grid">
                      <label>
                        <span>Format</span>
                        <select
                          value={outputFormat}
                          disabled={isProcessing}
                          onChange={(event) => setOutputFormat(event.target.value)}
                        >
                          <option value="MP4">MP4</option>
                          <option value="WEBM">WEBM</option>
                          <option value="MOV">MOV</option>
                        </select>
                      </label>

                      <label>
                        <span>Quality</span>
                        <select
                          value={quality}
                          disabled={isProcessing}
                          onChange={(event) => setQuality(event.target.value)}
                        >
                          <option value="Original">Original</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </label>
                    </div>

                    <p className="export-summary">
                      Frame rate stays the same as the source. WEBM is slower to
                      create than MP4.
                    </p>
                  </div>
                </div>

                <div className="settings-actions">
                  <button
                    type="button"
                    className="export-button"
                    disabled={isProcessing || isReading || isUploading}
                    onClick={processAll}
                  >
                    {isProcessing ? (
                      "Processing..."
                    ) : isReading || isUploading ? (
                      "Reading videos..."
                    ) : (
                      <>
                        {allCurrent ? "View results" : "Process all"}
                        <svg className="export-arrow" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M3.5 10h12" />
                          <path d="M11 5.5 15.5 10 11 14.5" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </aside>

              <div
                className={`video-workspace ${isDragging ? "is-dropping" : ""}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="video-set-header">
                  <div>
                    <h2>Your Videos</h2>
                    <p>Scroll horizontally to view all uploaded videos</p>
                  </div>

                  <span className="files-badge">
                    {videos.length} {videos.length === 1 ? "file" : "files"}
                  </span>
                </div>

                <div className="horizontal-video-area" ref={videoWindow.setNode}>
                  <div
                    className="horizontal-video-track is-virtual"
                    style={{ width: videoWindow.total + 266 }}
                  >
                    {videos.slice(videoWindow.start, videoWindow.end).map((video, index) => {
                      const itemIndex = videoWindow.start + index;
                      const previewRatio = getPreviewRatio(aspectRatio, video);
                      const isActive = activeVideoId === video.id;
                      const isPlaying = playingVideoId === video.id;
                      const current = isCurrent(video);
                      const stale = video.status === "done" && !current;

                      return (
                        <article
                          key={video.id}
                          className={`video-list-item ${current ? "processed" : ""} ${
                            video.status === "loading" ? "is-uploading" : ""
                          }`}
                          style={{ left: itemIndex * (cardWidth + 16), width: cardWidth }}
                        >
                          <div className="video-card-preview-stage">
                            <div
                              className="video-preview-frame"
                              style={{ "--preview-ratio": previewRatio }}
                            >
                              <div
                                className="video-preview-media"
                                style={{ transform: `scale(${scale / 100})` }}
                              >
                                {video.thumbnailUrl && !isActive && (
                                  <img
                                    src={video.thumbnailUrl}
                                    className="video-card-thumbnail"
                                    alt={video.name}
                                  />
                                )}

                                {/* No native controls: they were clipped or tiny
                                    inside the scaled frame. Click the video to pause. */}
                                <video
                                  ref={(element) => {
                                    if (element) {
                                      videoRefs.current[video.id] = element;
                                      element.playbackRate = Number(speed);
                                      element.muted = Boolean(muted);
                                    } else {
                                      delete videoRefs.current[video.id];
                                    }
                                  }}
                                  src={video.url}
                                  className={`video-card-player ${isActive ? "visible" : ""}`}
                                  preload="metadata"
                                  playsInline
                                  muted={muted}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    event.currentTarget.pause();
                                  }}
                                  onPlay={() => setPlayingVideoId(video.id)}
                                  onPause={() =>
                                    setPlayingVideoId((id) => (id === video.id ? null : id))
                                  }
                                  onEnded={() => {
                                    setPlayingVideoId((id) => (id === video.id ? null : id));
                                    setActiveVideoId((id) => (id === video.id ? null : id));
                                  }}
                                />
                              </div>

                              {!isPlaying && (
                                <div className="video-card-play-layer">
                                  <button
                                    type="button"
                                    className="card-play-button"
                                    onClick={(event) => playVideo(video.id, event)}
                                    aria-label={`Play ${video.name}`}
                                  >
                                    ▶
                                  </button>
                                </div>
                              )}

                              {!video.thumbnailUrl && !isActive && (
                                <div className="video-preview-fallback">
                                  <span>▶</span>
                                  <small>
                                    {video.status === "loading"
                                      ? "Reading video..."
                                      : "No preview available"}
                                  </small>
                                </div>
                              )}

                              <span className="card-duration">
                                {previewDuration(video, speed)}
                              </span>

                              {current && <span className="video-done-badge">✓ Ready</span>}

                              {stale && (
                                <span className="video-stale-badge">Settings changed</span>
                              )}

                              {video.status === "error" && (
                                <span className="video-error-badge">Error</span>
                              )}
                            </div>
                          </div>

                          <div className="video-card-details">
                            <div className="video-card-name" title={video.name}>
                              {video.name}
                            </div>

                            <div className="video-meta">
                              {outputSizeLabel(video, aspectRatio, quality)}
                            </div>

                            {video.status === "processing" && (
                              <div className="card-progress">
                                <div className="card-progress-bar">
                                  <div
                                    className="card-progress-fill"
                                    style={{ width: `${video.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {current && (
                              <div className="video-output-info">
                                <span>{formatFileSize(video.outputSize)}</span>
                                {video.outputWidth > 0 && video.outputHeight > 0 && (
                                  <span>
                                    {video.outputWidth} × {video.outputHeight}
                                  </span>
                                )}
                              </div>
                            )}

                            {video.status === "error" && (
                              <div className="video-error-message">{video.error}</div>
                            )}
                          </div>

                          {current && (
                            <button
                              type="button"
                              className="video-download-small"
                              aria-label={`Download ${video.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDownload(video);
                              }}
                            >
                              <UiIcon name="download" />
                            </button>
                          )}

                          <button
                            type="button"
                            className="remove-video-button"
                            disabled={isProcessing}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeVideo(video.id);
                            }}
                            aria-label={`Remove ${video.name}`}
                          >
                            ×
                          </button>
                        </article>
                      );
                    })}

                    <button
                      type="button"
                      className={`add-video-card ${isDragging ? "is-dropping" : ""}`}
                      disabled={isProcessing || isUploading}
                      onClick={handleChooseVideos}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragOver}
                      onDrop={handleDrop}
                      style={{ left: videos.length * (cardWidth + 16) }}
                    >
                      <span>+</span>
                      <strong>{isDragging ? "Drop Videos" : "Add Videos"}</strong>
                      <small>MP4 • MOV • AVI • WEBM</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "results" && videos.length > 0 && (
          <ResultsPanel
            noun="video"
            items={resultItems}
            isProcessing={isProcessing}
            progress={processingProgress}
            statusMessage={processingMessage}
            summary={processingMessage}
            errorMessage={resultsError}
            selectedIds={selectedIds}
            onToggle={toggleSelected}
            onToggleAll={toggleSelectAll}
            onDownload={(id) => handleDownload(videos.find((video) => video.id === id))}
            onRemove={removeVideo}
            onCancel={cancelProcessing}
            onZipSelected={() => downloadZip(selectedVideos, "resizepro-selected.zip")}
            onZipAll={() => downloadZip(readyVideos, "resizepro-videos.zip")}
            onDownloadSeparately={() => downloadSeparately(selectedVideos.length ? selectedVideos : readyVideos)}
            zipping={zipping}
            onEdit={() => {
              setProcessingMessage("");
              setResultsError("");
              setScreen("editor");
            }}
            onNewBatch={startNewBatch}
          />
        )}
      </main>
    </div>
  );
}

export default VideoResizer;
