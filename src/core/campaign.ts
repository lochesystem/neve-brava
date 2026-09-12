export const CAMPAIGN_CHAPTERS = [
  { name: "Pé da montanha", courses: ["vale-bravo", "canion-cristal"] },
  { name: "Além da floresta", courses: ["bosque-torto", "passagem-geleira", "canion-ferrugem"] },
  { name: "Coroa da montanha", courses: ["pico-tempestade"] },
];
export const CAMPAIGN_ORDER = CAMPAIGN_CHAPTERS.flatMap(chapter => chapter.courses);
export type CampaignSave = { version: 1; results: Record<string, { place: number; time: number }> };
export function readCampaign(raw: string | null): CampaignSave {
  const clean: CampaignSave = { version: 1, results: {} };
  try {
    const data = JSON.parse(raw ?? "null");
    if (data?.version !== 1) return clean;
    for (const id of CAMPAIGN_ORDER) {
      const result = data.results?.[id];
      if (result && Number.isInteger(result.place) && result.place >= 1 && result.place <= 4 && Number.isFinite(result.time) && result.time > 0)
        clean.results[id] = { place: result.place, time: result.time };
    }
  } catch { /* Corrupt or unavailable storage starts a clean campaign. */ }
  return clean;
}
export function courseUnlocked(save: CampaignSave, id: string): boolean {
  const index = CAMPAIGN_ORDER.indexOf(id);
  return index >= 0 && CAMPAIGN_ORDER.slice(0, index).every(previous => (save.results[previous]?.place ?? 4) <= 3);
}
export function recordCampaign(save: CampaignSave, id: string, place: number, time: number): CampaignSave {
  if (!courseUnlocked(save, id) || !Number.isInteger(place) || place < 1 || place > 4 || !Number.isFinite(time) || time <= 0) return save;
  const previous = save.results[id];
  return { version: 1, results: { ...save.results, [id]: { place: Math.min(previous?.place ?? 4, place), time: Math.min(previous?.time ?? Infinity, time) } } };
}
export function nextCampaignCourse(save: CampaignSave, id: string): string | null {
  if (!CAMPAIGN_ORDER.includes(id)) return null;
  const next = CAMPAIGN_ORDER[CAMPAIGN_ORDER.indexOf(id) + 1];
  return next && courseUnlocked(save, next) ? next : null;
}
