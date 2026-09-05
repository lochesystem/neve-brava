import "./styles.css";
import {
  COURSES, COURSE_LENGTH, RACE_LAPS, courseCenterFor, courseCenterX, getActiveCourse, raceProgress, setActiveCourse, validateAllCourses,
  type CourseDefinition, type ItemKind,
} from "./core/course.ts";
import {
  applyRiderBlizzardSlow, applyRiderFreeze, applyRiderTimeWarp, applyRiderWindHit,
  createRider, interpolateRider, updateRider, type GameEvent, type RiderState,
} from "./core/simulation.ts";
import { CHARACTERS, characterById, type CharacterId } from "./core/characters.ts";
import { SPECIALS } from "./core/specials.ts";
import {
  applyBlizzardSlow, applyFreeze, applyTimeWarp, applyWindHit, createRival, GIRU_PROFILE, GUY_PROFILE, interpolateRival, resolveRiderContact, resolveRivalContact,
  RIVAL_PROFILES, updateRival, YETI_PROFILE, type RivalEvent, type RivalState,
} from "./core/rival.ts";
import { InputManager, type MenuAction } from "./input/InputManager.ts";
import { AudioManager, type GiruVoiceCue, type GuyVoiceCue, type SnowmanVoiceCue, type YetiVoiceCue } from "./input/AudioManager.ts";
import { GameView, type Quality } from "./view/GameView.ts";
import { TrackPreview } from "./view/TrackPreview.ts";
import { MultiplayerClient } from "./multiplayer/MultiplayerClient.ts";
import { MULTIPLAYER_START_X } from "../shared/multiplayer.ts";
import type {
  BotStatePacket,
  MultiplayerAction,
  MultiplayerCharacterId,
  MultiplayerCourseId,
  MultiplayerRoom,
  NetworkRacerState,
  RaceStart,
  RacerStatePacket,
} from "../shared/multiplayer.ts";

type Screen = "title" | "campaign" | "character" | "multiplayer" | "playing" | "paused" | "results" | "settings" | "controls";
type MapProjection = { minX: number; spanX: number; startX: number; finishX: number };
type SnowballSpecial = { active: boolean; owner: CharacterId; s: number; x: number; lap: number; hit: Set<CharacterId> };

const query = new URLSearchParams(window.location.search);
const playerSpecialTest = query.has("special-test");

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const hud = document.querySelector<HTMLElement>("#hud")!;
const menu = document.querySelector<HTMLElement>("#menu")!;
const titleScreen = document.querySelector<HTMLElement>("#title-screen")!;
const campaignScreen = document.querySelector<HTMLElement>("#campaign-screen")!;
const characterScreen = document.querySelector<HTMLElement>("#character-screen")!;
const multiplayerScreen = document.querySelector<HTMLElement>("#multiplayer-screen")!;
const pauseScreen = document.querySelector<HTMLElement>("#pause-screen")!;
const resultsScreen = document.querySelector<HTMLElement>("#results-screen")!;
const settingsScreen = document.querySelector<HTMLElement>("#settings-screen")!;
const controlsScreen = document.querySelector<HTMLElement>("#controls-screen")!;
const input = new InputManager();
const audio = new AudioManager();
const view = new GameView(canvas, input.touchEnabled);
const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const trackPreview = new TrackPreview($("#track-preview-canvas") as HTMLCanvasElement, input.touchEnabled);
const multiplayer = new MultiplayerClient();

if (input.touchEnabled) document.body.classList.add("mobile-mode");
input.bindTouchControls($("#touch-controls"));

async function requestLandscape(): Promise<void> {
  const orientation = window.screen.orientation as ScreenOrientation & { lock?: (mode: "landscape") => Promise<void> };
  if (!input.touchEnabled || !orientation.lock) return;
  try { await orientation.lock("landscape"); } catch { /* O aviso visual mantém retrato bloqueado. */ }
}

function requestMobileFullscreen(): void {
  if (query.has("layout-test")) return;
  if (!input.touchEnabled || document.fullscreenElement || !document.documentElement.requestFullscreen) return;
  void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
}

function requestMobileImmersiveMode(): void {
  requestMobileFullscreen();
  void requestLandscape();
}

if (input.touchEnabled) window.addEventListener("click", requestMobileImmersiveMode, { once: true, capture: true });

function setupTitleSnow(): void {
  const field = $("#title-snow");
  for (let index = 0; index < 42; index += 1) {
    const flake = document.createElement("i");
    const direction = index % 2 === 0 ? 1 : -1;
    const driftA = direction * (24 + (index * 17) % 92);
    const driftB = -driftA * .48 + ((index * 11) % 31 - 15);
    const depth = (index % 6) / 5;
    flake.style.setProperty("--x", `${(index * 37 + index * index * 11) % 101}%`);
    flake.style.setProperty("--size", `${3 + (index * 7) % 8}px`);
    flake.style.setProperty("--duration", `${11 + (index * 13) % 10}s`);
    flake.style.setProperty("--delay", `${-((index * 19) % 180) / 10}s`);
    flake.style.setProperty("--drift-a", `${driftA}px`);
    flake.style.setProperty("--drift-b", `${driftB}px`);
    flake.style.setProperty("--spin", `${direction * (220 + (index * 23) % 190)}deg`);
    flake.style.setProperty("--flake-opacity", `${(.22 + depth * .58).toFixed(2)}`);
    field.append(flake);
  }
}

setupTitleSnow();

let state: RiderState = createRider();
let previousRider: RiderState = { ...state };
let rival: RivalState = createRival(YETI_PROFILE);
let previousRival: RivalState = { ...rival };
let guy: RivalState = createRival(GUY_PROFILE);
let previousGuy: RivalState = { ...guy };
let giru: RivalState = createRival(GIRU_PROFILE);
let previousGiru: RivalState = { ...giru };
let screen: Screen = "title";
let settingsReturn: Screen = "title";
let selectedCourseIndex = 0;
let selectedCharacter: CharacterId = "snowman";
let characterSelectionActive = false;
let hasChosenCharacter = false;
let multiplayerRoom: MultiplayerRoom | null = null;
let multiplayerActive = false;
let multiplayerSequence = 0;
let multiplayerSendTimer = 0;
let multiplayerReady = false;
let multiplayerStarting = false;
const remoteSlotByPlayer = new Map<string, number>();
const botSlotByActor = new Map<string, number>();
const remoteSequenceByPlayer = new Map<string, number>();
let accumulator = 0;
let previousTime = performance.now();
let countdown = 3.35;
let toastTimer = 0;
let slowFxTimer = 0;
let specialFxTimer = 0;
let snowballSpecial: SnowballSpecial = { active: false, owner: "snowman", s: 0, x: 0, lap: 1, hit: new Set() };
let lastRacePosition = 1;
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
const creditsLabel = $("#credits");
const itemArt = $("#item-art") as HTMLImageElement;
const itemEmpty = $("#item-empty");
const itemHud = $("#item-hud");
const specialHud = $("#special-hud");
const specialArt = $("#special-art") as HTMLImageElement;
const specialProgress = $("#special-progress");
const specialCutIn = $("#special-cut-in");
const specialCutInImage = $("#special-cut-in-image") as HTMLImageElement;
const specialCutInRider = $("#special-cut-in-rider");
const specialCutInName = $("#special-cut-in-name");
const boostFx = $("#boost-fx");
const slowFx = $("#slow-fx");
const specialFx = $("#special-fx");
const windTargetHud = $("#wind-target-hud");
const windTargetName = $("#wind-target-name");
const windTargetDistance = $("#wind-target-distance");
const toast = $("#toast");
const countdownLabel = $("#countdown");
const liftTransition = $("#lift-transition");
const liftNextLap = $("#lift-next-lap");
const startButton = $("#start-button") as HTMLButtonElement;
const controllerCard = $("#controller-card");
const controllerName = $("#controller-name");
const pauseTitle = $("#pause-title");
const pauseCopy = $("#pause-copy");
const mapLine = document.querySelector<SVGPathElement>("#course-map-line")!;
const mapShadow = document.querySelector<SVGPathElement>("#course-map-shadow")!;
const mapMarker = document.querySelector<SVGGElement>("#course-map-marker")!;
const mapRival = document.querySelector<SVGGElement>("#course-map-rival")!;
const mapGuy = document.querySelector<SVGGElement>("#course-map-guy")!;
const mapGiru = document.querySelector<SVGGElement>("#course-map-giru")!;
const raceLap = $("#race-lap");
const mapStart = document.querySelector<SVGCircleElement>(".map-start")!;
const mapFinish = document.querySelector<SVGPathElement>(".map-finish")!;
const installButton = $("#install-button") as HTMLButtonElement;
const installHint = $("#install-hint");
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let installPrompt: InstallPromptEvent | null = null;

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function setupPwa(): void {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
    });
  }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios && !isStandalone()) installButton.classList.remove("hidden");
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    installButton.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.classList.add("hidden");
    installHint.classList.add("hidden");
  });
}

