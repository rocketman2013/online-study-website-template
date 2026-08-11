import { STUDY_CONFIG } from "./config.js";
import { connectToBackend, saveStudyResults } from "./firebase-service.js";
import { buildTrialResponse, loadTrials, readParticipantMetadata, shuffle } from "./study.js";

const state = {
  backend: null,
  participant: readParticipantMetadata(),
  trials: [],
  trialIndex: 0,
  trialStartedAt: 0,
  responses: [],
  startedAtIso: null,
  acceptingResponse: false,
  finalPayload: null,
  backendError: null,
};

const screens = [...document.querySelectorAll(".screen")];
const progressBar = document.querySelector("#progress-bar");
const progressLabel = document.querySelector("#progress-label");
const backendReady = connectToBackend().catch((error) => {
  state.backendError = error;
  return null;
});

function showScreen(id) {
  screens.forEach((screen) => { screen.hidden = screen.id !== id; });
}

function updateProgress(label, percent) {
  progressLabel.textContent = label;
  progressBar.style.width = `${percent}%`;
}

function showError(error) {
  console.error(error);
  document.querySelector("#error-message").textContent = error.message || "Unknown error.";
  showScreen("error-screen");
}

function renderTrial() {
  if (state.trialIndex >= state.trials.length) {
    finishStudy();
    return;
  }

  const trial = state.trials[state.trialIndex];
  const stimulusArea = document.querySelector("#stimulus-area");
  stimulusArea.replaceChildren();

  ["left", "right"].forEach((side) => {
    const size = side === "left" ? trial.leftSize : trial.rightSize;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stimulus";
    button.dataset.side = side;
    button.setAttribute("aria-label", `Choose ${side} circle`);

    const circle = document.createElement("span");
    circle.className = "circle";
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    button.appendChild(circle);
    button.addEventListener("click", () => recordResponse(side));
    stimulusArea.appendChild(button);
  });

  state.acceptingResponse = true;
  state.trialStartedAt = performance.now();
  updateProgress(
    `Trial ${state.trialIndex + 1} of ${state.trials.length}`,
    (state.trialIndex / state.trials.length) * 100,
  );
}

function recordResponse(selectedSide) {
  if (!state.acceptingResponse) return;
  state.acceptingResponse = false;

  const trial = state.trials[state.trialIndex];
  state.responses.push(
    buildTrialResponse(trial, selectedSide, state.trialStartedAt, state.trialIndex),
  );
  state.trialIndex += 1;
  renderTrial();
}

function buildStudyPayload() {
  return {
    schemaVersion: 1,
    clientResponseId: crypto.randomUUID(),
    studySlug: STUDY_CONFIG.studySlug,
    participant: {
      prolificId: state.participant.prolificId,
      prolificStudyId: state.participant.prolificStudyId,
      prolificSessionId: state.participant.prolificSessionId,
    },
    consented: true,
    startedAt: state.startedAtIso,
    completedAt: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    trialResponses: state.responses,
  };
}

function downloadDemoData() {
  const blob = new Blob([JSON.stringify(state.finalPayload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${STUDY_CONFIG.studySlug}-demo-response.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function finishStudy() {
  showScreen("saving-screen");
  updateProgress("Saving responses", 100);
  state.finalPayload = buildStudyPayload();

  try {
    const result = await saveStudyResults(state.backend, STUDY_CONFIG.studySlug, state.finalPayload);
    const downloadButton = document.querySelector("#download-button");

    if (result.mode === "demo") {
      document.querySelector("#save-message").textContent =
        "Demo mode: responses were stored only in this browser, not sent to Firebase.";
      downloadButton.hidden = false;
    } else if (STUDY_CONFIG.prolificCompletionCode !== "REPLACE_ME") {
      const completionLink = document.querySelector("#completion-link");
      completionLink.href = `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(STUDY_CONFIG.prolificCompletionCode)}`;
      completionLink.hidden = false;
    }

    showScreen("complete-screen");
    updateProgress("Complete", 100);
  } catch (error) {
    showError(new Error("We could not save your responses. Please leave this page open and contact the researcher.", { cause: error }));
  }
}

async function startStudy() {
  showScreen("trial-screen");
  updateProgress("Loading trials", 5);

  try {
    state.backend = await backendReady;
    if (!state.backend) {
      throw new Error("Could not connect to Firebase. Check the browser console and Firebase setup.", {
        cause: state.backendError,
      });
    }
    const loadedTrials = await loadTrials(STUDY_CONFIG.trialsUrl);
    state.trials = STUDY_CONFIG.randomizeTrials && !state.participant.debug
      ? shuffle(loadedTrials)
      : loadedTrials;
    state.startedAtIso = new Date().toISOString();
    renderTrial();
  } catch (error) {
    showError(error);
  }
}

document.querySelector("#consent-form").addEventListener("submit", (event) => {
  event.preventDefault();
  showScreen("instructions-screen");
  updateProgress("Instructions", 5);
});

document.querySelector("#start-button").addEventListener("click", startStudy);
document.querySelector("#download-button").addEventListener("click", downloadDemoData);

document.addEventListener("keydown", (event) => {
  if (event.repeat || !state.acceptingResponse) return;
  if (event.key.toLowerCase() === "f") recordResponse("left");
  if (event.key.toLowerCase() === "j") recordResponse("right");
});
