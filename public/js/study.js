export function readParticipantMetadata(search = window.location.search) {
  const params = new URLSearchParams(search);

  return {
    prolificId: params.get("PROLIFIC_PID") || "not-provided",
    prolificStudyId: params.get("STUDY_ID") || "not-provided",
    prolificSessionId: params.get("SESSION_ID") || "not-provided",
    debug: params.get("debug") === "true" || params.get("debug") === "1",
  };
}

export async function loadTrials(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load trials (${response.status}).`);

  const trials = await response.json();
  if (!Array.isArray(trials) || trials.length === 0) {
    throw new Error("The trial file must contain a non-empty JSON array.");
  }

  return trials;
}

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function buildTrialResponse(trial, selectedSide, startedAt, trialIndex) {
  return {
    trialIndex: trialIndex + 1,
    trialId: trial.trialId,
    condition: trial.condition,
    leftSize: trial.leftSize,
    rightSize: trial.rightSize,
    correctSide: trial.correctSide,
    selectedSide,
    correct: selectedSide === trial.correctSide,
    responseTimeMs: Math.round(performance.now() - startedAt),
  };
}
