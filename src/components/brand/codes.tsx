import { hashString, mulberry32 } from "@/lib/utils";

// Deterministic, decorative 1D barcode (not machine-scannable - demo only).
export function Barcode({ value, className }: { value: string; className?: string }) {
  const rand = mulberry32(hashString(value));
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  while (x < 160) {
    const w = 1 + Math.floor(rand() * 3);
    const gap = 1 + Math.floor(rand() * 2);
    bars.push({ x, w });
    x += w + gap;
  }
  return (
    <div className={className}>
      <svg viewBox="0 0 160 44" className="h-11 w-full" preserveAspectRatio="none">
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={0} width={b.w} height={44} fill="hsl(200 18% 14%)" />
        ))}
      </svg>
      <div className="mt-1 text-center font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

// Deterministic, decorative QR-style matrix with corner finder patterns.
export function QrTag({ value, size = 96 }: { value: string; size?: number }) {
  const n = 21;
  const cell = size / n;
  const rand = mulberry32(hashString(value) ^ 0x5f3759df);

  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) =>
      r >= br && r < br + 7 && c >= bc && c < bc + 7;
    return inBox(0, 0) || inBox(0, n - 7) || inBox(n - 7, 0);
  };
  const finderOn = (r: number, c: number) => {
    const local = (br: number, bc: number) => {
      const rr = r - br;
      const cc = c - bc;
      if (rr === 0 || rr === 6 || cc === 0 || cc === 6) return true; // outer ring
      if (rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4) return true; // inner block
      return false;
    };
    if (r < 7 && c < 7) return local(0, 0);
    if (r < 7 && c >= n - 7) return local(0, n - 7);
    if (r >= n - 7 && c < 7) return local(n - 7, 0);
    return false;
  };

  const modules: { r: number; c: number }[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const on = isFinder(r, c) ? finderOn(r, c) : rand() > 0.55;
      if (on) modules.push({ r, c });
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-md">
      <rect width={size} height={size} fill="white" />
      {modules.map((m, i) => (
        <rect
          key={i}
          x={m.c * cell}
          y={m.r * cell}
          width={cell}
          height={cell}
          fill="hsl(200 18% 14%)"
        />
      ))}
    </svg>
  );
}
