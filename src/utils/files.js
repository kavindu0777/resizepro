// Shared download + ZIP helpers for the image and video tools.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// Bit 11 tells ZIP tools the file names are UTF-8.
// Without it, Sinhala, Tamil or emoji names show up garbled on Windows.
const UTF8_FLAG = 0x0800;

// Classic ZIP stores sizes in 32 bits. Stay well under 4 GB.
const MAX_ZIP_BYTES = 3.8 * 1024 * 1024 * 1024;

export function uniqueFileName(name, used) {
  if (!used.has(name.toLowerCase())) {
    used.add(name.toLowerCase());
    return name;
  }

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let index = 2;
  let next = `${base}-${index}${extension}`;

  while (used.has(next.toLowerCase())) {
    index += 1;
    next = `${base}-${index}${extension}`;
  }

  used.add(next.toLowerCase());
  return next;
}

/**
 * Build an uncompressed ("stored") ZIP. Images and videos are already
 * compressed, so deflating them again would only waste time.
 * @param {{ name: string, blob: Blob }[]} files
 */
export async function createZip(files) {
  const totalBytes = files.reduce((sum, file) => sum + file.blob.size, 0);

  if (totalBytes > MAX_ZIP_BYTES) {
    throw new Error(
      "These files are too large for one ZIP. Download them separately instead."
    );
  }

  const encoder = new TextEncoder();
  const parts = [];
  const centralParts = [];
  const used = new Set();
  const stamp = dosDateTime(new Date());
  let offset = 0;

  for (const file of files) {
    const name = uniqueFileName(file.name, used);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const nameBytes = encoder.encode(name);
    const checksum = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, UTF8_FLAG, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, stamp.time, true);
    localView.setUint16(12, stamp.day, true);
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
    centralView.setUint16(8, UTF8_FLAG, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.day, true);
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

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
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

export function downloadUrl(url, name) {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, name);
  // Give the browser time to start the download before freeing the memory.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Trigger several downloads one after another.
 * Chrome asks once for permission to download multiple files.
 */
export function downloadMany(items, gap = 400) {
  items.forEach((item, index) => {
    window.setTimeout(() => downloadUrl(item.url, item.name), index * gap);
  });
}

export function makeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    // randomUUID only exists on HTTPS and localhost.
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
