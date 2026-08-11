import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildTrialResponse, readParticipantMetadata, shuffle } from "../public/js/study.js";

test("reads Prolific metadata and debug mode from a query string", () => {
  assert.deepEqual(
    readParticipantMetadata("?PROLIFIC_PID=p1&STUDY_ID=s1&SESSION_ID=x1&debug=true"),
    {
      prolificId: "p1",
      prolificStudyId: "s1",
      prolificSessionId: "x1",
      debug: true,
    },
  );
});

test("shuffle returns a shuffled copy without changing the source", () => {
  const source = [1, 2, 3, 4];
  const shuffled = shuffle(source, () => 0);

  assert.deepEqual(source, [1, 2, 3, 4]);
  assert.deepEqual(shuffled, [2, 3, 4, 1]);
});

test("buildTrialResponse records stimulus values and correctness", () => {
  const trial = {
    trialId: "trial-1",
    condition: "easy",
    leftSize: 120,
    rightSize: 80,
    correctSide: "left",
  };
  const response = buildTrialResponse(trial, "left", performance.now() - 25, 0);

  assert.equal(response.trialIndex, 1);
  assert.equal(response.trialId, "trial-1");
  assert.equal(response.selectedSide, "left");
  assert.equal(response.correct, true);
  assert.ok(response.responseTimeMs >= 20);
});

test("the example trial file has valid, unique trials", async () => {
  const contents = await readFile(new URL("../public/data/trials.json", import.meta.url), "utf8");
  const trials = JSON.parse(contents);
  const ids = new Set();

  assert.ok(trials.length > 0);
  for (const trial of trials) {
    assert.equal(typeof trial.trialId, "string");
    assert.equal(typeof trial.leftSize, "number");
    assert.equal(typeof trial.rightSize, "number");
    assert.ok(["left", "right"].includes(trial.correctSide));
    assert.ok(!ids.has(trial.trialId), `duplicate trialId: ${trial.trialId}`);
    ids.add(trial.trialId);
  }
});
