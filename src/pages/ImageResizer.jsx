import { useEffect, useRef, useState } from "react";
import "./ImageResizer.css";

const ASPECTS = [
  { id: "original", label: "Original", hint: "Keep frame" },
  { id: "square", label: "1:1", hint: "1080 × 1080", width: 1080, height: 1080 },
  { id: "story", label: "9:16", hint: "1080 × 1920", width: 1080, height: 1920 },
  { id: "portrait", label: "4:5", hint: "1080 × 1350", width: 1080, height: 1350 },
  { id: "landscape", label: "16:9", hint: "1920 × 1080", width: 1920, height: 1080 },
  { id: "standard", label: "4:3", hint: "1440 × 1080", width: 1440, height: 1080 },
];

const SIZE_PRESETS = [{ label: "Story", width: 1620, height: 2880 }];

const FEATURES = [
  {
    title: "Exact size",
    text: "Set the width and height in pixels, or lock the frame so the picture does not stretch.",
  },
  {
    title: "Percentage scale",
    text: "Shrink or enlarge every image by the same percent, from a small file to a larger export.",
  },
  {
    title: "Social frames",
    text: "Fit images into square, story, portrait, landscape, and standard frames.",
  },
  {
    title: "Rotate and flip",
    text: "Turn images left or right, then flip them horizontally or vertically before export.",
  },
  {
    title: "JPG, PNG, WebP",
    text: "Choose the format you need. Quality applies to JPG and WebP.",
  },
  {
    title: "Batch download",
    text: "Resize every image together, then download them one by one or as a ZIP.",
  },
];

function Icon({ name }) {
  if (name === "download") {
    return (
      <svg className="image-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 3.25v9.2" />
        <path d="m6.1 9.2 3.9 3.9 3.9-3.9" />
        <path d="M4.25 16.75h11.5" />
      </svg>
    );
  }

  if (name === "arrow") {
    return (
      <svg className="image-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3.5 10h12" />
        <path d="M11 5.5 15.5 10 11 14.5" />
      </svg>
    );
  }

  if (name === "back") {
    return (
      <svg className="image-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M16.5 10H4.5" />
        <path d="M9 5.5 4.5 10 9 14.5" />
      </svg>
    );
  }

  if (name === "rotate-left") {
    return (
      <svg className="image-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M7 7.5H4.5V5" />
        <path d="M4.8 8.2A5.5 5.5 0 1 1 5.6 14" />
      </svg>
    );
  }

  if (name === "rotate-right") {
    return (
      <svg className="image-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M13 7.5h2.5V5" />
        <path d="M15.2 8.2A5.5 5.5 0 1 0 14.4 14" />
      </svg>
    );
  }

  if (name === "flip-h") {
    return (
      <svg className="image-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 4v12" />
        <path d="M7 7 4 10l3 3" />
        <path d="m13 7 3 3-3 3" />
      </svg>
    );
  }

  return (
    <svg className="image-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h12" />
      <path d="M7 7 10 4l3 3" />
      <path d="m7 13 3 3 3-3" />
    </svg>
  );
}

function drawEditedImage(source, settings, dest) {
  const swapped = settings.rotation % 180 !== 0;
  const turnedWidth = swapped ? source.height : source.width;
  const turnedHeight = swapped ? source.width : source.height;
  const turned = document.createElement("canvas");
  turned.width = turnedWidth;
  turned.height = turnedHeight;
  const turnedContext = turned.getContext("2d");
  turnedContext.translate(turnedWidth / 2, turnedHeight / 2);
  turnedContext.rotate((settings.rotation * Math.PI) / 180);
  turnedContext.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
  turnedContext.drawImage(source, -source.width / 2, -source.height / 2);

  const context = dest.getContext("2d");
  context.clearRect(0, 0, dest.width, dest.height);

  if (settings.format === "JPG" || settings.fit === "contain") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, dest.width, dest.height);
  }

  let drawWidth = dest.width;
  let drawHeight = dest.height;
  let dx = 0;
  let dy = 0;

  if (settings.fit === "contain") {
    const scale = Math.min(dest.width / turned.width, dest.height / turned.height);
    drawWidth = turned.width * scale;
    drawHeight = turned.height * scale;
    dx = (dest.width - drawWidth) / 2;
    dy = (dest.height - drawHeight) / 2;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(turned, dx, dy, drawWidth, drawHeight);
}