setupPwa();

function mapGeometry(course: CourseDefinition, width: number, height: number, padding: number): { path: string; projection: MapProjection } {
  const samples = Array.from({ length: 161 }, (_, index) => ({ s: index / 160 * course.length, x: courseCenterFor(course, index / 160 * course.length) }));
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

function renderTrackCards(): void {
  const grid = $("#track-grid");
  grid.innerHTML = COURSES.map((course, index) => `
    <button class="track-card focusable ${index === selectedCourseIndex ? "selected" : ""}" data-track-index="${index}" type="button">
      <b class="track-card-index">${String(course.order).padStart(2, "0")}</b>
      <span><small>${course.difficulty}</small><strong>${course.name}</strong></span>
      <em>${course.subtitle}</em>
    </button>`).join("");
  grid.querySelectorAll<HTMLButtonElement>("[data-track-index]").forEach(button => {
    const select = () => {
      selectedCourseIndex = Number(button.dataset.trackIndex);
      grid.querySelectorAll(".track-card").forEach(card => card.classList.toggle("selected", card === button));
      updateSelectedCourseCopy();
    };
    button.addEventListener("focus", select);
    button.addEventListener("pointerenter", select);
    button.addEventListener("click", () => { select(); openCharacterSelect(); });
  });
}

function updateSelectedCourseCopy(): void {
  const course = COURSES[selectedCourseIndex];
  trackPreview.setCourse(course);
  $("#selected-track-name").textContent = course.name;
  $("#selected-track-copy").textContent = `${course.subtitle} · ${course.difficulty} · ${(course.length / 1_000).toFixed(1)} km`;
  $("#track-showcase-stage").textContent = `ETAPA ${String(course.order).padStart(2, "0")} · ${course.difficulty}`;
  $("#track-showcase-name").textContent = course.name;
  $("#track-showcase-subtitle").textContent = course.description;
  $("#track-showcase-length").textContent = `${(course.length / 1_000).toFixed(1)} KM`;
  $("#track-showcase-sections").textContent = `${course.sections.length} TRECHOS`;
  $("#track-showcase-ramps").textContent = `${course.ramps.length} RAMPAS`;
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

function markerTransform(progress: number, lateral: number): string {
  const x = 24 + (courseCenterX(progress) + lateral - mapProjection.minX) / mapProjection.spanX * 132;
  const y = 24 + Math.min(1, Math.max(0, progress / COURSE_LENGTH)) * 472;
  return `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
}

function currentRacePosition(): number {
  return racePositionOf(state);
}

function racePositionOf(racer: RiderState | RivalState): number {
  const progress = raceProgress(racer.lap, racer.s);
  return 1 + [state, rival, guy, giru].filter(candidate => candidate !== racer && raceProgress(candidate.lap, candidate.s) > progress + .35).length;
}

function updateMapMarker(): void {
  mapMarker.setAttribute("transform", markerTransform(state.s, state.x));
  mapRival.setAttribute("transform", markerTransform(rival.s, rival.x));
  mapGuy.setAttribute("transform", markerTransform(guy.s, guy.x));
  mapGiru.setAttribute("transform", markerTransform(giru.s, giru.x));
  [
    { marker: mapMarker, progress: raceProgress(state.lap, state.s) },
    { marker: mapRival, progress: raceProgress(rival.lap, rival.s) },
    { marker: mapGuy, progress: raceProgress(guy.lap, guy.s) },
    { marker: mapGiru, progress: raceProgress(giru.lap, giru.s) },
  ].sort((first, second) => first.progress - second.progress)
    .forEach(({ marker }) => marker.parentElement?.append(marker));
  const position = currentRacePosition();
  $("#race-position").innerHTML = `${position}º <i>/ 4</i>`;
  raceLap.textContent = `VOLTA ${state.lap}/${RACE_LAPS}`;
}

function setMapPortrait(marker: SVGGElement, character: CharacterId): void {
  const portrait = marker.querySelector<SVGImageElement>(".map-portrait");
  portrait?.setAttribute("href", `${import.meta.env.BASE_URL}images/minimap/${character}.png`);
  marker.setAttribute("aria-label", characterById(character).name);
}

function updateMapPortraits(): void {
  setMapPortrait(mapMarker, selectedCharacter);
  setMapPortrait(mapRival, rival.id);
  setMapPortrait(mapGuy, guy.id);
  setMapPortrait(mapGiru, giru.id);
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60), remainder = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(2).padStart(5, "0")}`;
}

function showScreen(next: Screen): void {
  screen = next;
  document.body.dataset.screen = next;
  menu.dataset.screen = next;
  canvas.classList.toggle("menu-art-hidden", ["title", "campaign", "character", "multiplayer", "settings", "controls", "results"].includes(next));
  titleScreen.classList.toggle("hidden", next !== "title");
  campaignScreen.classList.toggle("hidden", next !== "campaign");
  characterScreen.classList.toggle("hidden", next !== "character");
  multiplayerScreen.classList.toggle("hidden", next !== "multiplayer");
  pauseScreen.classList.toggle("hidden", next !== "paused");
  resultsScreen.classList.toggle("hidden", next !== "results");
  settingsScreen.classList.toggle("hidden", next !== "settings");
  controlsScreen.classList.toggle("hidden", next !== "controls");
  trackPreview.setVisible(next === "campaign");
  menu.classList.toggle("hidden", next === "playing");
  hud.classList.toggle("hidden", !["playing", "paused"].includes(next));
  const liftActive = next === "playing" && state.liftTime > 0;
  liftTransition.classList.toggle("active", liftActive);
  liftTransition.setAttribute("aria-hidden", String(!liftActive));
  const activeScreen = [titleScreen, campaignScreen, characterScreen, multiplayerScreen, pauseScreen, resultsScreen, settingsScreen, controlsScreen]
    .find(element => !element.classList.contains("hidden"));
  if (activeScreen) activeScreen.scrollTop = 0;
  window.setTimeout(focusFirst, 30);
}

function openCampaign(): void {
  if (multiplayerActive || multiplayerRoom) leaveMultiplayer();
  audio.setMenuTrack();
  document.documentElement.dataset.musicTrack = "menu";
  audio.start();
  view.setSelectionMode(false);
  renderTrackCards();
  updateSelectedCourseCopy();
  showScreen("campaign");
}

function multiplayerProfile(): { name: string; character: MultiplayerCharacterId } {
  const name = ($("#multiplayer-name") as HTMLInputElement).value.trim().slice(0, 16) || "PILOTO";
  const selected = document.querySelector<HTMLElement>("[data-multiplayer-character].selected")?.dataset.multiplayerCharacter;
  return { name, character: (selected ?? "snowman") as MultiplayerCharacterId };
}

function multiplayerFeedback(message: string): void {
  $("#multiplayer-feedback").textContent = message;
}

function openMultiplayer(): void {
  audio.setMenuTrack();
  document.documentElement.dataset.musicTrack = "menu";
  audio.start();
  multiplayer.connect();
  multiplayerFeedback("");
  renderMultiplayerRoom();
  showScreen("multiplayer");
}

function leaveMultiplayer(): void {
  multiplayer.leave();
  multiplayerRoom = null;
  multiplayerActive = false;
  multiplayerReady = false;
  multiplayerStarting = false;
  remoteSlotByPlayer.clear();
  botSlotByActor.clear();
  remoteSequenceByPlayer.clear();
  renderMultiplayerRoom();
}

function multiplayerPlayerList(room: MultiplayerRoom): string {
  return room.players.map(player => `
    <li class="${player.ready ? "ready" : ""} ${player.connected ? "" : "disconnected"}">
      <img src="${import.meta.env.BASE_URL}images/minimap/${player.character}.png" alt="" />
      <span><b>${player.name}${player.id === multiplayer.playerId ? " · VOCÊ" : ""}</b><small>${characterById(player.character as CharacterId).name}${player.host ? " · ANFITRIÃO" : ""}</small></span>
      <em>${player.connected ? player.ready ? "PRONTO" : "AJUSTANDO" : "RECONECTANDO…"}</em>
    </li>`).join("");
}

function renderMultiplayerRoom(): void {
  const room = multiplayerRoom;
  $("#multiplayer-entry").classList.toggle("hidden", Boolean(room));
  $("#multiplayer-room").classList.toggle("hidden", !room);
  if (!room) return;
  const self = room.players.find(player => player.id === multiplayer.playerId);
  const isHost = Boolean(self?.host);
  multiplayerReady = Boolean(self?.ready);
  $("#multiplayer-room-code").textContent = room.code;
  $("#multiplayer-room-status").textContent = room.players.some(player => !player.connected)
    ? "AGUARDANDO RECONECTAR…"
    : room.players.length < 2
    ? room.mode === "quick" ? "BUSCANDO ADVERSÁRIO…" : "AGUARDANDO PILOTOS"
    : `${room.players.length}/4 PILOTOS NA SALA`;
  $("#multiplayer-player-list").innerHTML = multiplayerPlayerList(room);
  document.querySelectorAll<HTMLButtonElement>("[data-multiplayer-character]").forEach(button => {
    const character = button.dataset.multiplayerCharacter as MultiplayerCharacterId;
    const occupied = room.players.some(player => player.id !== multiplayer.playerId && player.character === character);
    button.disabled = occupied || multiplayerStarting;
    button.classList.toggle("selected", self?.character === character);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-multiplayer-course]").forEach(button => {
    button.disabled = !isHost || multiplayerStarting;
    button.classList.toggle("selected", button.dataset.multiplayerCourse === room.courseId);
  });
  $("#multiplayer-course-owner").textContent = isHost ? "· VOCÊ ESCOLHE" : "· ANFITRIÃO ESCOLHE";
  const readyButton = $("#ready-button") as HTMLButtonElement;
  readyButton.disabled = multiplayerStarting;
  readyButton.textContent = multiplayerReady ? "○ CANCELAR PRONTO" : "✕ ESTOU PRONTO";
  readyButton.classList.toggle("secondary", multiplayerReady);
  readyButton.classList.toggle("primary", !multiplayerReady);
  const startButton = $("#start-multiplayer-button") as HTMLButtonElement;
  startButton.classList.toggle("hidden", !isHost || room.mode === "quick");
  startButton.disabled = multiplayerStarting || room.players.length < 2
    || !room.players.every(player => player.ready && player.connected);
}

async function multiplayerOperation(operation: () => Promise<MultiplayerRoom>): Promise<void> {
  multiplayerFeedback("");
  try {
    multiplayerRoom = await operation();
    renderMultiplayerRoom();
  } catch (error) {
    multiplayerFeedback(error instanceof Error ? error.message : "Não foi possível conectar à sala.");
  }
}

function configureMultiplayerRacers(start: RaceStart): void {
  const room = start.room;
  const self = room.players.find(player => player.id === multiplayer.playerId);
  if (!self) return;
  selectedCharacter = self.character as CharacterId;
  characterSelectionActive = true;
  hasChosenCharacter = true;
  const entries = [
    ...room.players.flatMap((player, index) => player.id === multiplayer.playerId ? [] : [{
      character: player.character as CharacterId,
      actorId: player.id,
      playerId: player.id,
      startX: MULTIPLAYER_START_X[index],
    }]),
    ...start.bots.map(bot => ({
      character: bot.character as CharacterId,
      actorId: bot.actorId,
      playerId: null,
      startX: bot.startX,
    })),
  ].slice(0, 3);
  const states = entries.map(entry => createOpponent(entry.character, entry.startX));
  if (states.length !== 3) return;
  [rival, guy, giru] = states as [RivalState, RivalState, RivalState];
  previousRival = { ...rival }; previousGuy = { ...guy }; previousGiru = { ...giru };
  remoteSlotByPlayer.clear();
  botSlotByActor.clear();
  remoteSequenceByPlayer.clear();
  entries.forEach((entry, index) => {
    if (entry.playerId) remoteSlotByPlayer.set(entry.playerId, index);
    else botSlotByActor.set(entry.actorId, index);
  });
  view.setRacerCharacters(selectedCharacter, rival.id, guy.id, giru.id);
  updateMapPortraits();
}

function beginMultiplayerRace(start: RaceStart): void {
  multiplayerRoom = start.room;
  const self = start.room.players.find(player => player.id === multiplayer.playerId);
  if (!self) return;
  selectedCourseIndex = Math.max(0, COURSES.findIndex(course => course.id === start.room.courseId));
  selectedCharacter = self.character as CharacterId;
  characterSelectionActive = true;
  hasChosenCharacter = true;
  multiplayerActive = true;
  multiplayerStarting = true;
  startRun();
  const playerIndex = start.room.players.findIndex(player => player.id === multiplayer.playerId);
  state.x = MULTIPLAYER_START_X[playerIndex] ?? 0;
  state.lastSafeX = state.x;
  previousRider = { ...state };
  configureMultiplayerRacers(start);
  countdown = Math.max(.35, (start.startsAt - Date.now()) / 1_000);
  multiplayerSequence = 0;
  multiplayerSendTimer = 0;
}

function createOpponent(character: CharacterId, startX: number): RivalState {
  return createRival({ ...RIVAL_PROFILES[character], startX });
}

function updateCharacterSelection(): void {
  const character = characterById(selectedCharacter);
  $("#selected-character-name").textContent = characterSelectionActive ? character.name.toUpperCase() : "—";
  const confirmButton = $("#character-confirm-button") as HTMLButtonElement;
  confirmButton.disabled = !characterSelectionActive;
  confirmButton.innerHTML = characterSelectionActive
    ? `<span>✕</span> CORRER COM ${character.name.toUpperCase()}`
    : `<span>✕</span> ESCOLHA UM PILOTO`;
  document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach(button =>
    button.classList.toggle("selected", characterSelectionActive && button.dataset.character === selectedCharacter));
  if (characterSelectionActive) view.setCharacterSelection(selectedCharacter);
}

function selectCharacter(character: CharacterId): void {
  selectedCharacter = character;
  characterSelectionActive = true;
  updateCharacterSelection();
}

function openCharacterSelect(): void {
  if (!input.compatible && !input.usingDevFallback && !input.touchEnabled) return;
  const course = setActiveCourse(COURSES[selectedCourseIndex].id);
  view.rebuildCourse();
  state = createRider(); previousRider = { ...state };
  const opponents = CHARACTERS.map(character => character.id).filter(character => character !== selectedCharacter);
  rival = createOpponent(opponents[0], 3.1); previousRival = { ...rival };
  guy = createOpponent(opponents[1], -3.15); previousGuy = { ...guy };
  giru = createOpponent(opponents[2], 7.4); previousGiru = { ...giru };
  view.setRacerCharacters(selectedCharacter, opponents[0], opponents[1], opponents[2]);
  view.setSelectionMode(true);
  $("#character-course").textContent = `${course.name} · ETAPA ${String(course.order).padStart(2, "0")}`;
  characterSelectionActive = hasChosenCharacter;
  updateCharacterSelection();
  showScreen("character");
}

function startRun(): void {
  if (!input.compatible && !input.usingDevFallback && !input.touchEnabled) return;
  if (!characterSelectionActive && !hasChosenCharacter) return;
  hasChosenCharacter = true;
  requestMobileImmersiveMode();
  const course = setActiveCourse(COURSES[selectedCourseIndex].id);
  view.rebuildCourse();
  audio.setCourseTrack(course.order);
  document.documentElement.dataset.musicTrack = String(course.order);
  audio.start();
  state = createRider();
  previousRider = { ...state };
  const opponents = CHARACTERS.map(character => character.id).filter(character => character !== selectedCharacter);
  rival = createOpponent(opponents[0], 3.1);
  previousRival = { ...rival };
  guy = createOpponent(opponents[1], -3.15);
  previousGuy = { ...guy };
  giru = createOpponent(opponents[2], 7.4);
  previousGiru = { ...giru };
  view.setRacerCharacters(selectedCharacter, opponents[0], opponents[1], opponents[2]);
  updateMapPortraits();
  snowballSpecial = { active: false, owner: "snowman", s: 0, x: 0, lap: 1, hit: new Set() };
  lastRacePosition = 1;
  specialFxTimer = 0;
  specialFx.className = "special-fx";
  view.setSelectionMode(false);
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
  audio.setMenuTrack();
  document.documentElement.dataset.musicTrack = "menu";
  const course = getActiveCourse();
  $("#result-course").textContent = course.name;
  $("#result-score").textContent = state.score.toLocaleString("pt-BR");
  $("#result-combo").textContent = `×${state.bestCombo.toFixed(1)}`;
  $("#result-trick").textContent = state.bestTrick;
  $("#result-crashes").textContent = String(state.crashes);
  const projectedTime = (opponent: RivalState) => opponent.finished
    ? opponent.finishTime
    : opponent.elapsed + (RACE_LAPS * COURSE_LENGTH - raceProgress(opponent.lap, opponent.s)) / Math.max(20, opponent.speed);
  const portraits: Record<CharacterId, string> = { guy: "guy.png", snowman: "snowman.png", yeti: "yeti.png", giru: "giru-v2.png" };
  const playerCharacter = characterById(selectedCharacter);
  const standings = [
    { id: selectedCharacter, name: playerCharacter.name.toUpperCase(), time: state.elapsed, player: true },
    ...[rival, guy, giru].map(opponent => ({ id: opponent.id, name: opponent.name, time: projectedTime(opponent), player: false })),
  ].sort((first, second) => first.time - second.time);
  const winner = standings[0];
  const winnerPanel = $("#result-winner");
  winnerPanel.className = `result-winner ${winner.id}`;
  const winnerImage = $("#result-winner-image") as HTMLImageElement;
  winnerImage.src = `${import.meta.env.BASE_URL}images/characters/${portraits[winner.id]}`;
  winnerImage.alt = `${winner.name}, campeão da etapa`;
  $("#result-winner-name").textContent = winner.player ? `${winner.name} · VOCÊ` : winner.name;
  $("#result-standings").innerHTML = standings.map((entry, index) => `
    <li class="${entry.player ? "player" : ""} ${index === 0 ? "winner" : ""}">
      <span class="standing-position">${index + 1}</span>
      <img src="${import.meta.env.BASE_URL}images/characters/${portraits[entry.id]}" alt="" />
      <b>${entry.name}</b>${entry.player ? "<em>VOCÊ</em>" : ""}
      <time>${formatTime(entry.time)}</time>
    </li>`).join("");
  const finalCourse = selectedCourseIndex >= COURSES.length - 1;
  $("#next-track-button").textContent = multiplayerActive ? "✕ VOLTAR AO MULTIPLAYER" : finalCourse ? "✕ CONCLUIR CAMPANHA" : "✕ PRÓXIMA PISTA";
  $("#restart-button").classList.toggle("hidden", multiplayerActive);
  showScreen("results");
}

function handleRivalEvent(event: RivalEvent, opponent: RivalState): void {
  if (event.type === "RIVAL_CRASH" && Math.abs(opponent.s - state.s) < 55) showToast(`${opponent.name} TOMBOU!`, "near");
  if (event.type === "RIVAL_SHIELD_BREAK" && Math.abs(opponent.s - state.s) < 65) showToast(`ESCUDO DO ${opponent.name} QUEBROU!`, "clean");
  if (event.type === "RIVAL_ITEM_USED") useRivalItem(opponent, event.item);
  if (event.type === "RIVAL_SPECIAL") useRivalSpecial(opponent);
  if (event.type === "RIVAL_FINISH" && !state.finished) {
    const position = [rival, guy, giru].filter(racer => racer.finished).length;
    showToast(position === 1 ? `${opponent.name} CHEGOU PRIMEIRO!` : `${opponent.name} CHEGOU EM ${position}º!`, "crash");
  }
}

function opponents(): RivalState[] { return [rival, guy, giru]; }

function setOpponentAt(index: number, next: RivalState): void {
  if (index === 0) { previousRival = { ...rival }; rival = next; }
  else if (index === 1) { previousGuy = { ...guy }; guy = next; }
  else { previousGiru = { ...giru }; giru = next; }
}

function networkStateOfPlayer(): NetworkRacerState {
  return {
    s: state.s, x: state.x, y: state.y, speed: state.speed, lateralSpeed: state.lateralSpeed,
    grounded: state.grounded, verticalSpeed: state.verticalSpeed, carve: state.carve, heading: state.heading,
    spin: state.spin, flip: state.flip, recovering: state.recovering, tumbleTime: state.tumbleTime,
    tumbleDirection: state.tumbleDirection, lap: state.lap, liftTime: state.liftTime, finished: state.finished,
    elapsed: state.elapsed, item: state.item, credits: state.credits, turboTime: state.turboTime,
    specialTurboTime: state.specialTurboTime, shieldTime: state.shieldTime, slowTime: state.slowTime,
    timeWarpTime: state.timeWarpTime, freezeTime: state.freezeTime,
  };
}

function applyNetworkOpponentState(actorId: string, sequence: number, remote: NetworkRacerState): void {
  if (!multiplayerActive) return;
  const slot = remoteSlotByPlayer.get(actorId) ?? botSlotByActor.get(actorId);
  if (slot === undefined || sequence <= (remoteSequenceByPlayer.get(actorId) ?? -1)) return;
  remoteSequenceByPlayer.set(actorId, sequence);
  const current = opponents()[slot];
  if (!current) return;
  setOpponentAt(slot, {
    ...current,
    s: remote.s, x: remote.x, y: remote.y, speed: remote.speed, lateralSpeed: remote.lateralSpeed,
    grounded: remote.grounded, verticalSpeed: remote.verticalSpeed, carve: remote.carve, heading: remote.heading,
    spin: remote.spin, airTime: remote.grounded ? 0 : current.airTime + 1 / 15,
    stun: remote.recovering, tumble: remote.tumbleTime, lap: remote.lap, liftTime: remote.liftTime,
    finished: remote.finished, finishTime: remote.finished ? remote.elapsed : current.finishTime, elapsed: remote.elapsed,
    item: remote.item, credits: remote.credits, turboTime: remote.turboTime, specialTurboTime: remote.specialTurboTime,
    shieldTime: remote.shieldTime, slowTime: remote.slowTime, timeWarpTime: remote.timeWarpTime, freezeTime: remote.freezeTime,
  });
}

function applyRemoteState(packet: RacerStatePacket): void {
  applyNetworkOpponentState(packet.playerId, packet.sequence, packet.state);
}

function applyBotState(packet: BotStatePacket): void {
  packet.bots.forEach(bot => applyNetworkOpponentState(bot.actorId, packet.sequence, bot.state));
}

function networkActorIdFor(opponent: RivalState): string | undefined {
  const slot = opponents().indexOf(opponent);
  return [...remoteSlotByPlayer, ...botSlotByActor].find(([, candidateSlot]) => candidateSlot === slot)?.[0];
}

function applyRemoteAction(action: MultiplayerAction): void {
  if (!multiplayerActive || action.actorId === multiplayer.playerId) return;
  const sourceSlot = remoteSlotByPlayer.get(action.actorId) ?? botSlotByActor.get(action.actorId);
  const source = sourceSlot === undefined ? null : opponents()[sourceSlot];
  if (!source) return;
  if (action.type === "special") {
    useRivalSpecial(source);
    return;
  }
  if (action.type === "wind") {
    if (action.targetId === multiplayer.playerId) {
      const events = applyRiderWindHit(state);
      view.windShot(source, state);
      handleAppliedRiderEvents(events);
      return;
    }
    const targetSlot = action.targetId
      ? remoteSlotByPlayer.get(action.targetId) ?? botSlotByActor.get(action.targetId)
      : undefined;
    const target = targetSlot === undefined ? null : opponents()[targetSlot];
    if (target) view.windShot(source, target);
    return;
  }
  if (action.type === "blizzard") {
    handleAppliedRiderEvents(applyRiderBlizzardSlow(state));
    slowFxTimer = 1.35;
    slowFx.classList.add("active");
    showToast(`${source.name} USOU NEVASCA!`, "wind");
  }
}

function handleAppliedRiderEvents(events: GameEvent[]): void {
  events.forEach(handleEvent);
}

function findRivalWindTarget(source: RivalState): { racer: RiderState | RivalState; player: boolean; distance: number } | null {
  const candidates: Array<{ racer: RiderState | RivalState; player: boolean }> = [
    ...(selectedCharacter === source.id ? [] : [{ racer: state, player: true }]),
    ...opponents().filter(candidate => candidate !== source).map(candidate => ({ racer: candidate, player: false })),
  ];
  return candidates
    .filter(candidate => !candidate.racer.finished && candidate.racer.liftTime <= 0 && candidate.racer.lap === source.lap)
    .map(candidate => ({ ...candidate, distance: Math.hypot(candidate.racer.s - source.s, (candidate.racer.x - source.x) * 1.35) }))
    .filter(candidate => candidate.racer.s >= source.s - 5 && candidate.distance <= WIND_RANGE)
    .sort((first, second) => first.distance - second.distance)[0] ?? null;
}

function useRivalItem(source: RivalState, item: ItemKind): void {
  if (item === "turbo" || item === "shield") {
    if (Math.abs(source.s - state.s) < 52) showToast(`${source.name} USOU ${item === "turbo" ? "TURBO" : "ESCUDO"}!`, item === "turbo" ? "coin" : "clean");
    return;
  }
  if (item === "wind") {
    const target = findRivalWindTarget(source);
    if (!target) return;
    if (target.player) {
      const events = applyRiderWindHit(state);
      view.windShot(source, state);
      handleAppliedRiderEvents(events);
    } else {
      const shielded = (target.racer as RivalState).shieldTime > 0;
      const hit = applyWindHit(target.racer as RivalState);
      view.windShot(source, target.racer);
      if (!hit && shielded) showToast(`ESCUDO DO ${(target.racer as RivalState).name} SALVOU!`, "clean");
    }
    showToast(`${source.name} DISPAROU VENTO!`, "wind");
    return;
  }
  const rivals = opponents().filter(candidate => candidate !== source);
  rivals.forEach(applyBlizzardSlow);
  handleAppliedRiderEvents(applyRiderBlizzardSlow(state));
  slowFxTimer = 1.35;
  slowFx.classList.add("active");
  showToast(`${source.name} USOU NEVASCA!`, "wind");
}

function useRivalSpecial(source: RivalState): void {
  showSpecialCutIn(source.id);
  if (source.id === "snowman") {
    snowballSpecial = { active: true, owner: source.id, s: source.s, x: 0, lap: source.lap, hit: new Set() };
    activateSpecialFx("snowman", .75);
  } else if (source.id === "yeti") {
    opponents().filter(candidate => candidate !== source && !candidate.finished).forEach(applyWindHit);
    handleAppliedRiderEvents(applyRiderWindHit(state));
    view.specialPulse(source, "yeti");
    activateSpecialFx("yeti", 1.35);
  } else if (source.id === "guy") {
    activateSpecialFx("guy", 3);
  } else {
    opponents().filter(candidate => candidate !== source).forEach(applyTimeWarp);
    handleAppliedRiderEvents(applyRiderTimeWarp(state));
    view.specialPulse(source, "giru");
    activateSpecialFx("giru", 3);
  }
  showToast(`${source.name} · ${SPECIALS[source.id].name}!`, source.id === "giru" ? "wind" : "clean");
}

function activateSpecialFx(character: CharacterId, duration: number): void {
  specialFxTimer = duration;
  specialFx.dataset.special = character;
  specialFx.classList.add("active");
}

function playSnowmanVoice(cue: SnowmanVoiceCue): void {
  if (selectedCharacter === "snowman") audio.playSnowmanVoice(cue);
}

function playGiruVoice(cue: GiruVoiceCue): void {
  if (selectedCharacter === "giru") audio.playGiruVoice(cue);
}

function playYetiVoice(cue: YetiVoiceCue): void {
  if (selectedCharacter === "yeti") audio.playYetiVoice(cue);
}

function playGuyVoice(cue: GuyVoiceCue): void {
  if (selectedCharacter === "guy") audio.playGuyVoice(cue);
}

function showSpecialCutIn(characterId: CharacterId): void {
  const character = characterById(characterId);
  const portrait = characterId === "giru" ? "giru-v2" : characterId;
  specialCutIn.dataset.character = characterId;
  specialCutInImage.src = `${import.meta.env.BASE_URL}images/characters/${portrait}.png`;
  specialCutInRider.textContent = character.name.toUpperCase();
  specialCutInName.textContent = SPECIALS[characterId].name;
  specialCutIn.setAttribute("aria-hidden", "false");
  specialCutIn.classList.remove("active");
  void specialCutIn.offsetWidth;
  specialCutIn.classList.add("active");
}

specialCutIn.addEventListener("animationend", () => {
  specialCutIn.classList.remove("active");
  specialCutIn.setAttribute("aria-hidden", "true");
});

function useCharacterSpecial(): void {
  const special = SPECIALS[selectedCharacter];
  if (!playerSpecialTest && state.credits < special.cost) {
    input.pulse(.12, .18, 80);
    showToast(`FALTAM ${special.cost - state.credits} MOEDAS`, "coin");
    return;
  }
  if (state.finished || state.liftTime > 0 || state.recovering > 0) return;
  if (!playerSpecialTest) state.credits -= special.cost;
  input.pulse(.82, .92, 360);
  showSpecialCutIn(selectedCharacter);
  playSnowmanVoice("special");
  playGiruVoice("special");
  playYetiVoice("special");
  playGuyVoice("special");
  if (multiplayerActive) multiplayer.sendAction({ id: crypto.randomUUID(), type: "special" });

  if (selectedCharacter === "snowman") {
    snowballSpecial = { active: true, owner: selectedCharacter, s: state.s, x: 0, lap: state.lap, hit: new Set() };
    activateSpecialFx("snowman", .75);
  } else if (selectedCharacter === "yeti") {
    opponents().filter(opponent => !opponent.finished).forEach(applyWindHit);
    view.specialPulse(state, "yeti");
    activateSpecialFx("yeti", 1.35);
  } else if (selectedCharacter === "guy") {
    state.specialTurboTime = 3;
    state.speed = Math.max(state.speed, 58);
    activateSpecialFx("guy", 3);
  } else {
    opponents().forEach(applyTimeWarp);
    view.specialPulse(state, "giru");
    activateSpecialFx("giru", 3);
  }
  showToast(`${special.name}!`, selectedCharacter === "giru" ? "wind" : "clean");
}

function updateSnowballSpecial(step: number): void {
  if (!snowballSpecial.active) return;
  const previousS = snowballSpecial.s;
  snowballSpecial.s = Math.min(COURSE_LENGTH, snowballSpecial.s + 220 * step);
  if (selectedCharacter !== snowballSpecial.owner && state.lap === snowballSpecial.lap && !snowballSpecial.hit.has(selectedCharacter)
    && state.s >= previousS - 6 && state.s <= snowballSpecial.s + 3) {
    handleAppliedRiderEvents(applyRiderFreeze(state));
    snowballSpecial.hit.add(selectedCharacter);
  }
  for (const opponent of opponents()) {
    if (opponent.id === snowballSpecial.owner) continue;
    if (snowballSpecial.hit.has(opponent.id) || opponent.finished || opponent.lap !== snowballSpecial.lap) continue;
    if (opponent.s < previousS - 6 || opponent.s > snowballSpecial.s + 3) continue;
    if (applyFreeze(opponent)) snowballSpecial.hit.add(opponent.id);
  }
  if (snowballSpecial.s >= COURSE_LENGTH) snowballSpecial.active = false;
}

const WIND_RANGE = 74;
function findWindTarget(): { opponent: RivalState; distance: number } | null {
  if (state.liftTime > 0) return null;
  return [rival, guy, giru]
    .filter(opponent => !opponent.finished && opponent.liftTime <= 0 && opponent.lap === state.lap && opponent.stun <= 0 && opponent.s >= state.s - 5)
    .map(opponent => ({ opponent, distance: Math.hypot(opponent.s - state.s, (opponent.x - state.x) * 1.35) }))
    .filter(candidate => candidate.distance <= WIND_RANGE)
    .sort((first, second) => first.distance - second.distance)[0] ?? null;
}

function handleEvent(event: GameEvent): void {
  view.event(event, state); audio.event(event);
  if (event.type === "TAKEOFF") input.pulse(.18, .52, 85);
  if (event.type === "LAND") {
    input.pulse(event.grade === "clean" ? .38 : .65, .42, event.grade === "clean" ? 110 : 170);
    showToast(event.grade === "crash" ? "POUSO PERDIDO" : event.boost > 0 ? `${event.label}  ·  BOOST!` : `${event.label}  +${event.points}`, event.grade === "clean" ? "clean" : event.grade === "crash" ? "crash" : "");
  }
  if (event.type === "NEAR_MISS") { input.pulse(.12, .68, 70); showToast(`POR UM FIO  +${event.points}`, "near"); }
  if (event.type === "COIN") { input.pulse(.08, .22, 42, 20); showToast(`MOEDA  +${event.value}`, "coin"); }
  if (event.type === "ITEM_ACQUIRED") {
    input.pulse(.28, .62, 120);
    showToast(`${event.item === "wind" ? "TIRO DE VENTO" : event.item === "turbo" ? "TURBO" : event.item === "shield" ? "ESCUDO" : "NEVASCA"} EQUIPADO`, event.item === "blizzard" ? "wind" : "clean");
  }
  if (event.type === "ITEM_USED") {
    input.pulse(event.item === "turbo" ? .7 : .35, .65, event.item === "turbo" ? 220 : 140);
    if (event.item === "turbo") { playSnowmanVoice("nitro"); playGiruVoice("nitro"); playYetiVoice("nitro"); playGuyVoice("nitro"); }
    if (event.item === "wind") {
      const target = findWindTarget()?.opponent;
      if (target && applyWindHit(target)) {
        view.windShot(state, target);
        input.pulse(.72, .88, 250);
        showToast(`RAJADA NO ${target.name}!`, "wind");
        playSnowmanVoice("wind-hit");
        playGiruVoice("attack");
        playYetiVoice("attack");
        playGuyVoice("attack");
        const targetId = networkActorIdFor(target);
        if (multiplayerActive && targetId) multiplayer.sendAction({ id: crypto.randomUUID(), type: "wind", targetId });
      }
    } else if (event.item === "blizzard") {
      const affectedRivals = [rival, guy, giru].filter(applyBlizzardSlow).length;
      slowFxTimer = 1.35;
      slowFx.classList.add("active");
      input.pulse(.5, .72, 260);
      showToast("NEVASCA! · RIVAIS LENTOS", "wind");
      if (affectedRivals > 0) { playGiruVoice("attack"); playYetiVoice("attack"); playGuyVoice("attack"); }
      if (multiplayerActive) multiplayer.sendAction({ id: crypto.randomUUID(), type: "blizzard" });
    } else showToast(event.item === "turbo" ? "TURBO!" : "ESCUDO ATIVO!", event.item === "turbo" ? "coin" : "clean");
  }
  if (event.type === "SHIELD_BREAK") { input.pulse(.55, .8, 180); showToast("ESCUDO SALVOU!", "clean"); }
  if (event.type === "CRASH") {
    input.pulse(1, .7, 260);
    showToast("TUMBOU!", "crash");
    playSnowmanVoice("hit");
    playGiruVoice("rage");
    playYetiVoice("rage");
    playGuyVoice("rage");
  }
  if (event.type === "SECTION") showToast(event.name.toUpperCase(), "clean");
  if (event.type === "LIFT") {
    input.pulse(.22, .42, 180);
    liftNextLap.textContent = `Próxima parada · Volta ${event.nextLap}/${RACE_LAPS}`;
    liftTransition.classList.add("active");
    liftTransition.setAttribute("aria-hidden", "false");
  }
  if (event.type === "LAP") {
    liftTransition.classList.remove("active");
    liftTransition.setAttribute("aria-hidden", "true");
    view.snapCameraToRider(state);
    input.pulse(.38, .55, 170);
    showToast(event.lap === RACE_LAPS ? "ÚLTIMA VOLTA!" : `VOLTA ${event.lap}/${RACE_LAPS}`, "clean");
  }
  if (event.type === "FINISH") {
    input.pulse(.45, .8, 420);
    if (multiplayerActive) multiplayer.sendFinish(state.elapsed);
    window.setTimeout(finish, 500);
  }
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
  creditsLabel.textContent = String(state.credits);
  const activeItem = state.item ?? (state.turboTime > 0 ? "turbo" : state.shieldTime > 0 ? "shield" : null);
  itemArt.classList.toggle("hidden", !activeItem);
  itemEmpty.classList.toggle("hidden", Boolean(activeItem));
  if (activeItem) itemArt.src = `${import.meta.env.BASE_URL}images/items/${activeItem}.png`;
  itemHud.dataset.item = activeItem ?? "empty";
  itemHud.classList.toggle("active", Boolean(state.item));
  itemHud.setAttribute("aria-label", activeItem ? `Item equipado: ${activeItem}. Use com R3.` : "Slot de item vazio");
  const special = SPECIALS[selectedCharacter];
  const specialReady = playerSpecialTest || state.credits >= special.cost;
  specialArt.src = `${import.meta.env.BASE_URL}images/specials/${selectedCharacter}.png`;
  specialHud.dataset.character = selectedCharacter;
  specialHud.classList.toggle("ready", specialReady);
  specialHud.setAttribute("aria-label", playerSpecialTest ? `${special.name}. Modo de teste: sempre disponível. Use com L3.` : `${special.name}. Custa ${special.cost} moedas. Use com L3.`);
  specialHud.style.setProperty("--special-progress", `${playerSpecialTest ? 100 : Math.min(100, state.credits / special.cost * 100).toFixed(1)}%`);
  specialProgress.setAttribute("aria-valuemin", "0");
  specialProgress.setAttribute("aria-valuemax", String(special.cost));
  specialProgress.setAttribute("aria-valuenow", String(playerSpecialTest ? special.cost : Math.min(special.cost, state.credits)));
  boostFx.classList.toggle("active", state.turboTime > 0 || state.specialTurboTime > 0);
  boostFx.classList.toggle("special", state.specialTurboTime > 0);
  const target = state.item === "wind" ? findWindTarget() : null;
  windTargetHud.classList.toggle("hidden", !target);
  if (target) {
    windTargetName.textContent = `ALVO · ${target.opponent.name}`;
    windTargetDistance.textContent = `${Math.round(target.distance)} m`;
  }
  updateMapMarker();
}

function updateControllerStatus(): void {
  const available = input.compatible || input.usingDevFallback || input.touchEnabled;
  controllerCard.classList.toggle("connected", available);
  startButton.disabled = !available;
  controllerName.textContent = input.compatible ? input.gamepadName : input.touchEnabled
    ? "Controles touch prontos · jogue na horizontal"
    : input.usingDevFallback ? "Fallback de teclado habilitado para desenvolvimento"
    : input.connected ? `Controle incompatível: ${input.gamepadName}` : "Conecte o DualSense e pressione um botão";
  const devBadge = $("#dev-badge");
  devBadge.textContent = playerSpecialTest
    ? `MODO TESTE · ESPECIAL LIVRE${input.usingDevFallback ? " · TECLADO" : ""}`
    : "MODO DEV · TECLADO";
  devBadge.classList.toggle("hidden", screen !== "playing" || (!input.usingDevFallback && !playerSpecialTest));
  $("#dev-hint").classList.toggle("hidden", input.usingDevFallback);
  if (screen === "playing" && !available) pause(true);
  if (screen === "paused" && disconnectedPause && (input.compatible || input.touchEnabled)) ($("#resume-button") as HTMLButtonElement).disabled = false;
}

function focusables(): HTMLElement[] {
  const active = [titleScreen, campaignScreen, characterScreen, multiplayerScreen, pauseScreen, resultsScreen, settingsScreen, controlsScreen].find(element => !element.classList.contains("hidden"));
  return active ? Array.from(active.querySelectorAll<HTMLElement>(".focusable:not(:disabled)")) : [];
}
function focusFirst(): void {
  const items = focusables();
  document.querySelectorAll(".gamepad-focus").forEach(element => element.classList.remove("gamepad-focus"));
  if (screen === "character") {
    (document.activeElement as HTMLElement | null)?.blur();
    return;
  }
  const preferred = screen === "campaign"
    ? document.querySelector<HTMLElement>(`[data-track-index="${selectedCourseIndex}"]`)
    : screen === "multiplayer"
      ? multiplayerRoom ? $("#ready-button") : $("#quick-match-button")
    : screen === "results"
        ? $("#next-track-button")
        : screen === "controls"
          ? document.querySelector<HTMLElement>("[data-controls-tab].active")
        : screen === "title"
          ? $("#campaign-button")
          : null;
  const target = preferred && items.includes(preferred) ? preferred : items[0];
  if (target) { target.focus({ preventScroll: true }); target.classList.add("gamepad-focus"); }
}
function navigateMenu(direction: MenuAction): void {
  const items = focusables(); if (!items.length) return;
  if (screen === "character" && !characterSelectionActive) {
    const cards = items.filter(item => Boolean(item.dataset.character));
    const target = direction === "left" || direction === "up" ? cards.at(-1) : cards[0];
    if (!target) return;
    items.forEach(item => item.classList.remove("gamepad-focus"));
    target.focus({ preventScroll: false });
    target.classList.add("gamepad-focus");
    selectCharacter(target.dataset.character as CharacterId);
    target.scrollIntoView({ block: "nearest" });
    return;
  }
  let current = items.indexOf(document.activeElement as HTMLElement);
  if (current < 0 && screen === "character") {
    const selectedCard = characterScreen.querySelector<HTMLElement>(`[data-character="${selectedCharacter}"]`);
    current = selectedCard ? items.indexOf(selectedCard) : 0;
  }
  current = Math.max(0, current);
  const delta = direction === "up" || direction === "left" ? -1 : 1, next = (current + delta + items.length) % items.length;
  items.forEach(item => item.classList.remove("gamepad-focus"));
  items[next].focus({ preventScroll: false }); items[next].classList.add("gamepad-focus"); items[next].scrollIntoView({ block: "nearest" });
  if (screen === "character" && items[next].dataset.character) selectCharacter(items[next].dataset.character as CharacterId);
}

menu.addEventListener("pointerover", event => {
  if (!(event instanceof PointerEvent) || event.pointerType !== "mouse") return;
  const target = (event.target as HTMLElement).closest<HTMLElement>(".focusable");
  if (!target) return;
  document.querySelectorAll(".gamepad-focus").forEach(element => element.classList.remove("gamepad-focus"));
  const active = document.activeElement as HTMLElement | null;
  if (active !== target) active?.blur();
  if (screen === "character" && target.dataset.character) selectCharacter(target.dataset.character as CharacterId);
});

function ensureMenuMusic(): void {
  if (screen === "playing" || screen === "paused") return;
  audio.setMenuTrack();
  document.documentElement.dataset.musicTrack = "menu";
  audio.start();
}
function updateMenuInput(): void {
  const direction = input.consumeAnyDirection();
  if (direction) { ensureMenuMusic(); navigateMenu(direction); }
  const confirm = input.consumeMenu("confirm");
  if (confirm) { ensureMenuMusic(); (document.activeElement as HTMLElement | null)?.click(); }
  const back = input.consumeMenu("back");
  if (back) {
    ensureMenuMusic();
    if (screen === "settings") closeSettings();
    else if (screen === "controls") showScreen("settings");
    else if (screen === "character") openCampaign();
    else if (screen === "multiplayer") { leaveMultiplayer(); showScreen("title"); }
    else if (screen === "campaign") showScreen("title");
    else if (screen === "paused") resume();
  }
  if (input.consumeMenu("pause") && screen === "paused" && !disconnectedPause) resume();
}
function openSettings(): void {
  settingsReturn = screen;
  if (screen !== "paused" && screen !== "playing") {
    audio.setMenuTrack();
    document.documentElement.dataset.musicTrack = "menu";
    audio.start();
  }
  showScreen("settings");
}
function closeSettings(): void { showScreen(settingsReturn); }

function showControlsPanel(panel: "dualsense" | "keyboard"): void {
  document.querySelectorAll<HTMLButtonElement>("[data-controls-tab]").forEach(button => {
    const active = button.dataset.controlsTab === panel;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll<HTMLElement>("[data-controls-panel]").forEach(element => {
    element.classList.toggle("hidden", element.dataset.controlsPanel !== panel);
  });
}

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
        let stepIntent = firstStep ? intent : { ...intent, jumpPressed: false, jumpReleased: false, itemPressed: false, specialPressed: false };
        if (stepIntent.itemPressed && state.item === "wind" && !findWindTarget()) {
          stepIntent = { ...stepIntent, itemPressed: false };
          input.pulse(.12, .18, 70);
          showToast("SEM ALVO NO ALCANCE", "wind");
        }
        if (stepIntent.specialPressed) useCharacterSpecial();
        previousRider = { ...state }; const progressBeforeStep = state.s;
        previousRival = { ...rival };
        previousGuy = { ...guy };
        previousGiru = { ...giru };
        for (const event of updateRider(state, stepIntent, fixedStep, currentRacePosition())) handleEvent(event);
        if (!multiplayerActive) {
          for (const event of updateRival(rival, raceProgress(state.lap, state.s), state.x, fixedStep, racePositionOf(rival))) handleRivalEvent(event, rival);
          const leader = raceProgress(rival.lap, rival.s) > raceProgress(state.lap, state.s) ? rival : state;
          for (const event of updateRival(guy, raceProgress(leader.lap, leader.s), leader.x, fixedStep, racePositionOf(guy))) handleRivalEvent(event, guy);
          const frontRunner = raceProgress(guy.lap, guy.s) > raceProgress(leader.lap, leader.s) ? guy : leader;
          for (const event of updateRival(giru, raceProgress(frontRunner.lap, frontRunner.s), frontRunner.x, fixedStep, racePositionOf(giru))) handleRivalEvent(event, giru);
        }
        if (resolveRiderContact(rival, state)) input.pulse(.15, .32, 65);
        if (resolveRiderContact(guy, state)) input.pulse(.15, .32, 65);
        if (resolveRiderContact(giru, state)) input.pulse(.15, .32, 65);
        resolveRivalContact(rival, guy);
        resolveRivalContact(rival, giru);
        resolveRivalContact(guy, giru);
        const racePosition = currentRacePosition();
        if (lastRacePosition > 1 && racePosition === 1) {
          playSnowmanVoice("overtake-first");
          playGiruVoice("overtake-first");
          playYetiVoice("overtake-first");
          playGuyVoice("overtake-first");
        }
        lastRacePosition = racePosition;
        updateSnowballSpecial(fixedStep);
        if (Math.abs(state.s - progressBeforeStep) > 5) previousRider = { ...state };
        if (Math.abs(rival.s - previousRival.s) > 5) previousRival = { ...rival };
        if (Math.abs(guy.s - previousGuy.s) > 5) previousGuy = { ...guy };
        if (Math.abs(giru.s - previousGiru.s) > 5) previousGiru = { ...giru };
        accumulator -= fixedStep; firstStep = false;
      }
      audio.update(state);
      if (multiplayerActive) {
        multiplayerSendTimer += dt;
        if (multiplayerSendTimer >= 1 / 15) {
          multiplayerSendTimer %= 1 / 15;
          multiplayer.sendState(multiplayerSequence++, networkStateOfPlayer());
        }
      }
      if (state.grounded && Math.abs(state.carve) > .45 && state.speed > 16) input.pulse(.04, .12 + Math.abs(state.carve) * .08, 38, 90);
    }
    hudTimer += dt; updateHud(); input.consumeMenu("confirm"); input.consumeMenu("back"); input.consumeAnyDirection();
  } else updateMenuInput();
  toastTimer -= dt; if (toastTimer <= 0) toast.classList.remove("show");
  slowFxTimer -= dt; if (slowFxTimer <= 0) slowFx.classList.remove("active");
  specialFxTimer -= dt; if (specialFxTimer <= 0) specialFx.classList.remove("active");
  const renderState = screen === "playing" && countdown <= 0 ? interpolateRider(previousRider, state, accumulator / fixedStep) : state;
  const renderRival = screen === "playing" && countdown <= 0 ? interpolateRival(previousRival, rival, accumulator / fixedStep) : rival;
  const renderGuy = screen === "playing" && countdown <= 0 ? interpolateRival(previousGuy, guy, accumulator / fixedStep) : guy;
  const renderGiru = screen === "playing" && countdown <= 0 ? interpolateRival(previousGiru, giru, accumulator / fixedStep) : giru;
  view.render(renderState, renderRival, renderGuy, renderGiru, state.item === "wind" ? findWindTarget()?.opponent.id ?? null : null, lastIntentLook, dt, snowballSpecial); requestAnimationFrame(frame);
}

