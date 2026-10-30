// The thumbnail's hue, for the header's tint: the picture's colours averaged round the colour wheel,
// weighted by how vivid each is, then set vivid and mid-light, so it reads as a hue in either theme
// rather than as the picture's mud. Thumbnails come through the relay, same origin, so the canvas
// stays readable.

/** An `hsl()` colour, or null for a picture with next to no colour in it. */
export async function tintOf(url: string): Promise<string | null> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const x = canvas.getContext('2d', { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, size, size);
  const data = x.getImageData(0, 0, size, size).data;

  let sx = 0, sy = 0, weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), chroma = max - min;
    if (chroma < 0.08) continue;
    const hue = max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    const angle = (hue / 6) * Math.PI * 2;
    // Vivid and not too dark counts most.
    const w = chroma * max;
    sx += Math.cos(angle) * w;
    sy += Math.sin(angle) * w;
    weight += w;
  }
  if (weight / (size * size) < 0.02) return null;
  const hue = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
  return `hsl(${Math.round(hue)} 72% 56%)`;
}
