// Runs in the browser. Phone photos are 3-5 MB; residents and gate tablets are on weak data, so we send
// ~150 KB instead. For gate photos, levels are stretched so faces taken at night are readable.

/** The largest photo the server keeps (photos.ts). A photo that can't be shrunk is only sent if it fits. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function shrinkPhoto(file: File, { max = 1280, quality = 0.78, brighten = false } = {}): Promise<File> {
  // Phones store portrait shots sideways plus an EXIF "rotate" tag. "from-image" applies it; browsers from before
  // that value existed reject it, so they get their own default instead of failing.
  const img = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close(); // a 12 MP bitmap holds ~48 MB: free it now, not at the next garbage collection
  if (brighten) autoLevels(ctx, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** Stretches the darkest 1% to black and the brightest 1% to white: a dim night photo becomes legible. */
function autoLevels(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) hist[(px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8]++;
  const total = px.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
  if (hi - lo < 40 || (lo < 8 && hi > 247)) return; // already well exposed, or a flat image: leave it
  const k = 255 / (hi - lo);
  for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, (px[i + c] - lo) * k));
  ctx.putImageData(data, 0, 0);
}
