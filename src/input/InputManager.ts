import { clamp, radialDeadzone } from "../core/math.ts";
import { EMPTY_INTENT, type GameIntent } from "../core/simulation.ts";

type DualRumbleActuator = {
  playEffect?: (type: "dual-rumble", options: {
    duration: number;
    startDelay: number;
    strongMagnitude: number;
    weakMagnitude: number;
  }) => Promise<unknown>;
};

export type InputSettings = {
  deadzone: number;
  vibration: number;
  cameraSensitivity: number;
  invertY: boolean;
};

export type MenuAction = "confirm" | "back" | "pause" | "up" | "down" | "left" | "right";

const DEFAULT_SETTINGS: InputSettings = {
  deadzone: 0.16,
  vibration: 0.72,
  cameraSensitivity: 1,
  invertY: false,
};

export class InputManager {
  settings: InputSettings = { ...DEFAULT_SETTINGS };
  private keys = new Set<string>();
  private pressedKeys = new Set<string>();
  private releasedKeys = new Set<string>();
  private previousButtons = new Set<number>();
  private currentPad: Gamepad | null = null;
  private menuQueue = new Set<MenuAction>();
  private axisLatch = { x: 0, y: 0 };
  private lastPulseAt = 0;
  private devFallback = new URLSearchParams(window.location.search).has("dev");

  constructor() {
    window.addEventListener("keydown", event => {
      const key = event.key.toLowerCase();
      if (!this.keys.has(key)) this.pressedKeys.add(key);
      this.keys.add(key);
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
    });
    window.addEventListener("keyup", event => {
      const key = event.key.toLowerCase();
      this.keys.delete(key);
      this.releasedKeys.add(key);
    });
    const clear = () => this.clearTransient();
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clear(); });
    window.addEventListener("gamepaddisconnected", clear);
  }

  get connected(): boolean {
    return Boolean(this.currentPad?.connected);
  }

  get compatible(): boolean {
    return Boolean(this.currentPad && isDualSenseId(this.currentPad.id));
  }

  get gamepadName(): string {
    return this.currentPad?.id ?? "DualSense não conectado";
  }

  get usingDevFallback(): boolean {
    return this.devFallback && !this.compatible;
  }

  setSettings(settings: Partial<InputSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  poll(): GameIntent {
    const pads = Array.from(navigator.getGamepads?.() ?? []).filter((candidate): candidate is Gamepad => Boolean(candidate?.connected));
    const pad = pads.find(candidate => isDualSenseId(candidate.id)) ?? pads[0] ?? null;
    this.currentPad = pad;
    const buttons = new Set<number>();
    pad?.buttons.forEach((button, index) => {
      if (button.pressed || button.value > 0.52) buttons.add(index);
    });
    const justPressed = (index: number) => buttons.has(index) && !this.previousButtons.has(index);
    const justReleased = (index: number) => !buttons.has(index) && this.previousButtons.has(index);
    const movement = pad
      ? radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, this.settings.deadzone)
      : { x: 0, y: 0 };
    const look = pad
      ? radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0, this.settings.deadzone)
      : { x: 0, y: 0 };

    if (justPressed(0)) this.menuQueue.add("confirm");
    if (justPressed(1)) this.menuQueue.add("back");
    if (justPressed(9)) this.menuQueue.add("pause");
    this.updateMenuAxis(movement.x, movement.y);
    if (justPressed(12)) this.menuQueue.add("up");
    if (justPressed(13)) this.menuQueue.add("down");
    if (justPressed(14)) this.menuQueue.add("left");
    if (justPressed(15)) this.menuQueue.add("right");

    let intent: GameIntent = { ...EMPTY_INTENT };
    if (pad) {
      intent = {
        steer: movement.x,
        look: look.x * this.settings.cameraSensitivity,
        tuck: pad.buttons[7]?.value ?? 0,
        brake: pad.buttons[6]?.value ?? 0,
        jumpHeld: buttons.has(0),
        jumpPressed: justPressed(0),
        jumpReleased: justReleased(0),
        grabHeld: buttons.has(2),
        spinLeft: buttons.has(4),
        spinRight: buttons.has(5),
        flipHeld: buttons.has(3),
        recoverHeld: buttons.has(1),
        itemPressed: justPressed(11),
      };
    } else if (this.devFallback) {
      intent = this.keyboardIntent();
    }
    this.previousButtons = buttons;
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    return intent;
  }

  consumeMenu(action: MenuAction): boolean {
    if (!this.menuQueue.has(action)) return false;
    this.menuQueue.delete(action);
    return true;
  }

  consumeAnyDirection(): MenuAction | null {
    for (const action of ["up", "down", "left", "right"] as const) {
      if (this.consumeMenu(action)) return action;
    }
    return null;
  }

  pulse(strong: number, weak: number, duration: number, cooldown = 45): void {
    const now = performance.now();
    if (now - this.lastPulseAt < cooldown || this.settings.vibration <= 0) return;
    this.lastPulseAt = now;
    const actuator = (this.currentPad as (Gamepad & { vibrationActuator?: DualRumbleActuator }) | null)?.vibrationActuator;
    void actuator?.playEffect?.("dual-rumble", {
      duration,
      startDelay: 0,
      strongMagnitude: clamp(strong * this.settings.vibration, 0, 1),
      weakMagnitude: clamp(weak * this.settings.vibration, 0, 1),
    }).catch(() => undefined);
  }

  private keyboardIntent(): GameIntent {
    const steer = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft"));
    return {
      steer,
      look: 0,
      tuck: this.keys.has("shift") ? 1 : 0,
      brake: this.keys.has("control") || this.keys.has("s") ? 1 : 0,
      jumpHeld: this.keys.has(" "),
      jumpPressed: this.pressedKeys.has(" "),
      jumpReleased: this.releasedKeys.has(" "),
      grabHeld: this.keys.has("f"),
      spinLeft: this.keys.has("q"),
      spinRight: this.keys.has("e"),
      flipHeld: this.keys.has("c"),
      recoverHeld: this.keys.has("x"),
      itemPressed: this.pressedKeys.has("r"),
    };
  }

  private updateMenuAxis(x: number, y: number): void {
    const nextX = Math.abs(x) > 0.62 ? Math.sign(x) : 0;
    const nextY = Math.abs(y) > 0.62 ? Math.sign(y) : 0;
    if (nextX !== 0 && nextX !== this.axisLatch.x) this.menuQueue.add(nextX > 0 ? "right" : "left");
    if (nextY !== 0 && nextY !== this.axisLatch.y) this.menuQueue.add(nextY > 0 ? "down" : "up");
    this.axisLatch = { x: nextX, y: nextY };
  }

  private clearTransient(): void {
    this.keys.clear();
    this.pressedKeys.clear();
    this.releasedKeys.clear();
    this.previousButtons.clear();
    this.menuQueue.clear();
    this.axisLatch = { x: 0, y: 0 };
  }
}

export function isDualSenseId(id: string): boolean {
  return /dualsense|054c[^\n]*(0ce6|0df2)/i.test(id);
}
