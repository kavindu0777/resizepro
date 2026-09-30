import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./VideoResizer.css";

import { processVideo } from "../utils/videoProcessor";

const ASPECT_RATIOS = [
  {
    id: "original",
    name: "Original",
    label: "Original",
    ratio: null,
    size: "Original video",
  },
  {
    id: "square",
    name: "Square",
    label: "1:1",
    ratio: 1,
    size: "1080 × 1080",
  },
  {
    id: "story",
    name: "Story",
    label: "9:16",
    ratio: 9 / 16,
    size: "1080 × 1920",
  },
  {
    id: "portrait",
    name: "Portrait",
    label: "4:5",
    ratio: 4 / 5,
    size: "1080 × 1350",
  },
  {
    id: "landscape",
    name: "Landscape",
    label: "16:9",
    ratio: 16 / 9,
    size: "1920 × 1080",
  },
  {
    id: "standard",
    name: "Standard",
    label: "4:3",
    ratio: 4 / 3,
    size: "1440 × 1080",
  },
];

const SPEEDS = [0.25, 0.5, 0.75, 1, 2];

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
    text: "Slow a clip down to 0.25× or speed it up to 2×. The same speed is used for every video in the batch.",
    icon: "speed",
  },
  {
    title: "Portrait or Landscape",
    text: "Turn a vertical video into a wide frame, or a wide video into a story, with the aspect options.",
    icon: "play",
  },
  {
    title: "Format and Quality",
    text: "Save as MP4, WEBM, or MOV. Choose High, Medium, or Low so the file stays a useful size.",
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

  if (name === "crop") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3v14h14" />
        <path d="M3 7h14v14" />
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
  if (name === "more") {
    return (
      <svg className="ui-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="4.5" r="1.25" />
        <circle cx="10" cy="10" r="1.25" />
        <circle cx="10" cy="15.5" r="1.25" />
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

function useElementWidth(query, narrow, wide) {
  const [width, setWidth] = useState(wide);

  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setWidth(media.matches ? narrow : wide);

    apply();
    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [query, narrow, wide]);

  return width;
}

function useVirtualRange(count, itemSize, gap, axis) {
  const [node, setNode] = useState(null);
  const [range, setRange] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (!node) {
      return undefined;
    }

    let frame = 0;

    const measure = () => {
      const scroll = axis === "x" ? node.scrollLeft : node.scrollTop;
      const view = Math.max(
        axis === "x" ? node.clientWidth : node.clientHeight,
        itemSize
      );
      const stride = itemSize + gap;
      const start = Math.max(0, Math.floor(scroll / stride) - 2);
      const end = Math.min(count, Math.ceil((scroll + view) / stride) + 2);

      setRange((current) =>
        current.start === start && current.end === end
          ? current
          : { start, end }
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
  }, [node, count, itemSize, gap, axis]);

  const stride = itemSize + gap;

  return {
    setNode,
    start: range.start,
    end: Math.max(range.end, Math.min(count, range.start + 1)),
    offset: range.start * stride,
    total: count === 0 ? 0 : count * itemSize + Math.max(0, count - 1) * gap,
  };
}

const MAX_FILE_SIZE = 500 * 1024 * 1024;

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

function previewSizeLabel(aspectRatio, video) {
  const selected = ASPECT_RATIOS.find((item) => item.id === aspectRatio);

  if (selected && selected.id !== "original") {
    return selected.size;
  }

  if (video.width && video.height) {
    return `${video.width} × ${video.height}`;
  }

  return formatFileSize(video.size);
}

function previewDuration(video, speed) {
  const rate = Number(speed) || 1;
  return formatDuration((Number(video.duration) || 0) / rate);
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

function createVideoObject(file) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    error: "",
  };
}

function getVideoRatio(video) {
  if (
    video?.width &&
    video?.height &&
    video.width > 0 &&
    video.height > 0
  ) {
    return video.width / video.height;
  }

  return 16 / 9;
}

function getPreviewRatio(aspectRatio, video) {
  const selected = ASPECT_RATIOS.find(
    (item) => item.id === aspectRatio
  );

  if (selected?.ratio) {
    return selected.ratio;
  }

  return getVideoRatio(video);
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

function uniqueFileName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  let next = `${base}-${index}${extension}`;

  while (used.has(next)) {
    index += 1;
    next = `${base}-${index}${extension}`;
  }

  used.add(next);
  return next;
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

async function createZip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const nameBytes = encoder.encode(file.name);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    parts.push(local, data);
    centralParts.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centralParts.reduce(
    (sum, part) => sum + part.length,
    0
  );
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...parts, ...centralParts, end], {
    type: "application/zip",
  });
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function revokeVideoUrls(video) {
  if (video?.url) {
    URL.revokeObjectURL(video.url);
  }

  if (video?.outputUrl) {
    URL.revokeObjectURL(video.outputUrl);
  }
}

