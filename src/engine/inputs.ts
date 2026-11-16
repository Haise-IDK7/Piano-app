// Fuentes de entrada: micrófono, MIDI y teclado del PC.
import { FRAME, MicTracker, type TrackerOptions, type TrackerOutput } from './pitch';

export class MicInput {
  tracker: MicTracker | null = null;
  running = false;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = new Float32Array(FRAME);
  private gen = 0;
  onOutput: ((o: TrackerOutput, tracker: MicTracker, tMs: number) => void) | null = null;

  constructor(private ctx: AudioContext, private opts: TrackerOptions) {}

  setOptions(opts: TrackerOptions): void { this.opts = opts; if (this.tracker) this.tracker.opts = opts; }

  async start(deviceId?: string): Promise<void> {
    this.stop();
    const gen = this.gen;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        // Estos filtros alteran el timbre y estropean la detección de notas.
        echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1,
      },
    });
    if (gen !== this.gen) { stream.getTracks().forEach((t) => t.stop()); return; } // se canceló mientras se abría
    this.stream = stream;
    if (this.ctx.state !== 'running') void this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FRAME;
    this.source.connect(this.analyser); // no se conecta a los altavoces
    this.tracker = new MicTracker(this.ctx.sampleRate, this.opts);
    this.running = true;
    this.timer = setInterval(() => {
      if (!this.analyser || !this.tracker) return;
      this.analyser.getFloatTimeDomainData(this.frame);
      const t = performance.now();
      const out = this.tracker.process(this.frame, t);
      this.onOutput?.(out, this.tracker, t);
    }, 25);
  }

  stop(): void {
    this.gen++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.source?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.source = null; this.analyser = null; this.tracker = null;
    this.running = false;
  }

  static async devices(): Promise<MediaDeviceInfo[]> {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'); }
    catch { return []; }
  }
}

export class MidiInput {
  private access: MIDIAccess | null = null;
  onNoteOn: ((midi: number) => void) | null = null;
  onNoteOff: ((midi: number) => void) | null = null;
  names: string[] = [];

  async start(): Promise<string[]> {
    if (!navigator.requestMIDIAccess) throw new Error('Este equipo no ofrece Web MIDI.');
    this.access = await navigator.requestMIDIAccess();
    const bind = () => {
      this.names = [];
      this.access!.inputs.forEach((inp) => {
        this.names.push(inp.name ?? 'MIDI');
        inp.onmidimessage = (e) => {
          const d = e.data;
          if (!d || d.length < 3) return;
          const cmd = d[0] & 0xf0;
          if (cmd === 0x90 && d[2] > 0) this.onNoteOn?.(d[1]);
          else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) this.onNoteOff?.(d[1]);
        };
      });
    };
    bind();
    this.access.onstatechange = bind;
    return this.names;
  }

  stop(): void {
    this.access?.inputs.forEach((inp) => { inp.onmidimessage = null; });
    this.access = null;
  }
}

/** Teclado del PC → semitonos desde Do: A W S E D F T G Y H U J K. Z/X cambian de octava. */
export const PC_KEYS: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12,
};
