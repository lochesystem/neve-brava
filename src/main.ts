import "./styles.css";
import {
  COURSES, COURSE_LENGTH, courseCenterX, getActiveCourse, setActiveCourse, validateAllCourses,
  type CourseDefinition,
} from "./core/course.ts";
import { createRider, interpolateRider, updateRider, type GameEvent, type RiderState } from "./core/simulation.ts";
import { createRival, interpolateRival, resolveRiderContact, updateRival, type RivalEvent, type RivalState } from "./core/rival.ts";
import { InputManager, type MenuAction } from "./input/InputManager.ts";
import { AudioManager } from "./input/AudioManager.ts";
import { GameView, type Quality } from "./view/GameView.ts";

type Screen = "title" | "campaign" | "playing" | "paused" | "results" | "settings";
type MapProjection = { minX: number; spanX: number; startX: number; finishX: number };

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const hud = document.querySelector<HTMLElement>("#hud")!;
const menu = document.querySelector<HTMLElement>("#menu")!;
const titleScreen = document.querySelector<HTMLElement>("#title-screen")!;
const campaignScreen = document.querySelector<HTMLElement>("#campaign-screen")!;
const pauseScreen = document.querySelector<HTMLElement>("#pause-screen")!;
const resultsScreen = document.querySelector<HTMLElement>("#results-screen")!;
const settingsScreen = document.querySelector<HTMLElement>("#settings-screen")!;
const input = new InputManager();
const audio = new AudioManager();
const view = new GameView(canvas);
const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

let state: RiderState = createRider();
let previousRider: RiderState = { ...state };
let rival: RivalState = createRival();
let previousRival: RivalState = { ...rival };
let screen: Screen = "title";
let settingsReturn: Screen = "title";
let selectedCourseIndex = 0;
let accumulator = 0;
let previousTime = performance.now();
let countdown = 3.35;
let toastTimer = 0;
let hudTimer = 0;
let disconnectedPause = false;
let lastIntentLook = 0;
let mapProjection: MapProjection = { minX: 0, spanX: 1, startX: 90, finishX: 90 };
const fixedStep = 1 / 60;

const speedLabel = $("#speed");
const sectionLabel = $("#section");
const timeLabel = $("#time");
const scoreLabel = $("#score");
const comboLabel = $("#combo");
const toast = $("#toast");
const countdownLabel = $("#countdown");
const startButton = $("#start-button") as HTMLButtonElement;
const controllerCard = $("#controller-card");
const controllerName = $("#controller-name");
const pauseTitle = $("#pause-title");
const pauseCopy = $("#pause-copy");
const mapLine = document.querySelector<SVGPathElement>("#course-map-line")!;
const mapShadow = document.querySelector<SVGPathElement>("#course-map-shadow")!;
const mapMarker = document.querySelector<SVGGElement>("#course-map-marker")!;
const mapRival = document.querySelector<SVGGElement>("#course-map-rival")!;
const mapStart = document.querySelector<SVGCircleElement>(".map-start")!;
const mapFinish = document.querySelector<SVGPathElement>(".map-finish")!;

function centerFor(course: CourseDefinition, s: number): number {
  const progress = Math.min(course.length, Math.max(0, s));
  return course.curveWaves.reduce((sum, wave) => sum + Math.sin(progress * wave.frequency + wave.phase) * wave.amplitude, 0);
}

function mapGeometry(course: CourseDefinition, width: number, height: number, padding: number): { path: string; projection: MapProjection } {
  const samples = Array.from({ length: 161 }, (_, index) => ({ s: index / 160 * course.length, x: centerFor(course, index / 160 * course.length) }));
  const minX = Math.min(...samples.map(point => point.x)) - course.halfWidth * .7;
  const maxX = Math.max(...samples.map(point => point.x)) + course.halfWidth * .7;
  const spanX = Math.max(1, maxX - minX);
  const projectX = (x: number) => padding + (x - minX) / spanX * (width - padding * 2);
  const projectY = (s: number) => padding + s / course.length * (height - padding * 2);
  return {
    path: samples.map((point, index) => `${index ? "L" : "M"}${projectX(point.x).toFixed(1)} ${projectY(point.s).toFixed(1)}`).join(" "),
    projection: { minX, spanX, startX: projectX(samples[0].x), finishX: projectX(samples[samples.length - 1].x) },
  };
}

