import { ImageResponse } from "next/og";

// PNG app icons for Android's install prompt, drawn from the same mark as icon.svg (full-bleed for "maskable").
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "512" ? 512 : 192;
  const u = size / 64;
  const box = (x: number, y: number, w: number, h: number, color: string, o = 1, r = 2.5) => (
    <div style={{ position: "absolute", left: x * u, top: y * u, width: w * u, height: h * u, borderRadius: r * u, background: color, opacity: o }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, position: "relative", display: "flex", background: "#121212" }}>
        <div style={{ position: "absolute", left: 40 * u, top: 12 * u, width: 12 * u, height: 12 * u, borderRadius: 999, background: "#c8f26d" }} />
        {box(13, 29, 11, 21, "white", 0.72)}
        {box(27, 17, 11, 33, "white")}
        {box(41, 31, 11, 19, "white", 0.72)}
        {box(10, 50, 44, 3, "#c8f26d", 1, 1.5)}
      </div>
    ),
    { width: size, height: size },
  );
}
