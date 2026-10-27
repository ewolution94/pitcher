// The colours the canvases draw with. They're light-dark() pairs in app.css, which a custom property
// reads back unresolved, so each is resolved through a hidden element's `color`, again whenever the
// theme changes.

import { theme } from './theme.svelte.ts';

const NAMES = ['amber', 'amber-soft', 'low', 'mid', 'high', 'well', 'grid', 'grid-bar', 'dot', 'ewo-fg', 'ewo-fg-2', 'ewo-fg-3', 'ewo-bg', 'ewo-bg-raised', 'ewo-line'] as const;
export type ColourName = (typeof NAMES)[number];
export type Palette = Record<ColourName, string>;

function read(): Palette {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.append(probe);
  const out = {} as Palette;
  for (const name of NAMES) {
    probe.style.color = `var(--${name})`;
    out[name] = getComputedStyle(probe).color;
  }
  probe.remove();
  return out;
}

class Colours {
  current = $state.raw<Palette>(read());
}

export const colours = new Colours();

$effect.root(() => {
  $effect(() => {
    void theme.resolved;
    // After themeShift has applied the theme (it swaps under its veil 150 ms in).
    const timer = setTimeout(() => (colours.current = read()), 200);
    colours.current = read();
    return () => clearTimeout(timer);
  });
});

/** A colour with its alpha set, for gradients: "rgb(1 2 3)" or "rgba(1, 2, 3, 0.5)" in, rgba out. */
export function withAlpha(colour: string, alpha: number): string {
  const n = colour.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${alpha})`;
}
