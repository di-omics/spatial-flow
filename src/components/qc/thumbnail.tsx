import { hashString, mulberry32 } from "@/lib/utils";
import { MIF_CHANNELS } from "@/lib/constants";

// Procedurally-generated placeholder "tissue" tiles - no real histology.
// Built from layered CSS radial gradients so ~130 can render cheaply.
function buildBackground(
  seed: string,
  assay: string,
  channels: string[]
): string {
  const rand = mulberry32(hashString(seed));
  const layers: string[] = [];

  if (assay === "mIF") {
    for (const ch of MIF_CHANNELS) {
      if (!channels.includes(ch.key)) continue;
      const blobs = ch.key === "DAPI" ? 5 : 3;
      for (let i = 0; i < blobs; i++) {
        const x = Math.round(rand() * 100);
        const y = Math.round(rand() * 100);
        const r = 18 + Math.round(rand() * 26);
        layers.push(
          `radial-gradient(circle at ${x}% ${y}%, ${ch.color}dd 0%, ${ch.color}55 ${r * 0.5}%, transparent ${r}%)`
        );
      }
    }
    layers.push("radial-gradient(circle at 50% 50%, #0b1220, #05070d)");
    return layers.join(", ");
  }

  if (assay === "H_AND_E") {
    for (let i = 0; i < 12; i++) {
      const x = Math.round(rand() * 100);
      const y = Math.round(rand() * 100);
      const s = 1 + Math.round(rand() * 2);
      layers.push(
        `radial-gradient(circle at ${x}% ${y}%, #6d2f5f 0 ${s}px, transparent ${s + 2}px)`
      );
    }
    layers.push("linear-gradient(135deg, #f3d3e4 0%, #e3aec8 55%, #d98fb6 100%)");
    return layers.join(", ");
  }

  // SPATIAL_TX - speckled transcripts on dark background.
  const palette = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24", "#818cf8"];
  for (let i = 0; i < 22; i++) {
    const x = Math.round(rand() * 100);
    const y = Math.round(rand() * 100);
    const color = palette[Math.floor(rand() * palette.length)];
    layers.push(`radial-gradient(circle at ${x}% ${y}%, ${color} 0 1.5px, transparent 2.5px)`);
  }
  layers.push("radial-gradient(circle at 50% 50%, #10131c, #070810)");
  return layers.join(", ");
}

export function CoreThumbnail({
  seed,
  assay,
  channels,
  className = "",
}: {
  seed: string;
  assay: string;
  channels?: string[];
  className?: string;
}) {
  const chans = channels ?? MIF_CHANNELS.map((c) => c.key);
  return (
    <div
      className={`overflow-hidden rounded-md ${className}`}
      style={{ background: buildBackground(seed, assay, chans), backgroundBlendMode: "screen" }}
    />
  );
}
