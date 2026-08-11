import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const isConfigured = () => (
  firebaseConfig.projectId && !firebaseConfig.projectId.includes("REPLACE_ME")
);

function waitForUser(auth) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      }
    }, reject);
  });
}

export async function connectToBackend() {
  if (!isConfigured()) return { mode: "demo" };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (!auth.currentUser) await signInAnonymously(auth);
  const user = await waitForUser(auth);

  return { mode: "firebase", db, user };
}

export async function saveStudyResults(backend, studySlug, payload) {
  if (backend.mode === "demo") {
    localStorage.setItem(`${studySlug}:latest-response`, JSON.stringify(payload));
    return { mode: "demo", id: payload.clientResponseId };
  }

  const responseRef = doc(
    backend.db,
    "studies",
    studySlug,
    "responses",
    backend.user.uid,
  );

  await setDoc(responseRef, {
    ...payload,
    firebaseUid: backend.user.uid,
    submittedAt: serverTimestamp(),
  });

  return { mode: "firebase", id: backend.user.uid };
}
