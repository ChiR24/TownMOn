import { ImageResponse } from "next/og";

// PNG app icons for Android's install prompt, drawn from the same mark as icon.svg.
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = (await params).size === "512" ? 512 : 192;
  const u = size / 64;
  const bar = (x: number, y: number, h: number, o: number) => (
    <div style={{ position: "absolute", left: x * u, top: y * u, width: 10 * u, height: h * u, borderRadius: 2 * u, background: "white", opacity: o }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0f766e", position: "relative", display: "flex" }}>
        {bar(14, 27, 23, 0.8)}
        {bar(27, 14, 36, 1)}
        {bar(40, 22, 28, 0.8)}
      </div>
    ),
    { width: size, height: size },
  );
}
