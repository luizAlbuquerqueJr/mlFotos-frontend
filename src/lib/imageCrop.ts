export type CropAreaPixels = {
  width: number;
  height: number;
  x: number;
  y: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export canvas"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

export async function cropImageFile(inputFile: File, crop: CropAreaPixels): Promise<File> {
  const objectUrl = URL.createObjectURL(inputFile);
  try {
    const image = await loadImage(objectUrl);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(crop.width));
    canvas.height = Math.max(1, Math.round(crop.height));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context not available");
    }

    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );

    const outputType = inputFile.type && inputFile.type.startsWith("image/") ? inputFile.type : "image/jpeg";
    const blob = await canvasToBlob(canvas, outputType, outputType === "image/jpeg" ? 0.92 : undefined);

    const nameParts = inputFile.name.split(".");
    const ext = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const baseName = ext ? inputFile.name.slice(0, -(ext.length + 1)) : inputFile.name;
    const outputName = `${baseName}-cropped${ext ? "." + ext : ""}`;

    return new File([blob], outputName, { type: outputType, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