function PreviewCanvas({
  image,
  rotation,
  flipH,
  flipV,
  fit,
  format,
  targetWidth,
  targetHeight,
  zoom = 1,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancel = false;
    loadImage(image.url).then((source) => {
      const canvas = canvasRef.current;

      if (cancel || !canvas) {
        return;
      }

      const safeZoom = zoom || 1;
      const neutralWidth = targetWidth / safeZoom;
      const neutralHeight = targetHeight / safeZoom;
      const normalFit = Math.min(160 / neutralWidth, 190 / neutralHeight);
      const largestFit = Math.min(250 / neutralWidth, 290 / neutralHeight);
      const visual = Math.min(normalFit * safeZoom, largestFit);
      canvas.width = Math.max(2, Math.round(neutralWidth * visual));
      canvas.height = Math.max(2, Math.round(neutralHeight * visual));
      drawEditedImage(
        source,
        { rotation, flipH, flipV, fit, format },
        canvas
      );
    });

    return () => {
      cancel = true;
    };
  }, [image.url, rotation, flipH, flipV, fit, format, targetWidth, targetHeight, zoom]);

  return <canvas ref={canvasRef} className="image-preview-canvas" />;
}

function formatBytes(bytes) {
  if (!bytes) {
    return "—";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clamp(value) {
  return Math.max(1, Math.min(8000, Math.round(Number(value) || 1)));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image."));
    image.src = url;
  });
}

function crc32(bytes) {
  let crc = ~0;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return ~crc >>> 0;
}

function dosTime(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();

  return { time, day };
}

