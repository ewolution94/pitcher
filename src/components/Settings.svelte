<!--
  Settings, the family's way (plans/settings-alignment.md): Folio's ewo-sheet, General first with
  ewo-settings-basics (language, theme), then, with a keyboard, the keys. Opens from the header's
  settings button, or with `,`.
-->
<script lang="ts">
  import { setLanguage, t } from '../lib/i18n/index.svelte.ts';
  import { prefs, ui, type Language } from '../lib/prefs.svelte.ts';
  import { theme, type ThemePreference } from '../lib/theme.svelte.ts';

  const touchOnly = matchMedia('(hover: none)').matches;

  // The content stays until the sheet's `close`, which fires after its exit animation.
  let shown = $state(false);
  $effect(() => {
    if (ui.settings) shown = true;
  });

  function closed() {
    shown = false;
    ui.settings = false;
  }

  const keys: [string[], Parameters<typeof t>[0]][] = [
    [['Space'], 'keys.play'],
    [['←', '→'], 'keys.tempo'],
    [['↑', '↓'], 'keys.key'],
    [['R'], 'keys.mode'],
    [['0'], 'keys.reset'],
    [['K'], 'keys.kick'],
    [['L'], 'keys.loop'],
    [['H'], 'keys.hook'],
    [['O'], 'keys.hold'],
    [['−', '+'], 'keys.zoom'],
    [['[', ']'], 'keys.nudge'],
    [['T'], 'keys.tap'],
    [['/'], 'keys.link'],
    [[','], 'keys.settings'],
  ];
</script>

<ewo-sheet open={ui.settings} label={t('settings.title')} oncancel={() => (ui.settings = false)} onclose={closed}>
  <span slot="heading">{t('settings.title')}</span>

  {#if shown}
    <section>
      <h3 class="label">{t('settings.general')}</h3>
      <ewo-settings-basics
        language={prefs.language}
        theme={theme.preference}
        onlanguage-change={(e) => setLanguage(e.detail.value as Language)}
        ontheme-change={(e) => theme.set(e.detail.value as ThemePreference)}
      ></ewo-settings-basics>
    </section>

    {#if !touchOnly}
      <section class="keys">
        <h3 class="label">{t('settings.keys')}</h3>
        <dl>
          {#each keys as [caps, what] (what)}
            <div><dt>{#each caps as cap (cap)}<kbd>{cap}</kbd>{/each}</dt><dd>{t(what)}</dd></div>
          {/each}
        </dl>
      </section>
    {/if}
  {/if}
</ewo-sheet>

<style>
  section {
    display: grid;
    gap: 0.75rem;
    padding-block: 0.25rem 1.1rem;
  }

  section + section {
    padding-top: 1.1rem;
    border-top: 1px solid var(--ewo-line);
  }

  dl {
    display: grid;
    gap: 0.45rem;
    margin: 0;
  }

  dl > div {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  dt {
    display: flex;
    gap: 0.2rem;
  }

  dd {
    margin: 0;
    color: var(--ewo-fg-2);
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.3rem;
    border: 1px solid var(--ewo-line-strong);
    border-radius: 6px;
    font-family: var(--ewo-mono);
    font-size: 0.72rem;
    color: var(--ewo-fg-2);
  }
</style>
