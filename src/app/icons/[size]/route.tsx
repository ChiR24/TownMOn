import { ImageResponse } from "next/og";

// PNG app icons for Android's install prompt, drawn from the same mark as icon.svg (full-bleed for "maskable").
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "512" ? 512 : 192;
  const u = size / 64;
  const box = (x: number, y: number, w: number, h: number, o: number, r = 2.5) => (
    <div style={{ position: "absolute", left: x * u, top: y * u, width: w * u, height: h * u, borderRadius: r * u, background: "white", opacity: o }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, position: "relative", display: "flex", background: "linear-gradient(135deg, #14897b, #0a4b43)" }}>
        <div style={{ position: "absolute", left: 41 * u, top: 13 * u, width: 10 * u, height: 10 * u, borderRadius: 999, background: "#f6c453" }} />
        {box(13, 29, 11, 21, 0.78)}
        {box(27, 17, 11, 33, 1)}
        {box(41, 31, 11, 19, 0.78)}
        {box(10, 50, 44, 3, 0.9, 1.5)}
      </div>
    ),
    { width: size, height: size },
  );
}