function previewPath(course: CourseDefinition): string {
  return mapGeometry(course, 180, 150, 15).path;
}

function renderTrackCards(): void {
  const grid = $("#track-grid");
  grid.innerHTML = COURSES.map((course, index) => `
    <button class="track-card focusable ${index === selectedCourseIndex ? "selected" : ""}" data-track-index="${index}" type="button">
      <span class="track-card-number"><b>ETAPA ${String(course.order).padStart(2, "0")}</b><em>${course.difficulty}</em></span>
      <h3>${course.name}</h3><small>${course.subtitle}</small>
      <svg class="track-preview" viewBox="0 0 180 150" aria-hidden="true"><path d="${previewPath(course)}"></path><path d="${previewPath(course)}"></path></svg>
      <p>${course.description}</p>
    </button>`).join("");
  grid.querySelectorAll<HTMLButtonElement>("[data-track-index]").forEach(button => button.addEventListener("click", () => {
    selectedCourseIndex = Number(button.dataset.trackIndex);
    renderTrackCards();
    updateSelectedCourseCopy();
    window.setTimeout(() => grid.querySelector<HTMLButtonElement>(`[data-track-index="${selectedCourseIndex}"]`)?.focus(), 0);
  }));
}

function updateSelectedCourseCopy(): void {
  const course = COURSES[selectedCourseIndex];
  $("#selected-track-name").textContent = course.name;
  $("#selected-track-copy").textContent = `${course.subtitle} · ${course.difficulty} · ${(course.length / 1_000).toFixed(1)} km`;
}

function buildRaceMap(): void {
  const course = getActiveCourse();
  const map = mapGeometry(course, 180, 520, 24);
  mapProjection = map.projection;
  mapLine.setAttribute("d", map.path);
  mapShadow.setAttribute("d", map.path);
  mapStart.setAttribute("cx", mapProjection.startX.toFixed(1));
  mapFinish.setAttribute("transform", `translate(${(mapProjection.finishX - 90).toFixed(1)} 0)`);
  $("#map-course-number").textContent = `PISTA ${String(course.order).padStart(2, "0")}`;
  $("#map-course-name").textContent = course.name;
}

function markerTransform(progress: number, lateral: number, heading: number): string {
  const x = 24 + (courseCenterX(progress) + lateral - mapProjection.minX) / mapProjection.spanX * 132;
  const y = 24 + Math.min(1, Math.max(0, progress / COURSE_LENGTH)) * 472;
  return `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(-heading * 35).toFixed(1)})`;
}