$("#campaign-button").addEventListener("click", openCampaign);
$("#multiplayer-button").addEventListener("click", openMultiplayer);
$("#multiplayer-back-button").addEventListener("click", () => { leaveMultiplayer(); showScreen("title"); });
$("#create-room-button").addEventListener("click", () => void multiplayerOperation(() => multiplayer.createRoom(multiplayerProfile())));
$("#quick-match-button").addEventListener("click", () => void multiplayerOperation(() => multiplayer.quickMatch(multiplayerProfile())));
$("#join-room-button").addEventListener("click", () => {
  const code = ($("#room-code-input") as HTMLInputElement).value;
  if (code.trim().length !== 4) { multiplayerFeedback("Digite os quatro caracteres da sala."); return; }
  void multiplayerOperation(() => multiplayer.joinRoom(code, multiplayerProfile()));
});
$("#copy-room-code-button").addEventListener("click", () => {
  if (!multiplayerRoom) return;
  void navigator.clipboard?.writeText(multiplayerRoom.code).then(() => multiplayerFeedback("Código copiado.")).catch(() => multiplayerFeedback(`Código: ${multiplayerRoom?.code ?? ""}`));
});
$("#leave-room-button").addEventListener("click", leaveMultiplayer);
$("#ready-button").addEventListener("click", () => void multiplayerOperation(() => multiplayer.setReady(!multiplayerReady)));
$("#start-multiplayer-button").addEventListener("click", async () => {
  multiplayerFeedback("");
  multiplayerStarting = true;
  renderMultiplayerRoom();
  try { await multiplayer.startRace(); }
  catch (error) { multiplayerStarting = false; multiplayerFeedback(error instanceof Error ? error.message : "Não foi possível iniciar."); renderMultiplayerRoom(); }
});
document.querySelectorAll<HTMLButtonElement>("[data-multiplayer-character]").forEach(button => button.addEventListener("click", () => {
  if (!multiplayerRoom) return;
  const character = button.dataset.multiplayerCharacter as MultiplayerCharacterId;
  void multiplayerOperation(() => multiplayer.updatePlayer(character, multiplayerProfile().name));
}));
document.querySelectorAll<HTMLButtonElement>("[data-multiplayer-course]").forEach(button => button.addEventListener("click", () => {
  if (!multiplayerRoom) return;
  void multiplayerOperation(() => multiplayer.setCourse(button.dataset.multiplayerCourse as MultiplayerCourseId));
}));

