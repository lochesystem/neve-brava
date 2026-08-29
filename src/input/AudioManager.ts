import type { GameEvent, RiderState } from "../core/simulation.ts";
import { clamp } from "../core/math.ts";

export function courseMusicPath(order: number, base = import.meta.env.BASE_URL): string {
  const safeOrder = Math.round(clamp(order, 1, 4));
  return `${base}audio/track-${safeOrder}.mp3`;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private musicVolume = 0.38;
  private courseOrder = 1;

  setCourseTrack(order: number): void {
    const nextOrder = Math.round(clamp(order, 1, 4));
    if (nextOrder === this.courseOrder && this.music) return;
    this.courseOrder = nextOrder;
    if (!this.music) return;
    this.music.pause();
    this.music.src = courseMusicPath(this.courseOrder);
    this.music.currentTime = 0;
    this.music.load();
    if (this.context?.state === "running") void this.music.play().catch(() => undefined);
  }

  start(): void {
    if (this.context) {
      void this.context.resume();
      void this.music?.play().catch(() => undefined);
      return;
    }
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.62;
    master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 380;
    filter.Q.value = 0.52;
    const gain = context.createGain();
    gain.gain.value = 0;
    noise.connect(filter).connect(gain).connect(master);
    noise.start();

    const music = new Audio(courseMusicPath(this.courseOrder));
    music.loop = true;
    music.preload = "auto";
    const musicSource = context.createMediaElementSource(music);
    const musicGain = context.createGain();
    musicGain.gain.value = this.musicVolume;
    musicSource.connect(musicGain).connect(master);
    void music.play().catch(() => undefined);

    this.context = context;
    this.master = master;
    this.windGain = gain;
    this.windFilter = filter;
    this.music = music;
    this.musicGain = musicGain;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume, 0, 1);
    if (this.musicGain && this.context) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.context.currentTime, 0.04);
    }
  }

  update(state: RiderState): void {
    if (!this.context || !this.windGain || !this.windFilter) return;
    const speed = clamp((state.speed - 10) / 32, 0, 1);
    const now = this.context.currentTime;
    this.windGain.gain.setTargetAtTime(0.004 + speed * 0.038, now, 0.14);
    this.windFilter.frequency.setTargetAtTime(210 + speed * 920, now, 0.12);
  }

  event(event: GameEvent): void {
    if (!this.context || !this.master) return;
    const profiles: Partial<Record<GameEvent["type"], [number, number, number]>> = {
      TAKEOFF: [260, 620, 0.16],
      LAND: [180, 90, 0.18],
      NEAR_MISS: [760, 1_100, 0.12],
      CRASH: [130, 48, 0.28],
      SECTION: [440, 660, 0.18],
      COIN: [720, 1_180, .1],
      ITEM_ACQUIRED: [360, 920, .2],
      ITEM_BOX_BLOCKED: [120, 62, .2],
      ITEM_USED: [280, 1_080, .24],
      SHIELD_BREAK: [980, 260, .24],
      FINISH: [520, 1_040, 0.38],
    };
    const profile = profiles[event.type];
    if (!profile) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = event.type === "CRASH" ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(profile[0], this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(profile[1], this.context.currentTime + profile[2]);
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(event.type === "CRASH" ? 0.18 : 0.1, this.context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + profile[2]);
    oscillator.connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + profile[2] + 0.03);
  }
}
