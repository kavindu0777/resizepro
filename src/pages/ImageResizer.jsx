import { useEffect, useRef, useState } from "react";
import "./ImageResizer.css";

import ResultsPanel from "../components/ResultsPanel";

import {
  createZip,
  downloadBlob,
  downloadMany,
  downloadUrl,
  makeId,
} from "../utils/files";

const MAX_SIDE = 8000;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const PREVIEW_MAX_EDGE = 640;

const ASPECTS = [
  { id: "original", label: "Original", hint: "Keep frame" },
  { id: "square", label: "1:1", hint: "1080 × 1080", width: 1080, height: 1080 },
  { id: "story", label: "9:16", hint: "1080 × 1920", width: 1080, height: 1920 },
  { id: "portrait", label: "4:5", hint: "1080 × 1350", width: 1080, height: 1350 },
  { id: "landscape", label: "16:9", hint: "1920 × 1080", width: 1920, height: 1080 },
  { id: "standard", label: "4:3", hint: "1440 × 1080", width: 1440, height: 1080 },
];

const SIZE_PRESETS = [
  { label: "1620 × 2880", width: 1620, height: 2880 },
  { label: "1080 × 1080", width: 1080, height: 1080 },
  { label: "1920 × 1080", width: 1920, height: 1080 },
  { label: "1280 × 720", width: 1280, height: 720 },
  { label: "1080 × 1920", width: 1080, height: 1920 },
];

const FEATURES = [
  {
    title: "Exact size",
    text: "Export at exactly the width and height you type, like 1620 × 2880. Crop, add bars, or stretch when the shape is different.",
  },
  {
    title: "Percentage scale",
    text: "Shrink or enlarge every image by the same percent, from a small file to a larger export.",
  },
  {
    title: "Social frames",
    text: "Fit images into square, story, portrait, landscape, and standard frames by cropping or adding bars.",
  },
  {
    title: "Rotate and flip",
    text: "Turn images left or right, then flip them horizontally or vertically before export.",
  },
  {
    title: "JPG, PNG, WebP",
    text: "Keep the original format and full quality by default, or choose JPG, PNG, or WebP.",
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

function clampSide(value) {
  return Math.max(1, Math.min(MAX_SIDE, Math.round(Number(value) || 1)));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image."));
    image.src = url;
  });
}

function sourceSize(source) {
  return {
    width: source.naturalWidth || source.width,
    height: source.naturalHeight || source.height,
  };
}

// Decode each image once at a small size for the live previews.
// Before, every slider tick re-decoded every full-resolution photo.
const previewCache = new Map();

function getPreviewSource(url) {
  if (!previewCache.has(url)) {
    const promise = loadImage(url).then((image) => {
      const { width, height } = sourceSize(image);
      const fit = Math.min(1, PREVIEW_MAX_EDGE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * fit));
      canvas.height = Math.max(1, Math.round(height * fit));
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    });

    promise.catch(() => previewCache.delete(url));
    previewCache.set(url, promise);
  }

  return previewCache.get(url);
}

/**
 * fit:
 *  "fill"    – stretch to the exact size (only used when the shapes match)
 *  "cover"   – fill the frame and crop the overflow
 *  "contain" – fit inside the frame and add bars
 */
function drawEditedImage(source, settings, dest) {
  const size = sourceSize(source);
  const swapped = settings.rotation % 180 !== 0;
  const turnedWidth = swapped ? size.height : size.width;
  const turnedHeight = swapped ? size.width : size.height;
  const turned = document.createElement("canvas");
  turned.width = turnedWidth;
  turned.height = turnedHeight;

  const turnedContext = turned.getContext("2d");
  turnedContext.translate(turnedWidth / 2, turnedHeight / 2);
  turnedContext.rotate((settings.rotation * Math.PI) / 180);
  turnedContext.scale(settings.flipH ? -1 : 1, settings.flipV ? -1 : 1);
  turnedContext.drawImage(source, -size.width / 2, -size.height / 2);

  const context = dest.getContext("2d");
  context.clearRect(0, 0, dest.width, dest.height);

  // JPG has no transparency, so paint white first.
  // PNG and WebP keep transparent bars.
  if (settings.format === "JPG") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, dest.width, dest.height);
  }

  let drawWidth = dest.width;
  let drawHeight = dest.height;
  let dx = 0;
  let dy = 0;

  if (settings.fit === "contain" || settings.fit === "cover") {
    const pick = settings.fit === "contain" ? Math.min : Math.max;
    const scale = pick(dest.width / turned.width, dest.height / turned.height);
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

    getPreviewSource(image.url)
      .then((source) => {
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
        drawEditedImage(source, { rotation, flipH, flipV, fit, format }, canvas);
      })
      .catch(() => {
        // The card still shows the name; the export reports the real error.
      });

    return () => {
      cancel = true;
    };
  }, [image.url, rotation, flipH, flipV, fit, format, targetWidth, targetHeight, zoom]);

  return <canvas ref={canvasRef} className="image-preview-canvas" />;
}