multiplayer.addEventListener("connection", () => {
  const status = $("#multiplayer-connection");
  status.textContent = multiplayer.connected ? "● SERVIDOR CONECTADO" : "○ SERVIDOR INDISPONÍVEL";
  status.classList.toggle("connected", multiplayer.connected);
});
multiplayer.addEventListener("room", event => {
  multiplayerRoom = (event as CustomEvent<MultiplayerRoom | null>).detail;
  renderMultiplayerRoom();
});
multiplayer.addEventListener("race-start", event => beginMultiplayerRace((event as CustomEvent<RaceStart>).detail));
multiplayer.addEventListener("racer-state", event => applyRemoteState((event as CustomEvent<RacerStatePacket>).detail));
multiplayer.addEventListener("bot-state", event => applyBotState((event as CustomEvent<BotStatePacket>).detail));
multiplayer.addEventListener("race-action", event => applyRemoteAction((event as CustomEvent<MultiplayerAction>).detail));
installButton.addEventListener("click", async () => {
  ensureMenuMusic();
  if (installPrompt) {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") installButton.classList.add("hidden");
    installPrompt = null;
    return;
  }
  installHint.classList.toggle("hidden");
});
$("#campaign-back-button").addEventListener("click", () => showScreen("title"));
startButton.addEventListener("click", openCharacterSelect);
$("#character-back-button").addEventListener("click", openCampaign);
$("#character-confirm-button").addEventListener("click", startRun);
document.querySelectorAll<HTMLButtonElement>("[data-character]").forEach(button => button.addEventListener("click", () => {
  selectCharacter(button.dataset.character as CharacterId);
  startRun();
}));
$("#settings-button").addEventListener("click", openSettings);
$("#pause-settings-button").addEventListener("click", openSettings);
$("#settings-back-button").addEventListener("click", closeSettings);
$("#controls-button").addEventListener("click", () => showScreen("controls"));
$("#controls-back-button").addEventListener("click", () => showScreen("settings"));
document.querySelectorAll<HTMLButtonElement>("[data-controls-tab]").forEach(button => button.addEventListener("click", () => {
  showControlsPanel(button.dataset.controlsTab as "dualsense" | "keyboard");
}));
$("#resume-button").addEventListener("click", resume);
$("#quit-button").addEventListener("click", openCampaign);
$("#restart-button").addEventListener("click", startRun);
$("#result-title-button").addEventListener("click", () => { if (multiplayerActive || multiplayerRoom) leaveMultiplayer(); showScreen("title"); });
$("#next-track-button").addEventListener("click", () => {
  if (multiplayerActive) { leaveMultiplayer(); openMultiplayer(); return; }
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
    if (screen === "playing") pause();
    else if (screen === "paused" && !disconnectedPause) resume();
    else if (screen === "settings") closeSettings();
    else if (screen === "controls") showScreen("settings");
    else if (screen === "character") openCampaign();
    else if (screen === "multiplayer") { leaveMultiplayer(); showScreen("title"); }
    else if (screen === "campaign") showScreen("title");
  }
  if (event.key.toLowerCase() === "d" && event.altKey) view.setDebug(true);
});

// Navegadores podem bloquear áudio antes da primeira interação. A tentativa
// acontece já na capa e estes gestos retomam o mesmo tema sem trocar de tela.
window.addEventListener("pointerdown", ensureMenuMusic, { once: true, capture: true });
window.addEventListener("touchstart", ensureMenuMusic, { once: true, capture: true });
window.addEventListener("keydown", ensureMenuMusic, { once: true, capture: true });

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
renderTrackCards(); updateSelectedCourseCopy(); buildRaceMap(); showScreen("title"); ensureMenuMusic(); requestAnimationFrame(frame);