function loadVideoDetails(videoObject) {
  return new Promise((resolve) => {
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let settled = false;

    const cleanup = () => {
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
      let thumbnailUrl = partial.thumbnailUrl || "";

      if (!thumbnailUrl && width && height) {
        try {
          const canvas = document.createElement("canvas");
          const fit = Math.min(1, 720 / width);

          canvas.width = Math.max(2, Math.round(width * fit));
          canvas.height = Math.max(2, Math.round(height * fit));

          const context = canvas.getContext("2d");

          if (context) {
            context.drawImage(
              video,
              0,
              0,
              canvas.width,
              canvas.height
            );

            thumbnailUrl = canvas.toDataURL("image/jpeg", 0.88);
          }
        } catch (error) {
          console.warn("Thumbnail generation failed:", error);
        }
      }

      cleanup();

      resolve({
        width,
        height,
        duration,
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

    video.onseeked = () => {
      settle();
    };

    video.onerror = () => {
      settle({
        width: 0,
        height: 0,
        duration: 0,
        thumbnailUrl: "",
      });
    };

    window.setTimeout(() => {
      settle();
    }, 5000);

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
  const [quality, setQuality] = useState("High");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [screen, setScreen] = useState("editor");
  const [selectedIds, setSelectedIds] = useState([]);
  const [zipping, setZipping] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const cardWidth = useElementWidth("(max-width: 600px)", 280, 304);
  const videoWindow = useVirtualRange(videos.length, cardWidth, 16, "x");
  const fileInputRef = useRef(null);
  const videoRefs = useRef({});
  const videosRef = useRef([]);
  const jobVersionRef = useRef({});

  const completedCount = videos.filter(
    (video) => video.status === "done"
  ).length;

  const isReading = videos.some(
    (video) => video.status === "loading"
  );

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
    if (!openMenuId) {
      return undefined;
    }

    const closeMenu = () => setOpenMenuId(null);

    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openMenuId]);

  useEffect(() => {
    Object.values(videoRefs.current).forEach((video) => {
      if (!video) {
        return;
      }

      video.playbackRate = Number(speed);
      video.muted = Boolean(muted);
    });
  }, [speed, muted]);

  useEffect(() => {
    return () => {
      videosRef.current.forEach(revokeVideoUrls);
    };
  }, []);

  const handleChooseVideos = () => {
    if (isProcessing || isUploading) {
      return;
    }

    fileInputRef.current?.click();
  };

  const validateVideoFile = (file) => {
    if (!file) {
      return {
        valid: false,
        message: "Invalid video file.",
      };
    }

    if (!file.type.startsWith("video/")) {
      return {
        valid: false,
        message: `${file.name} is not a video file.`,
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        message: `${file.name} is larger than 500 MB.`,
      };
    }

    return {
      valid: true,
      message: "",
    };
  };

  const addVideos = async (fileList) => {
    if (isProcessing || isUploading) {
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

    if (rejected.length) {
      setUploadMessage(rejected.join(" "));
    } else {
      setUploadMessage("");
    }

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
        let nextVideo = {
          ...videoObject,
          status: "ready",
        };

        try {
          const details = await loadVideoDetails(videoObject);

          nextVideo = {
            ...videoObject,
            ...details,
            status: "ready",
          };
        } catch (error) {
          console.error("Video preparation error:", error);
        }

        if (alreadyHasVideos) {
          setVideos((previous) =>
            previous.map((item) =>
              item.id === videoObject.id ? nextVideo : item
            )
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
    await addVideos(event.target.files);
    event.target.value = "";
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

    if (isProcessing) {
      return;
    }

    await addVideos(event.dataTransfer.files);
  };

  const removeVideo = (id) => {
    if (isProcessing) {
      return;
    }

    const video = videos.find((item) => item.id === id);

    if (!video) {
      return;
    }

    revokeVideoUrls(video);
    delete videoRefs.current[id];

    setVideos((previous) =>
      previous.filter((item) => item.id !== id)
    );

    if (playingVideoId === id) {
      setPlayingVideoId(null);
    }
  };

  const clearVideos = () => {
    if (isProcessing) {
      return;
    }

    videos.forEach(revokeVideoUrls);
    videoRefs.current = {};
    setVideos([]);
    setPlayingVideoId(null);
    setUploadMessage("");
  };

  const playVideo = async (id, event) => {
    event?.stopPropagation();

    const video = videoRefs.current[id];

    if (!video) {
      return;
    }

    Object.entries(videoRefs.current).forEach(
      ([videoId, element]) => {
        if (
          String(videoId) !== String(id) &&
          element &&
          !element.paused
        ) {
          element.pause();
        }
      }
    );

    video.muted = Boolean(muted);
    video.playbackRate = Number(speed);

    if (video.ended) {
      video.currentTime = 0;
    }

    try {
      await video.play();
      setPlayingVideoId(id);
    } catch (error) {
      console.error("Video play failed:", error);
      setPlayingVideoId(null);
    }
  };

  const handleScaleChange = (value) => {
    if (isProcessing) {
      return;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return;
    }

    setScale(Math.min(200, Math.max(50, number)));
  };

  const handleSpeedChange = (value) => {
    if (isProcessing) {
      return;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return;
    }

    setSpeed(Math.min(2, Math.max(0.25, number)));
  };

  const runVideoProcess = async (videoId, hooks = {}) => {
    const video = videosRef.current.find((item) => item.id === videoId);

    if (!video) {
      return false;
    }

    const version = (jobVersionRef.current[videoId] || 0) + 1;
    jobVersionRef.current[videoId] = version;

    const isCurrent = () => jobVersionRef.current[videoId] === version;

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

    setVideos((previous) => {
      if (!isCurrent()) {
        return previous;
      }

      return previous.map((item) =>
        item.id === videoId
          ? {
              ...item,
              status: "processing",
              progress: 0,
              outputUrl: "",
              outputName: "",
              outputSize: 0,
              outputMimeType: "",
              outputWidth: 0,
              outputHeight: 0,
              error: "",
            }
          : item
      );
    });

    let settled = false;
    let lastProgress = 0;

    const report = (value) => {
      if (!isCurrent()) {
        return;
      }

      if (hooks.onProgress) {
        hooks.onProgress(value);
        return;
      }

      setProcessingProgress(Math.round(value));
    };

    try {
      const result = await processVideo(
        video,
        settings,
        (progress) => {
          if (settled || !isCurrent()) {
            return;
          }

          const safeProgress = Math.min(
            99,
            Math.max(
              lastProgress,
              Math.round(Number(progress) || 0)
            )
          );

          if (safeProgress === lastProgress) {
            return;
          }

          lastProgress = safeProgress;

          setVideos((previous) => {
            if (!isCurrent()) {
              return previous;
            }

            return previous.map((item) => {
              if (item.id !== videoId || item.status === "done") {
                return item;
              }

              return {
                ...item,
                status: "processing",
                progress: safeProgress,
              };
            });
          });

          report(safeProgress);
        }
      );

      settled = true;

      if (!isCurrent()) {
        if (result?.outputUrl) {
          URL.revokeObjectURL(result.outputUrl);
        }

        return false;
      }

      setVideos((previous) => {
        const next = previous.map((item) =>
          item.id === videoId
            ? {
                ...item,
                status: "done",
                progress: 100,
                outputUrl: result.outputUrl,
                outputName: result.name,
                outputSize: result.size,
                outputMimeType: result.mimeType,
                outputWidth: result.width,
                outputHeight: result.height,
                error: "",
              }
            : item
        );

        videosRef.current = next;
        return next;
      });

      report(100);
      return true;
    } catch (error) {
      settled = true;
      console.error(`Processing failed for ${video.name}:`, error);

      if (!isCurrent()) {
        return false;
      }

      setVideos((previous) => {
        const next = previous.map((item) =>
          item.id === videoId
            ? {
                ...item,
                status: "error",
                progress: 0,
                error: error?.message || "Processing failed.",
              }
            : item
        );

        videosRef.current = next;
        return next;
      });

      report(100);
      return false;
    }
  };

  const pausePlayback = () => {
    Object.values(videoRefs.current).forEach((video) => {
      if (video && !video.paused) {
        video.pause();
      }
    });

    setPlayingVideoId(null);
  };

  const processOne = async (videoId) => {
    if (isProcessing || isReading) {
      return;
    }

    const video = videosRef.current.find((item) => item.id === videoId);

    if (!video || video.status === "loading") {
      return;
    }

    pausePlayback();
    setOpenMenuId(null);
    setScreen("results");
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingMessage(`Processing ${video.name}`);

    try {
      const success = await runVideoProcess(videoId, {
        onProgress: (value) => {
          setProcessingProgress(Math.round(value));
        },
      });

      setProcessingProgress(100);
      setProcessingMessage(
        success
          ? `${video.name} processed.`
          : `${video.name} failed.`
      );
      setSelectedIds(
        videosRef.current
          .filter((item) => item.status === "done" && item.outputUrl)
          .map((item) => item.id)
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const processAll = async () => {
    if (!videos.length || isProcessing || isReading) {
      return;
    }

    pausePlayback();

    const pending = videosRef.current.filter(
      (video) => video.status !== "loading" && video.status !== "done"
    );
    const queue = (
      pending.length
        ? pending
        : videosRef.current.filter((video) => video.status !== "loading")
    ).map((video) => video.id);

    if (!queue.length) {
      return;
    }

    setOpenMenuId(null);
    setScreen("results");
    setIsProcessing(true);
    setProcessingProgress(0);

    let successCount = 0;

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const id = queue[index];
        const current = videosRef.current.find((video) => video.id === id);

        setProcessingMessage(
          `Processing ${index + 1} of ${queue.length}${
            current ? `: ${current.name}` : ""
          }`
        );

        const success = await runVideoProcess(id, {
          onProgress: (value) => {
            const overall =
              ((index + Math.min(100, Number(value) || 0) / 100) /
                queue.length) *
              100;

            setProcessingProgress(Math.round(overall));
          },
        });

        if (success) {
          successCount += 1;
        }
      }

      setProcessingProgress(100);
      setProcessingMessage(
        `${successCount} of ${queue.length} videos processed.`
      );
      setSelectedIds(
        videosRef.current
          .filter((video) => video.status === "done" && video.outputUrl)
          .map((video) => video.id)
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (video) => {
    if (!video?.outputUrl) {
      return;
    }

    const link = document.createElement("a");

    link.href = video.outputUrl;
    link.download =
      video.outputName ||
      `${video.name.replace(/\.[^/.]+$/, "")}_resized.${outputFormat.toLowerCase()}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    const completed = videos.filter((video) => video.outputUrl);

    completed.forEach((video, index) => {
      window.setTimeout(() => {
        handleDownload(video);
      }, index * 500);
    });
  };

  const readyVideos = videos.filter(
    (video) => video.status === "done" && video.outputUrl
  );

  const selectedVideos = readyVideos.filter((video) =>
    selectedIds.includes(video.id)
  );

  const allReadySelected =
    readyVideos.length > 0 &&
    readyVideos.every((video) => selectedIds.includes(video.id));

  const toggleSelected = (id) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(
      allReadySelected ? [] : readyVideos.map((video) => video.id)
    );
  };

  const filesForZip = async (list) => {
    const used = new Set();
    const files = [];

    for (const video of list) {
      const response = await fetch(video.outputUrl);
      const blob = await response.blob();
      const name = uniqueFileName(
        video.outputName ||
          `${video.name.replace(/\.[^/.]+$/, "")}_resized.mp4`,
        used
      );

      files.push({ name, blob });
    }

    return files;
  };

  const downloadZip = async (list, zipName) => {
    if (!list.length || zipping) {
      return;
    }

    setZipping(true);
    setOpenMenuId(null);

    try {
      const zip = await createZip(await filesForZip(list));
      downloadBlob(zip, zipName);
    } catch (error) {
      console.error("ZIP download failed:", error);
      setUploadMessage("Could not create the ZIP file.");
    } finally {
      setZipping(false);
    }
  };

  const downloadSeparately = (list) => {
    list.forEach((video, index) => {
      window.setTimeout(() => {
        handleDownload(video);
      }, index * 400);
    });
  };

  const startNewBatch = () => {
    videos.forEach(revokeVideoUrls);
    videoRefs.current = {};
    setVideos([]);
    setPlayingVideoId(null);
    setUploadMessage("");
    setSelectedIds([]);
    setOpenMenuId(null);
    setProcessingMessage("");
    setScreen("editor");
  };

  const scalePercent = ((scale - 50) / 150) * 100;
  const speedPercent = ((speed - 0.25) / 1.75) * 100;

  const statusLabel = isProcessing
    ? processingMessage || "Processing..."
    : isReading
      ? "Reading videos..."
      : completedCount === videos.length && videos.length > 0
        ? "All videos ready"
        : "Ready to process";

  return (
    <div className="video-page">
      <main className="video-resizer-page">
        {videos.length === 0 && (
        <section className="video-page-header">
          <div className="video-header-content">
            <span className="video-header-label">
              VIDEO TOOL
            </span>

            <h1>
              Resize your <span>video.</span>
            </h1>

            <p>
              Resize, scale, change speed, mute audio, and optimize your videos.
            </p>
          </div>
        </section>
        )}

        {screen !== "results" && videos.length === 0 && (
          <section className="video-upload-section">
            <div
              className={`video-drop-zone ${
                isDragging ? "dragging" : ""
              } ${isUploading ? "uploading" : ""}`}
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
            >
              <div className="video-upload-icon">↑</div>

              <h2>
                {isUploading ? "Uploading videos..." : "Drag & Drop your videos"}
              </h2>

              <p>
                {isUploading ? (
                  "Reading your files"
                ) : (
                  <>
                    or <span className="browse-text">browse to upload</span>
                  </>
                )}
              </p>

              {isUploading ? (
                <div className="upload-progress-track" aria-hidden="true">
                  <div className="upload-progress-fill" />
                </div>
              ) : (
                <button
                  type="button"
                  className="choose-video-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleChooseVideos();
                  }}
                >
                  Choose Videos
                </button>
              )}

              <div className="upload-formats">
                <span>MP4 • MOV • AVI • WEBM</span>
                <span>Maximum 500 MB per video</span>
              </div>
            </div>

            {uploadMessage && (
              <p className="upload-message">{uploadMessage}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              hidden
              onChange={handleFileInput}
            />
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
                  {videos.length}{" "}
                  {videos.length === 1 ? "VIDEO" : "VIDEOS"}
                </span>

                <button
                  type="button"
                  className="toolbar-add-button"
                  disabled={isProcessing}
                  onClick={handleChooseVideos}
                >
                  <span className="plus-icon">+</span>
                  Add Videos
                </button>

                <button
                  type="button"
                  className="toolbar-clear-button"
                  disabled={isProcessing}
                  onClick={clearVideos}
                >
                  Clear
                </button>
              </div>

              <div className="processing-status">
                <span
                  className={`status-dot ${
                    isProcessing
                      ? "processing"
                      : completedCount === videos.length
                        ? "complete"
                        : ""
                  }`}
                />
                {statusLabel}
              </div>
            </div>

            {uploadMessage && (
              <p className="upload-message toolbar-message">
                {uploadMessage}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              hidden
              onChange={handleFileInput}
            />

            {isUploading && (
              <div className="upload-banner" role="status">
                <span className="upload-banner-spin" />
                <strong>Uploading your videos</strong>
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
                          className={`aspect-option ${
                            aspectRatio === item.id ? "active" : ""
                          }`}
                          onClick={() => setAspectRatio(item.id)}
                        >
                          <div className={`aspect-shape ${item.id}`}>
                            {item.label}
                          </div>

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

                      <strong className="yellow-value">
                        {scale}%
                      </strong>
                    </div>

                    <div className="slider-row">
                      <button
                        type="button"
                        className="small-control"
                        disabled={isProcessing}
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
                        onChange={(event) =>
                          handleScaleChange(event.target.value)
                        }
                        className="yellow-slider"
                        style={{
                          "--slider-fill": `${scalePercent}%`,
                        }}
                      />

                      <button
                        type="button"
                        className="small-control"
                        disabled={isProcessing}
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

                      <strong className="yellow-value">
                        {speed}×
                      </strong>
                    </div>

                    <div className="speed-buttons">
                      {SPEEDS.map((speedValue) => (
                        <button
                          key={speedValue}
                          type="button"
                          disabled={isProcessing}
                          className={
                            speed === speedValue ? "active" : ""
                          }
                          onClick={() => handleSpeedChange(speedValue)}
                        >
                          {speedValue}×
                        </button>
                      ))}
                    </div>

                    <div className="speed-slider-row">
                      <input
                        type="range"
                        min="0.25"
                        max="2"
                        step="0.25"
                        value={speed}
                        disabled={isProcessing}
                        aria-label="Speed"
                        onChange={(event) =>
                          handleSpeedChange(event.target.value)
                        }
                        className="yellow-slider"
                        style={{
                          "--slider-fill": `${speedPercent}%`,
                        }}
                      />

                      <div className="speed-number">{speed}</div>
                      <span>×</span>
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
                      className={`mute-button ${muted ? "active" : ""}`}
                      onClick={() => setMuted((value) => !value)}
                    >
                      <span>{muted ? "🔇" : "🔊"}</span>
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
                          onChange={(event) =>
                            setOutputFormat(event.target.value)
                          }
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
                          onChange={(event) =>
                            setQuality(event.target.value)
                          }
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="settings-actions">
                  <button
                    type="button"
                    className="export-button"
                    disabled={isProcessing || isReading}
                    onClick={processAll}
                  >
                    {isProcessing ? (
                      "Processing..."
                    ) : isReading ? (
                      "Reading videos..."
                    ) : (
                      <>
                        Process all
                        <svg
                          className="export-arrow"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                        >
                          <path d="M3.5 10h12" />
                          <path d="M11 5.5 15.5 10 11 14.5" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </aside>

              <div
                className={`video-workspace ${
                  isDragging ? "is-dropping" : ""
                }`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="video-set-header">
                  <div>
                    <h2>Your Videos</h2>
                    <p>
                      Scroll horizontally to view all uploaded videos
                    </p>
                  </div>

                  <span className="files-badge">
                    {videos.length}{" "}
                    {videos.length === 1 ? "file" : "files"}
                  </span>
                </div>

                <div
                  className="horizontal-video-area"
                  ref={videoWindow.setNode}
                >
                  <div
                    className="horizontal-video-track is-virtual"
                    style={{
                      width: videoWindow.total + 266,
                    }}
                  >
                    {videos.slice(videoWindow.start, videoWindow.end).map((video, index) => {
                      const itemIndex = videoWindow.start + index;
                      const previewRatio = getPreviewRatio(
                        aspectRatio,
                        video
                      );

                      return (
                        <article
                          key={video.id}
                          className={`video-list-item ${
                            video.status === "done" ? "processed" : ""
                          } ${
                            video.status === "loading" ? "is-uploading" : ""
                          }`}
                          style={{
                            left: itemIndex * (cardWidth + 16),
                            width: cardWidth,
                          }}
                        >
                          <div className="video-card-preview-stage">
                            <div
                              className="video-preview-frame"
                              style={{
                                "--preview-ratio": previewRatio,
                              }}
                            >
                              <div
                                className="video-preview-media"
                                style={{
                                  transform: `scale(${scale / 100})`,
                                }}
                              >
                                {video.thumbnailUrl &&
                                  playingVideoId !== video.id && (
                                    <img
                                      src={video.thumbnailUrl}
                                      className="video-card-thumbnail"
                                      alt={video.name}
                                    />
                                  )}

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
                                  className={`video-card-player ${
                                    playingVideoId === video.id
                                      ? "visible"
                                      : ""
                                  }`}
                                  preload="metadata"
                                  playsInline
                                  controls={playingVideoId === video.id}
                                  muted={muted}
                                  onPlay={() => setPlayingVideoId(video.id)}
                                  onEnded={() => {
                                    setPlayingVideoId((current) =>
                                      current === video.id ? null : current
                                    );
                                  }}
                                />
                              </div>

                              {playingVideoId !== video.id && (
                                <div className="video-card-play-layer">
                                  <button
                                    type="button"
                                    className="card-play-button"
                                    onClick={(event) =>
                                      playVideo(video.id, event)
                                    }
                                    aria-label="Play video"
                                  >
                                    ▶
                                  </button>
                                </div>
                              )}

                              {!video.thumbnailUrl &&
                                playingVideoId !== video.id && (
                                  <div className="video-preview-fallback">
                                    <span>▶</span>
                                    <small>
                                      {video.status === "loading"
                                        ? "Reading video..."
                                        : "Click to preview"}
                                    </small>
                                  </div>
                                )}

                              <span className="card-duration">
                                {previewDuration(video, speed)}
                              </span>

                              {video.status === "done" && (
                                <span className="video-done-badge">
                                  ✓ Ready
                                </span>
                              )}

                              {video.status === "error" && (
                                <span className="video-error-badge">
                                  Error
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="video-card-details">
                            <div
                              className="video-card-name"
                              title={video.name}
                            >
                              {video.name}
                            </div>

                            <div className="video-meta">
                              {previewSizeLabel(aspectRatio, video)}
                            </div>

                            {video.status === "processing" && (
                              <div className="card-progress">
                                <div className="card-progress-bar">
                                  <div
                                    className="card-progress-fill"
                                    style={{
                                      width: `${video.progress}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {video.status === "done" && (
                              <div className="video-output-info">
                                <span>
                                  {formatFileSize(video.outputSize)}
                                </span>

                                {video.outputWidth && video.outputHeight && (
                                  <span>
                                    {video.outputWidth} × {video.outputHeight}
                                  </span>
                                )}
                              </div>
                            )}

                            {video.status === "error" && (
                              <div className="video-error-message">
                                {video.error}
                              </div>
                            )}
                          </div>

                          {video.status === "done" && video.outputUrl && (
                            <button
                              type="button"
                              className="video-download-small"
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
                      className={`add-video-card ${
                        isDragging ? "is-dropping" : ""
                      }`}
                      disabled={isProcessing}
                      onClick={handleChooseVideos}
                      onDragOver={handleDragOver}
                      onDragEnter={handleDragOver}
                      onDrop={handleDrop}
                      style={{ left: videos.length * (cardWidth + 16) }}
                    >
                      <span>+</span>
                      <strong>
                        {isDragging ? "Drop Videos" : "Add Videos"}
                      </strong>
                      <small>MP4 • MOV • AVI • WEBM</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "results" && (
          <section className="results-section">
            <div className="results-toolbar">
              <button
                type="button"
                className="results-select-button"
                onClick={toggleSelectAll}
              >
                <span
                  className={`results-checkbox ${
                    allReadySelected ? "checked" : ""
                  }`}
                >
                  {allReadySelected ? "✓" : ""}
                </span>
                {allReadySelected ? "Deselect All" : "Select All"}
                <span className="results-selected-note">
                  {selectedVideos.length} selected
                </span>
              </button>

              <div className="results-toolbar-actions">
                <button
                  type="button"
                  className="results-outline-button"
                  disabled={!readyVideos.length || zipping}
                  onClick={() =>
                    downloadZip(readyVideos, "resizepro-videos.zip")
                  }
                >
                  <UiIcon name="download" />
                  {zipping ? "Preparing ZIP..." : "Download All as ZIP file"}
                </button>

                <button
                  type="button"
                  className="results-outline-button"
                  disabled={!readyVideos.length}
                  onClick={() => downloadSeparately(readyVideos)}
                >
                  <UiIcon name="download" />
                  Download All Separately
                </button>
              </div>
            </div>

            <div className="results-selected-bar">
              <span>
                {isProcessing
                  ? processingMessage
                  : `${selectedVideos.length} selected`}
              </span>

              {isProcessing ? (
                <strong className="results-overall-percent">
                  {processingProgress}%
                </strong>
              ) : (
                <button
                  type="button"
                  className="results-primary-button"
                  disabled={!selectedVideos.length || zipping}
                  onClick={() =>
                    downloadZip(selectedVideos, "resizepro-selected.zip")
                  }
                >
                  <UiIcon name="download" />
                  Download Selected ZIP
                </button>
              )}
            </div>

            {isProcessing && (
              <div className="results-overall-bar">
                <div
                  className="card-progress-fill"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
            )}

            <div className="results-table">
              <div className="results-table-head">
                <span>Name</span>
                <span>Size</span>
                <span>Type</span>
                <span>Status</span>
                <span />
              </div>

              <div className="results-virtual">
              {videos.map((video) => {
                const ready = video.status === "done" && video.outputUrl;
                const selected = selectedIds.includes(video.id);

                return (
                  <div
                    key={video.id}
                    className={`results-row ${selected ? "selected" : ""}`}
                  >
                    <button
                      type="button"
                      className={`results-checkbox ${
                        selected ? "checked" : ""
                      }`}
                      disabled={!ready}
                      onClick={() => toggleSelected(video.id)}
                      aria-label={`Select ${video.name}`}
                    >
                      {selected ? "✓" : ""}
                    </button>

                    <div className="results-file">
                      {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} alt="" />
                      ) : (
                        <span className="results-file-fallback">▶</span>
                      )}

                      <strong title={video.outputName || video.name}>
                        {video.outputName || video.name}
                      </strong>
                    </div>

                    <span className="results-size">
                      {ready
                        ? formatFileSize(video.outputSize)
                        : video.status === "error"
                          ? "Failed"
                          : "—"}
                    </span>

                    <span className="results-type">
                      {fileTypeLabel(video)}
                    </span>

                    {video.status === "processing" ? (
                      <div className="results-live-status">
                        <div className="card-progress-bar">
                          <div
                            className="card-progress-fill"
                            style={{
                              width: `${Math.round(video.progress)}%`,
                            }}
                          />
                        </div>
                        <span>{Math.round(video.progress)}%</span>
                      </div>
                    ) : video.status === "error" ? (
                      <span className="results-status error">!</span>
                    ) : video.status === "done" ? (
                      <span className="results-status done">✓</span>
                    ) : (
                      <span className="results-wait">
                        {isProcessing ? "Waiting" : "Ready"}
                      </span>
                    )}

                    <div className="results-row-actions">
                      <button
                        type="button"
                        className="results-icon-button"
                        disabled={!ready}
                        onClick={() => handleDownload(video)}
                        aria-label={`Download ${video.name}`}
                      >
                        <UiIcon name="download" />
                      </button>

                      <div className="results-menu-wrap">
                        <button
                          type="button"
                          className="results-icon-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuId((current) =>
                              current === video.id ? null : video.id
                            );
                          }}
                          aria-label="More actions"
                        >
                          <UiIcon name="more" />
                        </button>

                        {openMenuId === video.id && (
                          <div className="results-menu">
                            <button
                              type="button"
                              disabled={!ready}
                              onClick={() => handleDownload(video)}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                removeVideo(video.id);
                                setSelectedIds((previous) =>
                                  previous.filter((id) => id !== video.id)
                                );
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {video.status === "error" && (
                      <p className="results-row-error">{video.error}</p>
                    )}
                  </div>
                );
              })}
              </div>
            </div>

            <div className="results-footer">
              <button
                type="button"
                className="results-outline-button"
                disabled={isProcessing}
                onClick={() => {
                  setOpenMenuId(null);
                  setScreen("editor");
                }}
              >
                <svg
                  className="export-arrow"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M16.5 10H4.5" />
                  <path d="M9 5.5 4.5 10 9 14.5" />
                </svg>
                Edit Settings
              </button>

              <button
                type="button"
                className="results-dark-button"
                disabled={isProcessing}
                onClick={startNewBatch}
              >
                Start New Batch
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default VideoResizer;
