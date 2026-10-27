// signalsmith-stretch ships no types; the node it resolves to is typed in src/lib/audio/engine.ts.
declare module 'signalsmith-stretch' {
  export default function SignalsmithStretch(context: BaseAudioContext, options?: AudioWorkletNodeOptions): Promise<AudioWorkletNode>;
}
