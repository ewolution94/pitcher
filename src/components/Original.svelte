<!--
  Hold to hear the original: a pill on the stage, lit while it's held (by pointer, Space or Enter on
  it, or the O key anywhere).
-->
<script lang="ts">
  import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  /** A long press on iOS selects text and opens its callout; claiming the touch keeps it a hold. Svelte
      makes touchstart passive, so this one is added by hand. */
  function claimTouch(node: HTMLElement) {
    const claim = (event: TouchEvent) => event.preventDefault();
    node.addEventListener('touchstart', claim, { passive: false });
    return () => node.removeEventListener('touchstart', claim);
  }

  function holdStart(event: PointerEvent) {
    if (event.button > 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    session.hold(true);
  }
</script>

<button
  type="button"
  class="hold"
  class:on={session.orig}
  title={t('transport.holdTitle')}
  {@attach claimTouch}
  onpointerdown={holdStart}
  onpointerup={() => session.hold(false)}
  onpointercancel={() => session.hold(false)}
  onlostpointercapture={() => session.hold(false)}
  oncontextmenu={(e) => e.preventDefault()}
  onkeydown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), session.hold(true))}
  onkeyup={(e) => (e.key === ' ' || e.key === 'Enter') && session.hold(false)}
>
  <AudioWaveform size={16} />
  <span class="long">{t('transport.hold')}</span>
  <span class="short">{t('transport.holdShort')}</span>
</button>

<style>
  .hold {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 16px 0 13px;
    border-radius: 19px;
    border: 1px solid var(--ewo-line-strong);
    background: color-mix(in oklab, var(--well) 86%, transparent);
    color: var(--ewo-fg);
    font-size: 13px;
    font-weight: 650;
    white-space: nowrap;
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* Hover only with a mouse: a touch screen keeps :hover on what was tapped last. */
  @media (hover: hover) and (pointer: fine) {
    .hold:hover {
      border-color: var(--ewo-fg-3);
    }
  }

  .hold.on {
    border-color: var(--amber);
    background: var(--amber);
    color: var(--amber-ink);
  }

  .short {
    display: none;
  }

  @media (max-width: 759.98px) {
    .hold {
      height: 36px;
      padding: 0 14px 0 11px;
    }

    .long {
      display: none;
    }

    .short {
      display: inline;
    }
  }
</style>