async function buildZip(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const now = dosTime(new Date());

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);

    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, now.time, true);
    view.setUint16(12, now.day, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);

    const header = new Uint8Array(46 + name.length);
    const centralView = new DataView(header.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(12, now.time, true);
    centralView.setUint16(14, now.day, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    header.set(name, 46);
    central.push(header);
    offset += local.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

function outputMeta(format) {
  if (format === "PNG") {
    return { mime: "image/png", extension: "png" };
  }

  if (format === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }

  return { mime: "image/jpeg", extension: "jpg" };
}

function ImageResizer() {
  const inputRef = useRef(null);
  const [images, setImages] = useState([]);
  const [screen, setScreen] = useState("upload");
  const [mode, setMode] = useState("size");
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [percent, setPercent] = useState(100);
  const [aspect, setAspect] = useState("original");
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [format, setFormat] = useState("JPG");
  const [quality, setQuality] = useState(100);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [zipping, setZipping] = useState(false);

  const editorOpen = images.length > 0 && screen === "editor";

  useEffect(() => {
    document.body.classList.toggle("hide-site-footer", editorOpen);
    document.body.classList.toggle("lock-image-editor", editorOpen);

    return () => {
      document.body.classList.remove("hide-site-footer", "lock-image-editor");
    };
  }, [editorOpen]);

  const reference = images[0];

  function targetFor(image) {
    const swapped = rotation % 180 !== 0;
    const baseWidth = swapped ? image.height : image.width;
    const baseHeight = swapped ? image.width : image.height;

    if (mode === "percent") {
      return {
        width: clamp((baseWidth * percent) / 100),
        height: clamp((baseHeight * percent) / 100),
        fit: "fill",
      };
    }

    if (mode === "aspect") {
      const selected = ASPECTS.find((item) => item.id === aspect);

      if (!selected || selected.id === "original") {
        return { width: baseWidth, height: baseHeight, fit: "fill" };
      }

      return { width: selected.width, height: selected.height, fit: "contain" };
    }

    const nextWidth = clamp(width || baseWidth);
    const nextHeight = clamp(height || baseHeight);

    return {
      width: nextWidth,
      height: nextHeight,
      fit: "fill",
    };
  }

  function updateWidth(value) {
    setWidth(Math.max(1, Number(value) || 1));
  }

  function updateHeight(value) {
    setHeight(Math.max(1, Number(value) || 1));
  }

  async function addImages(fileList) {
    const files = [...fileList].filter((file) =>
      /^image\/(jpeg|jpg|png|webp)$/.test(file.type) ||
      /\.(jpe?g|png|webp)$/i.test(file.name)
    );
    const rejected = fileList.length - files.length;

    if (!files.length) {
      setMessage("Use JPG, PNG, or WebP images.");
      return;
    }

    setMessage(
      rejected ? `${rejected} file${rejected === 1 ? "" : "s"} skipped. Use JPG, PNG, or WebP.` : ""
    );
    setIsReading(true);

    try {
      const prepared = [];

      for (const file of files) {
        if (file.size > 30 * 1024 * 1024) {
          setMessage(`${file.name} is larger than 30 MB.`);
          continue;
        }

        const url = URL.createObjectURL(file);
        const element = await loadImage(url);
        prepared.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          name: file.name,
          url,
          width: element.naturalWidth,
          height: element.naturalHeight,
          status: "ready",
          progress: 0,
          outputUrl: "",
          outputName: "",
          outputSize: 0,
          error: "",
        });
      }

      if (!prepared.length) {
        return;
      }

      setImages((current) => {
        const next = [...current, ...prepared];

        if (!current.length) {
          setWidth(prepared[0].width);
          setHeight(prepared[0].height);
          setScreen("editor");
        }

        return next;
      });
    } finally {
      setIsReading(false);
      setIsDragging(false);
    }
  }

  function removeImage(id) {
    setImages((current) => {
      const image = current.find((item) => item.id === id);

      if (image) {
        URL.revokeObjectURL(image.url);

        if (image.outputUrl) {
          URL.revokeObjectURL(image.outputUrl);
        }
      }

      const next = current.filter((item) => item.id !== id);

      if (!next.length) {
        setScreen("upload");
      }

      return next;
    });
  }

  function clearImages() {
    images.forEach((image) => {
      URL.revokeObjectURL(image.url);

      if (image.outputUrl) {
        URL.revokeObjectURL(image.outputUrl);
      }
    });
    setImages([]);
    setScreen("upload");
    setMessage("");
  }

  function resetSettings() {
    setMode("size");
    setPercent(100);
    setAspect("original");
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setFormat("JPG");
    setQuality(100);

    if (reference) {
      setWidth(reference.width);
      setHeight(reference.height);
    }
  }

  async function renderImage(image) {
    const source = await loadImage(image.url);
    const target = targetFor(image);
    const output = document.createElement("canvas");
    output.width = target.width;
    output.height = target.height;
    drawEditedImage(
      source,
      { rotation, flipH, flipV, fit: target.fit, format },
      output
    );
    const meta = outputMeta(format);
    const blob = await new Promise((resolve) => {
      output.toBlob(resolve, meta.mime, quality / 100);
    });

    if (!blob) {
      throw new Error("This browser could not export that format.");
    }

    const base = image.name.replace(/\.[^.]+$/, "");

    return {
      outputUrl: URL.createObjectURL(blob),
      outputName: `${base}_resized.${meta.extension}`,
      outputSize: blob.size,
      blob,
    };
  }

  async function resizeAll() {
    if (!images.length || isProcessing) {
      return;
    }

    setScreen("results");
    setIsProcessing(true);
    setProcessingProgress(0);

    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      setProcessingLabel(`Resizing ${index + 1} of ${images.length}: ${image.name}`);
      setImages((current) =>
        current.map((item) =>
          item.id === image.id
            ? { ...item, status: "processing", progress: 35, error: "" }
            : item
        )
      );

      try {
        const result = await renderImage(image);
        setImages((current) =>
          current.map((item) =>
            item.id === image.id
              ? {
                  ...item,
                  status: "done",
                  progress: 100,
                  outputUrl: result.outputUrl,
                  outputName: result.outputName,
                  outputSize: result.outputSize,
                  blob: result.blob,
                }
              : item
          )
        );
      } catch (error) {
        setImages((current) =>
          current.map((item) =>
            item.id === image.id
              ? {
                  ...item,
                  status: "error",
                  progress: 0,
                  error: error.message || "Could not resize this image.",
                }
              : item
          )
        );
      }

      setProcessingProgress(Math.round(((index + 1) / images.length) * 100));
    }

    setIsProcessing(false);
    setProcessingLabel("");
  }

  function downloadOne(image) {
    if (!image.outputUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = image.outputUrl;
    link.download = image.outputName || image.name;
    link.click();
  }

  async function downloadZip() {
    const ready = images.filter((image) => image.status === "done" && image.blob);

    if (!ready.length || zipping) {
      return;
    }

    setZipping(true);

    try {
      const zip = await buildZip(
        ready.map((image) => ({
          name: image.outputName,
          blob: image.blob,
        }))
      );
      const url = URL.createObjectURL(zip);
      const link = document.createElement("a");
      link.href = url;
      link.download = "resizepro-images.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setZipping(false);
    }
  }

  function downloadSeparately() {
    images
      .filter((image) => image.status === "done" && image.outputUrl)
      .forEach((image, index) => {
        setTimeout(() => downloadOne(image), index * 250);
      });
  }

  const readyCount = images.filter((image) => image.status === "done").length;

  return (
    <main className="image-page">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          addImages(event.target.files);
          event.target.value = "";
        }}
      />

      {screen === "upload" && (
        <>
          <header className="image-page-header">
            <div className="image-header-content">
              <span className="image-header-label">IMAGE TOOL</span>
              <h1>
                Resize your <span>images.</span>
              </h1>
              <p>
                Resize, scale, rotate, flip, and export JPG, PNG, or WebP.
                Everything stays in your browser.
              </p>
            </div>
          </header>

          <section className="image-upload-section">
            <button
              type="button"
              className={`image-drop-zone ${isDragging ? "dragging" : ""} ${
                isReading ? "uploading" : ""
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                addImages(event.dataTransfer.files);
              }}
            >
              <span className="image-upload-icon">+</span>
              <h2>{isReading ? "Reading images..." : "Drop images here"}</h2>
              <p>
                or <span>browse</span> from your computer
              </p>
              <span className="image-formats">JPG · PNG · WEBP</span>
            </button>
            {message && <p className="image-message">{message}</p>}
          </section>

          <section className="image-feature-section">
            <div className="image-feature-grid">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="image-feature-card">
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {screen === "editor" && (
        <section className="image-editor-section">
          <div className="image-toolbar">
            <div className="image-toolbar-left">
              <span className="image-count">
                {images.length} {images.length === 1 ? "FILE" : "FILES"}
              </span>
              <button type="button" onClick={() => inputRef.current?.click()}>
                <span className="image-plus">+</span>
                Add images
              </button>
              <button type="button" onClick={clearImages}>
                Clear
              </button>
            </div>
            <span className="image-ready">
              <i />
              Ready to resize
            </span>
          </div>

          {message && <p className="image-message toolbar-message">{message}</p>}

          <div className="image-layout">
            <aside className="image-settings">
              <div className="image-settings-scroll">
                <div className="image-settings-heading">
                  <h2>Resize Settings</h2>
                  <p>Settings apply to all images</p>
                </div>

                <div className="image-mode-switch">
                  {[
                    ["size", "By Size"],
                    ["percent", "Percentage"],
                    ["aspect", "Aspect Ratio"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={mode === id ? "active" : ""}
                      onClick={() => setMode(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {mode === "size" && (
                  <div className="image-setting-group">
                    <div className="image-size-row">
                      <label>
                        Width
                        <span>
                          <input
                            type="number"
                            min="1"
                            max="8000"
                            value={width}
                            onChange={(event) => updateWidth(event.target.value)}
                          />
                          px
                        </span>
                      </label>
                      <label>
                        Height
                        <span>
                          <input
                            type="number"
                            min="1"
                            max="8000"
                            value={height}
                            onChange={(event) => updateHeight(event.target.value)}
                          />
                          px
                        </span>
                      </label>
                    </div>
                    <p className="image-mini-label">Quick presets</p>
                    <div className="image-preset-row">
                      <button
                        type="button"
                        className={
                          reference &&
                          width === reference.width &&
                          height === reference.height
                            ? "active"
                            : ""
                        }
                        onClick={() => {
                          if (!reference) {
                            return;
                          }

                          setWidth(reference.width);
                          setHeight(reference.height);
                        }}
                      >
                        Original
                      </button>
                      {SIZE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className={
                            width === preset.width && height === preset.height
                              ? "active"
                              : ""
                          }
                          onClick={() => {
                            setWidth(preset.width);
                            setHeight(preset.height);
                          }}
                        >
                          {preset.width} × {preset.height}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mode === "percent" && (
                  <div className="image-setting-group">
                    <div className="image-title-row">
                      <h3>Scale</h3>
                      <strong>{percent}%</strong>
                    </div>
                    <input
                      className="image-slider"
                      type="range"
                      min="10"
                      max="200"
                      value={percent}
                      onChange={(event) => setPercent(Number(event.target.value))}
                      style={{ "--slider-fill": `${((percent - 10) / 190) * 100}%` }}
                    />
                    <div className="image-slider-labels">
                      <span>10%</span>
                      <span>200%</span>
                    </div>
                  </div>
                )}

                {mode === "aspect" && (
                  <div className="image-setting-group">
                    <div className="image-aspect-grid">
                      {ASPECTS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={aspect === item.id ? "active" : ""}
                          onClick={() => setAspect(item.id)}
                        >
                          <strong>{item.label}</strong>
                          <small>{item.hint}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="image-setting-group">
                  <h3>Transform</h3>
                  <div className="image-transform-row">
                    <button
                      type="button"
                      aria-label="Rotate left"
                      onClick={() => setRotation((current) => (current + 270) % 360)}
                    >
                      <Icon name="rotate-left" />
                    </button>
                    <button
                      type="button"
                      aria-label="Rotate right"
                      onClick={() => setRotation((current) => (current + 90) % 360)}
                    >
                      <Icon name="rotate-right" />
                    </button>
                    <button
                      type="button"
                      className={flipH ? "active" : ""}
                      aria-label="Flip horizontal"
                      onClick={() => setFlipH((current) => !current)}
                    >
                      <Icon name="flip-h" />
                    </button>
                    <button
                      type="button"
                      className={flipV ? "active" : ""}
                      aria-label="Flip vertical"
                      onClick={() => setFlipV((current) => !current)}
                    >
                      <Icon name="flip-v" />
                    </button>
                  </div>
                  <p className="image-transform-note">
                    Rotation: {rotation}° · H: {flipH ? "On" : "Off"} · V:{" "}
                    {flipV ? "On" : "Off"}
                  </p>
                </div>

                <div className="image-setting-group">
                  <h3>Output format</h3>
                  <div className="image-format-row">
                    {["JPG", "PNG", "WEBP"].map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={format === item ? "active" : ""}
                        onClick={() => setFormat(item)}
                      >
                        {item === "WEBP" ? "WebP" : item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="image-setting-group">
                  <div className="image-title-row">
                    <h3>Quality</h3>
                    <strong>{format === "PNG" ? "Full" : `${quality}%`}</strong>
                  </div>
                  <input
                    className="image-slider"
                    type="range"
                    min="40"
                    max="100"
                    value={quality}
                    disabled={format === "PNG"}
                    onChange={(event) => setQuality(Number(event.target.value))}
                    style={{ "--slider-fill": `${((quality - 40) / 60) * 100}%` }}
                  />
                  <div className="image-slider-labels">
                    <span>Smaller file</span>
                    <span>Higher quality</span>
                  </div>
                </div>

                <button type="button" className="image-reset" onClick={resetSettings}>
                  Reset settings
                </button>
              </div>

              <div className="image-settings-actions">
                <button
                  type="button"
                  className="image-process"
                  disabled={isReading || !images.length}
                  onClick={resizeAll}
                >
                  Resize all images
                  <Icon name="arrow" />
                </button>
              </div>
            </aside>

            <div
              className={`image-workspace ${isDragging ? "dropping" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                addImages(event.dataTransfer.files);
              }}
            >
              <div className="image-workspace-head">
                <div>
                  <h2>Your Images</h2>
                  <p>Scroll horizontally to view all uploaded images</p>
                </div>
                <span>
                  {images.length} {images.length === 1 ? "file" : "files"}
                </span>
              </div>

              <div className="image-track-window">
                <div className="image-track">
                  {images.map((image) => {
                    const target = targetFor(image);

                    return (
                      <article key={image.id} className="image-card">
                        <div className="image-card-preview">
                          <PreviewCanvas
                            image={image}
                            rotation={rotation}
                            flipH={flipH}
                            flipV={flipV}
                            fit={target.fit}
                            format={format}
                            targetWidth={target.width}
                            targetHeight={target.height}
                            zoom={mode === "percent" ? percent / 100 : 1}
                          />
                        </div>
                        <div className="image-card-copy">
                          <strong title={image.name}>{image.name}</strong>
                          <p>
                            {image.width} × {image.height}
                            <span>
                              {target.width} × {target.height}
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={() => removeImage(image.id)}
                            aria-label={`Remove ${image.name}`}
                          >
                            ×
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  <button
                    type="button"
                    className="image-add-card"
                    onClick={() => inputRef.current?.click()}
                  >
                    <span>+</span>
                    <strong>{isDragging ? "Drop images" : "Add images"}</strong>
                    <small>JPG · PNG · WEBP</small>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === "results" && (
        <section className="image-results">
          {isProcessing && (
            <div className="image-results-banner">
              <span>{processingLabel}</span>
              <strong>{processingProgress}%</strong>
              <div>
                <i style={{ width: `${processingProgress}%` }} />
              </div>
            </div>
          )}

          <div className="image-results-toolbar">
            <button
              type="button"
              disabled={!readyCount || zipping}
              onClick={downloadZip}
            >
              <Icon name="download" />
              {zipping ? "Preparing ZIP..." : "Download all as ZIP"}
            </button>
            <button
              type="button"
              disabled={!readyCount}
              onClick={downloadSeparately}
            >
              <Icon name="download" />
              Download all separately
            </button>
          </div>

          <div className="image-results-table">
            <div className="image-results-head">
              <span>Name</span>
              <span>Size</span>
              <span>Type</span>
              <span>Status</span>
              <span />
            </div>
            <div className="image-results-body">
              {images.map((image) => (
                <div key={image.id} className="image-results-row">
                  <div className="image-results-file">
                    <img src={image.outputUrl || image.url} alt="" />
                    <strong>{image.outputName || image.name}</strong>
                  </div>
                  <span>{formatBytes(image.outputSize)}</span>
                  <em>{format}</em>
                  <span
                    className={
                      image.status === "done"
                        ? "image-results-done"
                        : image.status === "error"
                          ? "image-results-error"
                          : "image-results-progress"
                    }
                  >
                    {image.status === "done"
                      ? "✓"
                      : image.status === "error"
                        ? image.error
                        : image.status === "processing"
                          ? `${image.progress}%`
                          : "Waiting"}
                  </span>
                  <button
                    type="button"
                    disabled={image.status !== "done"}
                    onClick={() => downloadOne(image)}
                    aria-label={`Download ${image.name}`}
                  >
                    <Icon name="download" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="image-results-footer">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setScreen("editor")}
            >
              <Icon name="back" />
              Edit settings
            </button>
            <button
              type="button"
              className="image-new-batch"
              disabled={isProcessing}
              onClick={clearImages}
            >
              Start new batch
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default ImageResizer;