const FIT_OPTIONS = [
  { id: "cover", label: "Crop to fill", hint: "No bars, edges may be cut" },
  { id: "contain", label: "Fit with bars", hint: "Whole picture, adds bars" },
  { id: "fill", label: "Stretch", hint: "Whole picture, may look squashed" },
];

// Used when the photo's shape is different from the chosen frame.
function FitChoice({ value, onChange }) {
  const current = FIT_OPTIONS.find((item) => item.id === value) || FIT_OPTIONS[0];

  return (
    <>
      <p className="image-mini-label">If the shape is different</p>
      <div className="image-format-row">
        {FIT_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={value === item.id ? "active" : ""}
            aria-pressed={value === item.id}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="image-transform-note">{current.hint}</p>
    </>
  );
}

// Lets the user clear the box and type a new number.
// The old input forced "1" the moment it was empty.
function NumberField({ value, onCommit, label }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      min="1"
      max={MAX_SIDE}
      aria-label={label}
      value={draft}
      onChange={(event) => {
        const text = event.target.value;
        const number = Number(text);
        setDraft(text);

        if (text !== "" && Number.isFinite(number) && number >= 1) {
          onCommit(clampSide(number));
        }
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}

// "ORIGINAL" keeps each image in the format it was uploaded in.
function resolveFormat(format, image) {
  if (format !== "ORIGINAL") {
    return format;
  }

  const type = image?.file?.type || "";
  const name = image?.name || "";

  if (type === "image/png" || /\.png$/i.test(name)) {
    return "PNG";
  }

  if (type === "image/webp" || /\.webp$/i.test(name)) {
    return "WEBP";
  }

  return "JPG";
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

function isSupportedImage(file) {
  return (
    /^image\/(jpeg|jpg|png|webp)$/.test(file.type) ||
    /\.(jpe?g|png|webp)$/i.test(file.name)
  );
}

function revokeImageUrls(image) {
  URL.revokeObjectURL(image.url);
  previewCache.delete(image.url);

  if (image.outputUrl) {
    URL.revokeObjectURL(image.outputUrl);
  }
}

function ImageResizer() {
  const inputRef = useRef(null);
  const imagesRef = useRef([]);
  const [images, setImages] = useState([]);
  const [screen, setScreen] = useState("upload");
  const [mode, setMode] = useState("size");
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [lockAspect, setLockAspect] = useState(true);
  // Until the user picks a size, every image keeps its own original size.
  const [sizeTouched, setSizeTouched] = useState(false);
  const [percent, setPercent] = useState(100);
  const [aspect, setAspect] = useState("original");
  // How the picture fills an exact frame whose shape differs from the photo:
  // "cover" = crop to fill, "contain" = fit with bars, "fill" = stretch.
  const [frameFit, setFrameFit] = useState("cover");
  // Width:height ratio that "Lock ratio" keeps while typing.
  // Stored separately so repeated rounding never drifts the size.
  const lockRatioRef = useRef(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [format, setFormat] = useState("ORIGINAL");
  const [quality, setQuality] = useState(100);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [zipping, setZipping] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const editorOpen = images.length > 0 && screen === "editor";

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    document.body.classList.toggle("hide-site-footer", editorOpen);
    document.body.classList.toggle("lock-image-editor", editorOpen);

    return () => {
      document.body.classList.remove("hide-site-footer", "lock-image-editor");
    };
  }, [editorOpen]);

  // Open each screen at the top (on phones the old scroll position was kept).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [screen]);

  // Free every object URL when the user leaves the page.
  useEffect(() => {
    return () => {
      imagesRef.current.forEach(revokeImageUrls);
    };
  }, []);

  const reference = images[0];

  function rotatedBase(image, turn = rotation) {
    const swapped = turn % 180 !== 0;

    return {
      width: swapped ? image.height : image.width,
      height: swapped ? image.width : image.height,
    };
  }

  const referenceBase = reference ? rotatedBase(reference) : null;

  function targetFor(image) {
    const base = rotatedBase(image);

    if (mode === "percent") {
      return {
        width: clampSide((base.width * percent) / 100),
        height: clampSide((base.height * percent) / 100),
        fit: "fill",
      };
    }

    if (mode === "aspect") {
      const selected = ASPECTS.find((item) => item.id === aspect);

      if (!selected || selected.id === "original") {
        return { width: base.width, height: base.height, fit: "fill" };
      }

      return { width: selected.width, height: selected.height, fit: frameFit };
    }

    if (!sizeTouched) {
      return { width: base.width, height: base.height, fit: "fill" };
    }

    // "By Size" always exports exactly width × height (e.g. 1620 × 2880).
    // If a photo has a different shape, frameFit decides how it fills it.
    const exactWidth = clampSide(width);
    const exactHeight = clampSide(height);
    const sameShape =
      Math.abs(base.width / base.height - exactWidth / exactHeight) < 0.001;

    return {
      width: exactWidth,
      height: exactHeight,
      fit: sameShape ? "fill" : frameFit,
    };
  }

  // Set both sides at once (presets, Original, rotate) and remember the ratio.
  function setSize(nextWidth, nextHeight) {
    const w = clampSide(nextWidth);
    const h = clampSide(nextHeight);
    setWidth(w);
    setHeight(h);
    lockRatioRef.current = w / h;
  }

  function updateWidth(value) {
    setSizeTouched(true);

    if (lockAspect) {
      setWidth(value);
      setHeight(clampSide(value / lockRatioRef.current));
    } else {
      setSize(value, height);
    }
  }

  function updateHeight(value) {
    setSizeTouched(true);

    if (lockAspect) {
      setHeight(value);
      setWidth(clampSide(value * lockRatioRef.current));
    } else {
      setSize(width, value);
    }
  }

  function toggleLock() {
    // Locking keeps the ratio of the numbers currently in the boxes.
    lockRatioRef.current = clampSide(width) / clampSide(height);
    setLockAspect((current) => !current);
  }

  // A 90° turn swaps the output sides too, otherwise the photo is squashed.
  function rotate(delta) {
    setRotation((current) => (current + delta + 360) % 360);
    setSize(height, width);
  }

  async function addImages(fileList) {
    if (isReading) {
      return;
    }

    const all = [...(fileList || [])];

    if (!all.length) {
      return;
    }

    const accepted = all.filter(isSupportedImage);
    const problems = [];
    const skipped = all.length - accepted.length;

    if (skipped) {
      problems.push(
        `${skipped} file${skipped === 1 ? "" : "s"} skipped. Use JPG, PNG, or WebP.`
      );
    }

    const prepared = [];
    setIsReading(true);

    try {
      for (const file of accepted) {
        if (file.size > MAX_IMAGE_BYTES) {
          problems.push(`${file.name} is larger than 30 MB.`);
          continue;
        }

        const url = URL.createObjectURL(file);

        // One broken file no longer cancels the whole batch.
        try {
          const element = await loadImage(url);
          const size = sourceSize(element);

          prepared.push({
            id: makeId(),
            file,
            name: file.name,
            url,
            width: size.width,
            height: size.height,
            status: "ready",
            progress: 0,
            outputUrl: "",
            outputName: "",
            outputSize: 0,
            blob: null,
            error: "",
          });
        } catch {
          URL.revokeObjectURL(url);
          problems.push(`${file.name} could not be read.`);
        }
      }
    } finally {
      setIsReading(false);
      setIsDragging(false);
    }

    setMessage(problems.join(" "));

    if (!prepared.length) {
      return;
    }

    const wasEmpty = imagesRef.current.length === 0;
    const next = [...imagesRef.current, ...prepared];
    imagesRef.current = next;
    setImages(next);

    if (wasEmpty) {
      setSizeTouched(false);
      const base = rotatedBase(prepared[0]);
      setSize(base.width, base.height);
      setScreen("editor");
    }
  }

  function removeImage(id) {
    if (isProcessing) {
      return;
    }

    setSelectedIds((previous) => previous.filter((item) => item !== id));
    const image = imagesRef.current.find((item) => item.id === id);

    if (!image) {
      return;
    }

    revokeImageUrls(image);

    const next = imagesRef.current.filter((item) => item.id !== id);
    imagesRef.current = next;
    setImages(next);

    if (!next.length) {
      setScreen("upload");
    }
  }

  function clearImages() {
    imagesRef.current.forEach(revokeImageUrls);
    imagesRef.current = [];
    setImages([]);
    setScreen("upload");
    setMessage("");
    setSelectedIds([]);
  }

  function resetSettings() {
    setMode("size");
    setPercent(100);
    setAspect("original");
    setFrameFit("cover");
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setFormat("ORIGINAL");
    setQuality(100);
    setLockAspect(true);
    setSizeTouched(false);

    if (reference) {
      setSize(reference.width, reference.height);
    }
  }

  async function renderImage(image) {
    const target = targetFor(image);
    const outFormat = resolveFormat(format, image);
    const meta = outputMeta(outFormat);
    // Avoid names like photo_resized_resized.jpg when re-resizing a file.
    const base = image.name.replace(/\.[^.]+$/, "").replace(/(_resized)+$/i, "");

    // Nothing changed (same size, no rotate/flip, same format):
    // return the original file byte-for-byte, so there is zero quality loss.
    const unchanged =
      target.width === image.width &&
      target.height === image.height &&
      rotation === 0 &&
      !flipH &&
      !flipV &&
      outFormat === resolveFormat("ORIGINAL", image);

    if (unchanged) {
      const blob = image.file;

      return {
        outputUrl: URL.createObjectURL(blob),
        outputName: `${base}_resized.${meta.extension}`,
        outputSize: blob.size,
        blob,
      };
    }

    const source = await loadImage(image.url);
    const output = document.createElement("canvas");
    output.width = target.width;
    output.height = target.height;

    drawEditedImage(
      source,
      { rotation, flipH, flipV, fit: target.fit, format: outFormat },
      output
    );

    const blob = await new Promise((resolve) => {
      output.toBlob(resolve, meta.mime, quality / 100);
    });

    if (!blob) {
      // Usually the canvas size limit (about 16 megapixels on iPhone/iPad).
      throw new Error(
        `${target.width} × ${target.height} is too large for this browser. Try a smaller size.`
      );
    }

    if (blob.type && blob.type !== meta.mime) {
      // Safari cannot encode WebP and quietly returns a PNG instead.
      throw new Error(
        `This browser cannot save ${outFormat === "WEBP" ? "WebP" : outFormat}. Choose JPG or PNG.`
      );
    }

    return {
      outputUrl: URL.createObjectURL(blob),
      outputName: `${base}_resized.${meta.extension}`,
      outputSize: blob.size,
      blob,
    };
  }

  async function resizeAll() {
    if (!images.length || isProcessing || isReading) {
      return;
    }

    const batch = imagesRef.current;

    // Free the files from the previous run before making new ones.
    batch.forEach((image) => {
      if (image.outputUrl) {
        URL.revokeObjectURL(image.outputUrl);
      }
    });

    setImages((current) =>
      current.map((item) => ({
        ...item,
        status: "waiting",
        progress: 0,
        outputUrl: "",
        outputName: "",
        outputSize: 0,
        blob: null,
        error: "",
      }))
    );

    setScreen("results");
    setMessage("");
    setSelectedIds([]);
    setIsProcessing(true);
    setProcessingProgress(0);

    const doneIds = [];

    for (let index = 0; index < batch.length; index += 1) {
      const image = batch[index];
      setProcessingLabel(`Resizing ${index + 1} of ${batch.length}: ${image.name}`);
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
              ? { ...item, status: "done", progress: 100, ...result }
              : item
          )
        );
        doneIds.push(image.id);
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

      setProcessingProgress(Math.round(((index + 1) / batch.length) * 100));
    }

    // Every finished image starts ticked.
    setSelectedIds(doneIds);
    setIsProcessing(false);
    setProcessingLabel("");
  }

  function downloadOne(image) {
    if (image.outputUrl) {
      downloadUrl(image.outputUrl, image.outputName || image.name);
    }
  }

  async function downloadZip(list, zipName) {
    const ready = list.filter((image) => image.blob);

    if (!ready.length || zipping) {
      return;
    }

    setZipping(true);
    setMessage("");

    try {
      const zip = await createZip(
        ready.map((image) => ({ name: image.outputName, blob: image.blob }))
      );
      downloadBlob(zip, zipName);
    } catch (error) {
      setMessage(error.message || "Could not create the ZIP file.");
    } finally {
      setZipping(false);
    }
  }

  function downloadSeparately(list) {
    downloadMany(list.map((image) => ({ url: image.outputUrl, name: image.outputName })));
  }

  const readyImages = images.filter((image) => image.status === "done" && image.outputUrl);
  const selectedImages = readyImages.filter((image) => selectedIds.includes(image.id));
  const allReadySelected =
    readyImages.length > 0 && selectedImages.length === readyImages.length;

  function toggleSelected(id) {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );
  }

  function toggleSelectAll() {
    setSelectedIds(allReadySelected ? [] : readyImages.map((image) => image.id));
  }

  const resultItems = images.map((image) => {
    const ready = image.status === "done" && Boolean(image.outputUrl);

    return {
      id: image.id,
      name: image.outputName || image.name,
      thumb: image.outputUrl || image.url,
      bytes: ready ? image.outputSize : 0,
      type: image.outputName
        ? image.outputName.split(".").pop().toUpperCase()
        : resolveFormat(format, image),
      state:
        image.status === "processing"
          ? "processing"
          : image.status === "error"
            ? "error"
            : ready
              ? "done"
              : isProcessing
                ? "waiting"
                : "idle",
      progress: image.progress,
      error: image.error,
      ready,
    };
  });

  const openPicker = () => {
    if (!isReading) {
      inputRef.current?.click();
    }
  };

  const dropHandlers = {
    onDragOver: (event) => {
      event.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsDragging(false);
      }
    },
    onDrop: (event) => {
      event.preventDefault();
      setIsDragging(false);
      addImages(event.dataTransfer.files);
    },
  };

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
                Resize your <span>images</span>
              </h1>
              <p>
                Resize, scale, rotate, flip, and export JPG, PNG, or WebP.
                Everything stays in your browser.
              </p>
            </div>
          </header>

          <section className="image-upload-section">
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose images to resize"
              aria-busy={isReading}
              className={`image-drop-zone ${isDragging ? "dragging" : ""} ${
                isReading ? "uploading" : ""
              }`}
              onClick={openPicker}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPicker();
                }
              }}
              {...dropHandlers}
            >
              <span className="image-upload-icon" aria-hidden="true">
                +
              </span>
              <h2>{isReading ? "Reading images..." : "Drop images here"}</h2>
              <p>
                or <span>browse</span> from your computer
              </p>
              <span className="image-formats">JPG · PNG · WEBP · up to 30 MB</span>
            </div>
            {message && (
              <p className="image-message" role="alert">
                {message}
              </p>
            )}
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
              <button type="button" onClick={openPicker} disabled={isReading}>
                <span className="image-plus">+</span>
                Add images
              </button>
              <button type="button" onClick={clearImages} disabled={isReading}>
                Clear
              </button>
            </div>
            <span className="image-ready">
              <i />
              {isReading ? "Reading images..." : "Ready to resize"}
            </span>
          </div>

          {message && (
            <p className="image-message toolbar-message" role="alert">
              {message}
            </p>
          )}

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
                          <NumberField
                            label="Width in pixels"
                            value={width}
                            onCommit={updateWidth}
                          />
                          px
                        </span>
                      </label>
                      <label>
                        Height
                        <span>
                          <NumberField
                            label="Height in pixels"
                            value={height}
                            onCommit={updateHeight}
                          />
                          px
                        </span>
                      </label>
                    </div>

                    <label className="image-lock">
                      <input
                        type="checkbox"
                        checked={lockAspect}
                        onChange={toggleLock}
                      />
                      Lock ratio (changing one side updates the other)
                    </label>

                    {!sizeTouched ? (
                      <p className="image-transform-note">
                        Each image keeps its original size. Type a size or pick
                        a preset to change it.
                      </p>
                    ) : (
                      <>
                        <p className="image-transform-note">
                          Every image is exported at exactly {width} × {height} px.
                        </p>
                        <FitChoice value={frameFit} onChange={setFrameFit} />
                      </>
                    )}

                    <p className="image-mini-label">Quick presets</p>
                    <div className="image-preset-row">
                      <button
                        type="button"
                        className={!sizeTouched ? "active" : ""}
                        onClick={() => {
                          setSizeTouched(false);

                          if (referenceBase) {
                            setSize(referenceBase.width, referenceBase.height);
                          }
                        }}
                      >
                        Original
                      </button>
                      {SIZE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className={
                            sizeTouched &&
                            width === preset.width &&
                            height === preset.height
                              ? "active"
                              : ""
                          }
                          onClick={() => {
                            setSizeTouched(true);
                            setSize(preset.width, preset.height);
                          }}
                        >
                          {preset.label}
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
                      aria-label="Scale percent"
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

                    {aspect !== "original" && (
                      <FitChoice value={frameFit} onChange={setFrameFit} />
                    )}
                  </div>
                )}

                <div className="image-setting-group">
                  <h3>Transform</h3>
                  <div className="image-transform-row">
                    <button
                      type="button"
                      aria-label="Rotate left"
                      onClick={() => rotate(-90)}
                    >
                      <Icon name="rotate-left" />
                    </button>
                    <button
                      type="button"
                      aria-label="Rotate right"
                      onClick={() => rotate(90)}
                    >
                      <Icon name="rotate-right" />
                    </button>
                    <button
                      type="button"
                      className={flipH ? "active" : ""}
                      aria-label="Flip horizontal"
                      aria-pressed={flipH}
                      onClick={() => setFlipH((current) => !current)}
                    >
                      <Icon name="flip-h" />
                    </button>
                    <button
                      type="button"
                      className={flipV ? "active" : ""}
                      aria-label="Flip vertical"
                      aria-pressed={flipV}
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
                    {["ORIGINAL", "JPG", "PNG", "WEBP"].map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={format === item ? "active" : ""}
                        onClick={() => setFormat(item)}
                      >
                        {item === "WEBP" ? "WebP" : item === "ORIGINAL" ? "Original" : item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="image-setting-group">
                  <div className="image-title-row">
                    <h3>Quality</h3>
                    <strong>
                      {format === "PNG" ? "Full" : quality === 100 ? "Original (100%)" : `${quality}%`}
                    </strong>
                  </div>
                  <input
                    className="image-slider"
                    type="range"
                    min="40"
                    max="100"
                    value={quality}
                    aria-label="Quality"
                    disabled={format === "PNG"}
                    onChange={(event) => setQuality(Number(event.target.value))}
                    style={{ "--slider-fill": `${((quality - 40) / 60) * 100}%` }}
                  />
                  <div className="image-slider-labels">
                    <span>Smaller file</span>
                    <span>Original quality</span>
                  </div>
                  <p className="image-transform-note">
                    PNG is always lossless. Images you do not change are kept
                    exactly as uploaded.
                  </p>
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
              {...dropHandlers}
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
                            format={resolveFormat(format, image)}
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
                    onClick={openPicker}
                    disabled={isReading}
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

      {screen === "results" && images.length > 0 && (
        <ResultsPanel
          noun="image"
          items={resultItems}
          isProcessing={isProcessing}
          progress={processingProgress}
          statusMessage={processingLabel}
          errorMessage={message}
          selectedIds={selectedIds}
          onToggle={toggleSelected}
          onToggleAll={toggleSelectAll}
          onDownload={(id) => downloadOne(images.find((image) => image.id === id))}
          onRemove={removeImage}
          onZipSelected={() => downloadZip(selectedImages, "resizepro-selected.zip")}
          onZipAll={() => downloadZip(readyImages, "resizepro-images.zip")}
          onDownloadSeparately={() =>
            downloadSeparately(selectedImages.length ? selectedImages : readyImages)
          }
          zipping={zipping}
          onEdit={() => {
            setMessage("");
            setScreen("editor");
          }}
          onNewBatch={clearImages}
        />
      )}
    </main>
  );
}

export default ImageResizer;
