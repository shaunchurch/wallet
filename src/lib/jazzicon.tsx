// Deterministic SVG avatar from Ethereum address -- hand-rolled, no dependency.

const PALETTE = [
  '#01888C',
  '#FC7500',
  '#034F5D',
  '#F73F01',
  '#FC1960',
  '#C7144C',
  '#F3C100',
  '#1598F2',
  '#2465E1',
  '#F19E02',
];

function addressToSeed(address: string): number {
  return Number.parseInt(address.slice(2, 10), 16);
}

function createPrng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// --- Color helpers ---

function hexToHsl(hex: string): [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function shiftHue(hexColor: string, degrees: number): string {
  const [h, s, l] = hexToHsl(hexColor);
  return hslToHex(h + degrees, s, l);
}

export function Jazzicon({ address, size = 32 }: { address: string; size?: number }) {
  const seed = addressToSeed(address);
  const rand = createPrng(seed);
  const hueShift = rand() * 360;

  const colors = PALETTE.map((c) => shiftHue(c, hueShift));
  const bgIdx = Math.floor(rand() * colors.length);
  const bg = colors[bgIdx] as string;
  const clipId = `jz-${seed}`;

  const rects = Array.from({ length: 4 }, () => {
    const color = colors[Math.floor(rand() * colors.length)] as string;
    const x = rand() * size;
    const y = rand() * size;
    const w = size * (rand() * 0.6 + 0.2);
    const h = size * (rand() * 0.6 + 0.2);
    const rot = rand() * 360;
    return { color, x, y, w, h, rot };
  });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={size / 2} cy={size / 2} r={size / 2} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={size} height={size} fill={bg} />
        {rects.map((r, i) => (
          <rect
            key={`${clipId}-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={r.color}
            transform={`rotate(${r.rot} ${r.x + r.w / 2} ${r.y + r.h / 2})`}
          />
        ))}
      </g>
    </svg>
  );
}