function updateMapMarker(): void {
  mapMarker.setAttribute("transform", markerTransform(state.s, state.x, state.heading));
  mapRival.setAttribute("transform", markerTransform(rival.s, rival.x, rival.heading));
  $("#race-position").innerHTML = `${rival.s > state.s + .35 ? "2º" : "1º"} <i>/ 2</i>`;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60), remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(2).padStart(5, "0")}`;
}

function showScreen(next: Screen): void {
  screen = next;
  titleScreen.classList.toggle("hidden", next !== "title");
  campaignScreen.classList.toggle("hidden", next !== "campaign");
  pauseScreen.classList.toggle("hidden", next !== "paused");
  resultsScreen.classList.toggle("hidden", next !== "results");
  settingsScreen.classList.toggle("hidden", next !== "settings");
  menu.classList.toggle("hidden", next === "playing");
  hud.classList.toggle("hidden", !["playing", "paused"].includes(next));
  window.setTimeout(focusFirst, 30);
}

function openCampaign(): void {
  renderTrackCards();
  updateSelectedCourseCopy();
  showScreen("campaign");
}

function startRun(): void {
  if (!input.compatible && !input.usingDevFallback) return;
  const course = setActiveCourse(COURSES[selectedCourseIndex].id);
  view.rebuildCourse();
  audio.setCourseTrack(course.order);
  document.documentElement.dataset.musicTrack = String(course.order);
  audio.start();
  state = createRider();
  previousRider = { ...state };
  rival = createRival();
  previousRival = { ...rival };
  accumulator = 0;
  countdown = 3.35;
  disconnectedPause = false;
  buildRaceMap();
  sectionLabel.textContent = course.sections[0].name;
  updateHud(true);
  showScreen("playing");
  input.pulse(.3, .55, 90);
}

function pause(disconnected = false): void {
  if (screen !== "playing") return;
  disconnectedPause = disconnected;
  pauseTitle.textContent = disconnected ? "Controle desconectado" : "Pausado";
  pauseCopy.textContent = disconnected ? "Reconecte o DualSense e pressione ✕ para continuar." : "Respire. A linha continua logo ali.";
  ($("#resume-button") as HTMLButtonElement).disabled = disconnected;
  showScreen("paused");
}

function resume(): void {
  if (disconnectedPause && !input.connected) return;
  disconnectedPause = false;
  ($("#resume-button") as HTMLButtonElement).disabled = false;
  showScreen("playing");
  previousTime = performance.now();
}

function finish(): void {
  const course = getActiveCourse();
  $("#result-course").innerHTML = `${course.name}<br />concluída.`;
  $("#result-time").textContent = formatTime(state.elapsed);
  $("#result-score").textContent = state.score.toLocaleString("pt-BR");
  $("#result-combo").textContent = `×${state.bestCombo.toFixed(1)}`;
  $("#result-trick").textContent = state.bestTrick;
  $("#result-near").textContent = String(state.nearMisses);
  $("#result-crashes").textContent = String(state.crashes);
  const playerWon = !rival.finished || state.elapsed <= rival.finishTime;
  const rivalProjectedTime = rival.finished ? rival.finishTime : rival.elapsed + (COURSE_LENGTH - rival.s) / Math.max(20, rival.speed);
  const gap = Math.abs(rivalProjectedTime - state.elapsed);
  $("#result-position").textContent = playerWon ? "1º" : "2º";
  $("#result-rival").textContent = `${rivalProjectedTime >= state.elapsed ? "+" : "−"}${gap.toFixed(2)}s`;
  const finalCourse = selectedCourseIndex >= COURSES.length - 1;
  $("#next-track-button").textContent = finalCourse ? "✕ CONCLUIR CAMPANHA" : "✕ PRÓXIMA PISTA";
  showScreen("results");
}

function handleRivalEvent(event: RivalEvent): void {
  if (event.type === "RIVAL_CRASH" && Math.abs(rival.s - state.s) < 55) showToast("YETI TOMBOU!", "near");
  if (event.type === "RIVAL_FINISH" && !state.finished) showToast("YETI CHEGOU PRIMEIRO!", "crash");
}

function handleEvent(event: GameEvent): void {
  view.event(event, state); audio.event(event);
  if (event.type === "TAKEOFF") input.pulse(.18, .52, 85);
  if (event.type === "LAND") {
    input.pulse(event.grade === "clean" ? .38 : .65, .42, event.grade === "clean" ? 110 : 170);
    showToast(event.grade === "crash" ? "POUSO PERDIDO" : `${event.label}  +${event.points}`, event.grade === "clean" ? "clean" : event.grade === "crash" ? "crash" : "");
  }
  if (event.type === "NEAR_MISS") { input.pulse(.12, .68, 70); showToast(`POR UM FIO  +${event.points}`, "near"); }
  if (event.type === "CRASH") { input.pulse(1, .7, 260); showToast("TUMBOU!", "crash"); }
  if (event.type === "SECTION") showToast(event.name.toUpperCase(), "clean");
  if (event.type === "FINISH") { input.pulse(.45, .8, 420); window.setTimeout(finish, 500); }
}

function showToast(text: string, variant = ""): void {
  toast.textContent = text; toast.className = `toast show ${variant}`; toastTimer = 1.15;
}

function updateHud(force = false): void {
  if (!force && hudTimer < .08) return;
  hudTimer = 0;
  speedLabel.textContent = String(Math.round(state.speed * 3.6));
  sectionLabel.textContent = state.section;
  timeLabel.textContent = formatTime(state.elapsed);
  scoreLabel.textContent = String(state.score).padStart(6, "0");
  comboLabel.textContent = `×${state.combo.toFixed(1)}`;
  updateMapMarker();
}

function updateControllerStatus(): void {
  const available = input.compatible || input.usingDevFallback;
  controllerCard.classList.toggle("connected", available);
  startButton.disabled = !available;
  controllerName.textContent = input.compatible ? input.gamepadName : input.usingDevFallback
    ? "Fallback de teclado habilitado para desenvolvimento"
    : input.connected ? `Controle incompatível: ${input.gamepadName}` : "Conecte o DualSense e pressione um botão";
  $("#dev-badge").classList.toggle("hidden", !input.usingDevFallback || screen !== "playing");
  $("#dev-hint").classList.toggle("hidden", input.usingDevFallback);
  if (screen === "playing" && !available) pause(true);
  if (screen === "paused" && disconnectedPause && input.compatible) ($("#resume-button") as HTMLButtonElement).disabled = false;
}

function focusables(): HTMLElement[] {
  const active = [titleScreen, campaignScreen, pauseScreen, resultsScreen, settingsScreen].find(element => !element.classList.contains("hidden"));
  return active ? Array.from(active.querySelectorAll<HTMLElement>(".focusable:not(:disabled)")) : [];
}
function focusFirst(): void {
  const items = focusables();
  document.querySelectorAll(".gamepad-focus").forEach(element => element.classList.remove("gamepad-focus"));
  if (items[0]) { items[0].focus({ preventScroll: true }); items[0].classList.add("gamepad-focus"); }
}
function navigateMenu(direction: MenuAction): void {
  const items = focusables(); if (!items.length) return;
  const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
  const delta = direction === "up" || direction === "left" ? -1 : 1, next = (current + delta + items.length) % items.length;
  items.forEach(item => item.classList.remove("gamepad-focus"));
  items[next].focus({ preventScroll: false }); items[next].classList.add("gamepad-focus"); items[next].scrollIntoView({ block: "nearest" });
}
function updateMenuInput(): void {
  const direction = input.consumeAnyDirection(); if (direction) navigateMenu(direction);
  if (input.consumeMenu("confirm")) (document.activeElement as HTMLElement | null)?.click();
  if (input.consumeMenu("back")) {
    if (screen === "settings") closeSettings(); else if (screen === "campaign") showScreen("title"); else if (screen === "paused") resume();
  }
  if (input.consumeMenu("pause") && screen === "paused" && !disconnectedPause) resume();
}
function openSettings(): void { settingsReturn = screen; showScreen("settings"); }
function closeSettings(): void { showScreen(settingsReturn); }

function frame(now: number): void {
  const dt = Math.min(.1, Math.max(0, (now - previousTime) / 1_000)); previousTime = now;
  const intent = input.poll(); lastIntentLook = intent.look; updateControllerStatus();
  if (screen === "playing") {
    if (input.consumeMenu("pause")) pause();
    if (countdown > 0) {
      countdown -= dt;
      countdownLabel.textContent = countdown > 2.35 ? "3" : countdown > 1.35 ? "2" : countdown > .35 ? "1" : "VAI!";
      if (countdown <= 0) countdownLabel.textContent = "";
    } else {
      accumulator = Math.min(.25, accumulator + dt); let firstStep = true;
      while (accumulator >= fixedStep) {
        const stepIntent = firstStep ? intent : { ...intent, jumpPressed: false, jumpReleased: false };
        previousRider = { ...state }; const progressBeforeStep = state.s;
        previousRival = { ...rival };
        for (const event of updateRider(state, stepIntent, fixedStep)) handleEvent(event);
        for (const event of updateRival(rival, state.s, state.x, fixedStep)) handleRivalEvent(event);
        if (resolveRiderContact(rival, state)) input.pulse(.15, .32, 65);
        if (Math.abs(state.s - progressBeforeStep) > 5) previousRider = { ...state };
        accumulator -= fixedStep; firstStep = false;
      }
      audio.update(state);
      if (state.grounded && Math.abs(state.carve) > .45 && state.speed > 16) input.pulse(.04, .12 + Math.abs(state.carve) * .08, 38, 90);
    }
    hudTimer += dt; updateHud(); input.consumeMenu("confirm"); input.consumeMenu("back"); input.consumeAnyDirection();
  } else updateMenuInput();
  toastTimer -= dt; if (toastTimer <= 0) toast.classList.remove("show");
  const renderState = screen === "playing" && countdown <= 0 ? interpolateRider(previousRider, state, accumulator / fixedStep) : state;
  const renderRival = screen === "playing" && countdown <= 0 ? interpolateRival(previousRival, rival, accumulator / fixedStep) : rival;
  view.render(renderState, renderRival, lastIntentLook, dt); requestAnimationFrame(frame);
}

$("#campaign-button").addEventListener("click", openCampaign);
$("#campaign-back-button").addEventListener("click", () => showScreen("title"));
startButton.addEventListener("click", startRun);
$("#settings-button").addEventListener("click", openSettings);
$("#pause-settings-button").addEventListener("click", openSettings);
$("#settings-back-button").addEventListener("click", closeSettings);
$("#resume-button").addEventListener("click", resume);
$("#quit-button").addEventListener("click", openCampaign);
$("#restart-button").addEventListener("click", startRun);
$("#result-title-button").addEventListener("click", () => showScreen("title"));
$("#next-track-button").addEventListener("click", () => {
  if (selectedCourseIndex < COURSES.length - 1) { selectedCourseIndex += 1; startRun(); } else { selectedCourseIndex = 0; openCampaign(); }
});

function safeStorageGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function safeStorageSet(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* Sem persistência. */ } }

document.querySelectorAll<HTMLButtonElement>("[data-quality]").forEach(button => button.addEventListener("click", () => {
  const quality = button.dataset.quality as Quality; view.setQuality(quality);
  document.querySelectorAll("[data-quality]").forEach(item => item.classList.toggle("active", item === button));
  safeStorageSet("neve-brava.quality.v1", quality);
}));
const vibration = $("#vibration") as HTMLInputElement, musicVolume = $("#music-volume") as HTMLInputElement, deadzone = $("#deadzone") as HTMLInputElement;
vibration.addEventListener("input", () => { input.setSettings({ vibration: Number(vibration.value) / 100 }); $("#vibration-value").textContent = `${vibration.value}%`; input.pulse(.35, .6, 100, 0); });
musicVolume.addEventListener("input", () => { audio.setMusicVolume(Number(musicVolume.value) / 100); $("#music-volume-value").textContent = `${musicVolume.value}%`; safeStorageSet("neve-brava.music-volume.v1", musicVolume.value); });
deadzone.addEventListener("input", () => { input.setSettings({ deadzone: Number(deadzone.value) / 100 }); $("#deadzone-value").textContent = `${deadzone.value}%`; });

window.addEventListener("keydown", event => {
  if (event.key.toLowerCase() === "escape") {
    if (screen === "playing") pause(); else if (screen === "paused" && !disconnectedPause) resume(); else if (screen === "settings") closeSettings(); else if (screen === "campaign") showScreen("title");
  }
  if (event.key.toLowerCase() === "d" && event.altKey) view.setDebug(true);
});

const savedQuality = safeStorageGet("neve-brava.quality.v1") as Quality | null;
const savedMusicVolume = safeStorageGet("neve-brava.music-volume.v1");
if (savedMusicVolume !== null && Number.isFinite(Number(savedMusicVolume))) {
  musicVolume.value = String(Math.min(100, Math.max(0, Number(savedMusicVolume)))); $("#music-volume-value").textContent = `${musicVolume.value}%`;
}
audio.setMusicVolume(Number(musicVolume.value) / 100);
if (savedQuality && ["high", "medium", "performance"].includes(savedQuality)) {
  view.setQuality(savedQuality); document.querySelectorAll<HTMLButtonElement>("[data-quality]").forEach(button => button.classList.toggle("active", button.dataset.quality === savedQuality));
} else view.setQuality("medium");

const courseIssues = validateAllCourses();
for (const [course, issues] of Object.entries(courseIssues)) if (issues.length) console.warn(`Validação da pista ${course}:`, issues);
setActiveCourse(COURSES[0].id);
renderTrackCards(); updateSelectedCourseCopy(); buildRaceMap(); showScreen("title"); requestAnimationFrame(frame);
