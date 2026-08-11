# Beginner's guide to this online study website

This project is a small example website for an online behavioral study. A participant reads a consent page, reads the instructions, completes several trials, and has their responses saved in Firebase.

The example task asks a participant to choose the larger of two circles. You can replace that task with your own stimuli and questions after you understand how the example fits together.

## Start here: do I need to know npm?

No. This website has **no installed npm packages** and no build step.

The browser downloads the Firebase library directly from Google's website. The code that does that is at the top of `public/js/firebase-service.js`.

There is a `package.json` file, but it only creates this convenient test command:

```bash
npm test
```

Running that command tells npm to run Node's built-in test tool. It does not download anything. You can build and run the website without using that command.

Later, when you are ready to publish the website, one way to install the Firebase command-line tool is:

```bash
npm install -g firebase-tools
```

In that command, npm is only acting as an installer for the Firebase tool. It is not adding libraries to this website. You can also use the Firebase Console's Cloud Shell if you do not want to install the tool on your computer.

## The big picture: how does a website work?

There are two main pieces:

```text
Participant's web browser                 Firebase
-------------------------                 --------
Shows pages and stimuli         ------>   Stores finished responses
Runs the trial loop             <------   Says whether a save succeeded
Collects clicks and key presses

             frontend                       backend
```

The **frontend** is everything that runs in the participant's browser. In this project, that is the HTML, CSS, JavaScript, and trial JSON inside the `public` folder.

The **backend** is the service on the internet that stores data and controls who is allowed to use it. Firebase is our backend. Cloud Firestore is the database inside Firebase.

Firebase Hosting also keeps copies of the frontend files and sends them to participants when they visit the study URL.

### What happens when a participant visits?

1. The participant opens the study URL.
2. Firebase Hosting sends `index.html` to their browser.
3. `index.html` tells the browser to load `styles.css` and `js/app.js`.
4. `app.js` loads the other JavaScript files it needs.
5. The browser shows the consent and instruction screens.
6. When the study starts, `study.js` loads the list of trials from `data/trials.json`.
7. `app.js` shows one trial, waits for an answer, records it, and then shows the next trial.
8. At the end, `firebase-service.js` sends one response document to Cloud Firestore.
9. Firestore checks `firestore.rules`. It saves the document only if the request follows our rules.
10. The website shows the completion screen and can send the participant back to Prolific.

## How the files connect to one another

You do not need to understand every line at once. Start with this map:

| File | What it does | Connected to |
| --- | --- | --- |
| `public/index.html` | Contains the words, buttons, and study screens | Loads `styles.css` and `js/app.js` |
| `public/styles.css` | Controls colors, spacing, circle appearance, and phone layout | Used by the class names in `index.html` and `app.js` |
| `public/js/app.js` | Controls the order of screens and loops through trials | Imports `config.js`, `study.js`, and `firebase-service.js` |
| `public/js/config.js` | Holds short settings such as the study name and Prolific completion code | Read by `app.js` |
| `public/js/study.js` | Loads, shuffles, and formats trials and responses | Called by `app.js` |
| `public/data/trials.json` | Contains the conditions shown on each trial | Loaded by `study.js` |
| `public/js/firebase-config.js` | Identifies which Firebase project belongs to this website | Read by `firebase-service.js` |
| `public/js/firebase-service.js` | Signs in and saves the finished response to Firestore | Called by `app.js` |
| `firestore.rules` | Decides which database requests are allowed | Deployed to Firebase, not loaded as part of the page |
| `firebase.json` | Tells the Firebase command-line tool what to host and which rules to deploy | Used when testing or publishing with Firebase |

There are two separate steps that load the JavaScript.

First, this line near the bottom of `index.html` tells the browser to load and run `app.js`:

```html
<script type="module" src="js/app.js"></script>
```

- `script` means “load JavaScript.”
- `src="js/app.js"` gives the location of the file.
- `type="module"` allows `app.js` to load functions and settings from other JavaScript files.

Second, the first three lines inside `app.js` load code from those other files:

```js
import { STUDY_CONFIG } from "./config.js";
import { connectToBackend, saveStudyResults } from "./firebase-service.js";
import { buildTrialResponse, loadTrials, readParticipantMetadata, shuffle } from "./study.js";
```

For example, `loadTrials` is written and exported in `study.js`. The third `import` line makes it available inside `app.js`. Later, `app.js` can run it like this:

```js
const loadedTrials = await loadTrials(STUDY_CONFIG.trialsUrl);
```

So the chain is:

```text
index.html loads app.js using a <script> tag
                         ↓
app.js loads selected code from the other JavaScript files using import statements
```

`index.html` does not contain an `import` statement. Its `<script>` tag starts the chain.

## How the trial loop works

Each object in `public/data/trials.json` describes one trial:

```json
{
  "trialId": "main-01",
  "leftSize": 104,
  "rightSize": 118,
  "correctSide": "right",
  "condition": "close"
}
```

For this example, `leftSize` and `rightSize` control the circle sizes. `correctSide` is the expected answer. `condition` is a useful label for later analysis.

The `state` object near the top of `app.js` is the website's short-term memory. It keeps the trial list, current trial number, participant information, and responses while the page is open.

### Showing and hiding whole screens

`index.html` contains several `<section>` elements: welcome, instructions, trial, saving, complete, and error. Most start with the `hidden` attribute:

```html
<section id="instructions-screen" class="card screen" hidden>
  ...instructions go here...
</section>

<section id="trial-screen" class="card screen trial-screen" hidden>
  <p class="trial-prompt">Select the larger circle</p>
  <div id="stimulus-area" class="stimulus-area"></div>
</section>
```

Yes: `hidden` tells the browser not to display that element. Notice that `stimulus-area` starts empty. The circles are not written in the HTML ahead of time; JavaScript creates new circles for each trial.

`app.js` first finds all elements with the `screen` class:

```js
const screens = [...document.querySelectorAll(".screen")];
```

When the website needs a different screen, it calls `showScreen()`:

```js
function showScreen(id) {
  screens.forEach((screen) => {
    screen.hidden = screen.id !== id;
  });
}
```

If a screen's ID matches the requested ID, `screen.hidden` becomes `false` and the browser displays it. Every other screen gets `screen.hidden = true` and disappears. For example:

```js
showScreen("trial-screen");
```

shows the trial section and hides the welcome, instructions, saving, complete, and error sections. The CSS controls what the visible screen looks like; JavaScript controls which screen is currently visible.

### Starting the trials

This line connects the Start button to the `startStudy` function:

```js
document.querySelector("#start-button").addEventListener("click", startStudy);
```

An **event listener** means: “When this event happens, run this function.” Here the event is a click.

`startStudy()` shows the trial screen, loads the objects from `trials.json`, puts them in `state.trials`, and starts the first trial:

```js
async function startStudy() {
  showScreen("trial-screen");

  const loadedTrials = await loadTrials(STUDY_CONFIG.trialsUrl);
  state.trials = STUDY_CONFIG.randomizeTrials
    ? shuffle(loadedTrials)
    : loadedTrials;
  state.trialIndex = 0;
  renderTrial();
}
```

The real function also connects to Firebase and handles possible errors. The shortened version above shows the main sequence.

### Drawing one trial on the screen

`renderTrial()` looks up the current trial using `state.trialIndex`:

```js
const trial = state.trials[state.trialIndex];
const stimulusArea = document.querySelector("#stimulus-area");
stimulusArea.replaceChildren();
```

`replaceChildren()` removes the circles from the previous trial. JavaScript then creates a button and circle for the left side and another button and circle for the right side:

```js
const button = document.createElement("button");
button.className = "stimulus";

const circle = document.createElement("span");
circle.className = "circle";
circle.style.width = `${size}px`;
circle.style.height = `${size}px`;

button.appendChild(circle);
stimulusArea.appendChild(button);
```

`createElement()` creates a new HTML element in memory. `appendChild()` places it inside another element. After `stimulusArea.appendChild(button)`, the new button and circle appear inside the empty `stimulus-area` from `index.html`. The `.stimulus` and `.circle` rules in `styles.css` give them their appearance.

The real function repeats this code for both sides and uses `leftSize` or `rightSize` from the current trial to set each circle's size.

### Waiting for the participant

JavaScript does not pause inside a loop while it waits. Instead, it adds event listeners and then finishes `renderTrial()`. The browser waits for the next click or key press.

Each circle button receives a click listener:

```js
button.addEventListener("click", () => recordResponse(side));
```

There is also one keyboard listener for the entire page:

```js
document.addEventListener("keydown", (event) => {
  if (event.repeat || !state.acceptingResponse) return;
  if (event.key.toLowerCase() === "f") recordResponse("left");
  if (event.key.toLowerCase() === "j") recordResponse("right");
});
```

When the participant clicks a circle or presses F/J, the appropriate listener calls `recordResponse("left")` or `recordResponse("right")`.

### Recording an answer and moving forward

At the end of `renderTrial()`, the website records when the trial appeared:

```js
state.acceptingResponse = true;
state.trialStartedAt = performance.now();
```

Then `recordResponse()` saves the answer:

```js
function recordResponse(selectedSide) {
  if (!state.acceptingResponse) return;
  state.acceptingResponse = false;

  const trial = state.trials[state.trialIndex];
  const response = buildTrialResponse(
    trial,
    selectedSide,
    state.trialStartedAt,
    state.trialIndex,
  );

  state.responses.push(response);
  state.trialIndex += 1;
  renderTrial();
}
```

Setting `acceptingResponse` to `false` prevents a double-click from recording two answers. `buildTrialResponse()` combines the trial information, selected side, accuracy, and response time into a JavaScript object. `push()` adds that object to the `state.responses` array. The code then increases the trial number and calls `renderTrial()` again.

At the top of `renderTrial()`, this check decides whether to show another trial or finish:

```js
if (state.trialIndex >= state.trials.length) {
  finishStudy();
  return;
}
```

### Turning the responses into saved data

During the task, `state.responses` is an array of JavaScript objects held in the browser's memory. It is not changing the original `trials.json` file. Websites cannot rewrite a hosted JSON file this way.

When the trials are finished, `finishStudy()` builds one final JavaScript object and asks the Firebase service to save it:

```js
state.finalPayload = buildStudyPayload();
await saveStudyResults(
  state.backend,
  STUDY_CONFIG.studySlug,
  state.finalPayload,
);
```

In `firebase-service.js`, Firebase's `setDoc()` sends that object to Cloud Firestore:

```js
await setDoc(responseRef, {
  ...payload,
  firebaseUid: backend.user.uid,
  submittedAt: serverTimestamp(),
});
```

The Firebase library converts the JavaScript values into a format Firestore can store. In demo mode, `JSON.stringify(payload)` instead turns the object into JSON text and saves it in the browser's `localStorage`.

The whole response stays in browser memory until the task is complete, and then the template makes one database write containing all trials. This is simple and uses less of the Firebase free quota. The tradeoff is that closing the tab halfway through loses the unfinished response.

## How the frontend talks to the backend

The old AWS study sent `fetch()` requests to API Gateway and Lambda URLs. In this version, `firebase-service.js` uses Firebase's JavaScript library.

There are two important functions:

- `connectToBackend()` connects to your Firebase project and anonymously signs in the browser.
- `saveStudyResults()` sends the finished response to Cloud Firestore.

The Firebase library handles the internet request for us. Firestore receives the request and checks `firestore.rules` before accepting it.

The data is saved at a location that looks like this:

```text
studies
└── online-study-template
    └── responses
        └── anonymous-firebase-user-id
```

Each final item under `responses` is one Firestore **document**, similar to one row in a spreadsheet. It contains participant metadata and an array of their trial responses.

Researchers can see and export these documents in the Firebase Console. The public website is not allowed to read them back.

## Firebase API keys and GitHub

The short answer is: **the Firebase web configuration may be committed to GitHub**.

Paste the object Firebase gives you into `public/js/firebase-config.js`:

```js
export const firebaseConfig = {
  apiKey: "the-value-from-firebase",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "the-value-from-firebase",
  appId: "the-value-from-firebase",
};
```

Firebase's web `apiKey` is different from a password. It tells Firebase which project the website wants to use. It does not give someone permission to read or change the database by itself.

Also, hiding this file from GitHub would not hide it from participants. A browser must receive these values to connect to Firebase, and a visitor can inspect any file received by their browser. There is no safe way to put a real secret inside frontend JavaScript.

These items **are real secrets and must never be placed in `public`, frontend JavaScript, or a public GitHub repository**:

- Firebase Admin SDK service-account JSON files
- private keys
- database passwords
- App Check debug tokens
- API keys for services that treat their keys as passwords

### What actually protects the database?

The protection comes from several layers:

1. **Firestore Rules:** The included rules allow a signed-in browser to create its own response document. They deny reading, changing, and deleting study responses.
2. **Anonymous Authentication:** Firebase gives each browser a temporary identity. The rules require the saved document ID to match that identity.
3. **API restrictions:** Firebase-created web keys are normally restricted to Firebase-related APIs. Check the key in Google Cloud Console under **APIs & Services → Credentials** and do not reuse it for unrelated services.
4. **App Check:** This optional extra layer helps reject requests that did not come through your real website. Add it before a larger public launch after the basic template is working.

The included rules also allow writes only to the study named `online-study-template`. If you change `studySlug` in `public/js/config.js`, change the matching study name in `firestore.rules` too, and redeploy the rules.

No browser-only design can guarantee that every response came from a genuine Prolific participant. Someone can inspect frontend code or automate submissions. If a study needs secret trial selection, strict duplicate checking, sensitive information, or verified participant identity, talk with the PI, IRB, and institutional IT about using a server-controlled API.

## Run the website on your computer

Do not double-click `index.html`. The browser needs a small local web server so that JavaScript can load the other files.

Open a terminal in this project folder and run:

```bash
python3 -m http.server 8080 --directory public
```

Then open [http://localhost:8080](http://localhost:8080).

The placeholder Firebase configuration puts the website in **demo mode**. At the end, data is saved only in that browser and can be downloaded as a JSON file. Nothing is sent to Firebase.

This URL imitates the information Prolific adds:

```text
http://localhost:8080/?PROLIFIC_PID=test-person&STUDY_ID=test-study&SESSION_ID=test-session&debug=true
```

`debug=true` keeps trials in the order written in `trials.json`, which makes testing easier.

## Connect the website to Firebase

Follow these steps one at a time:

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project on the free Spark plan.
2. On the project overview page, click the Web icon (`</>`) to register a web app.
3. Firebase will show a `firebaseConfig` object. Copy its values into `public/js/firebase-config.js`.
4. In Firebase Console, open **Build → Authentication → Sign-in method** and enable **Anonymous**.
5. Open **Build → Firestore Database** and create a database. Choose production/locked rules because this repository supplies its own rules.
6. Install the [Firebase command-line tool](https://firebase.google.com/docs/cli), or open Cloud Shell from the Firebase Console.
7. In this project folder, connect the folder to your Firebase project:

   ```bash
   firebase login
   firebase use --add
   ```

8. Publish both the website and its database rules:

   ```bash
   firebase deploy --only hosting,firestore:rules
   ```

Firebase will print a public address ending in `.web.app`. Open that address, finish a test response, and confirm that a document appears in Firestore under:

```text
studies / online-study-template / responses
```

If the study can show trials but cannot save, check these three things first:

- Were the values copied correctly into `firebase-config.js`?
- Is Anonymous Authentication enabled?
- Were `firestore.rules` deployed?

## Connect the website to Prolific

Prolific adds three pieces of information to the study URL:

- `PROLIFIC_PID`: which participant opened the study
- `STUDY_ID`: which Prolific study they joined
- `SESSION_ID`: which Prolific submission this is

`study.js` reads these values from the URL. `app.js` includes them in the final response document.

Replace `REPLACE_ME` in `public/js/config.js` with your Prolific completion code. At the end of a successfully saved study, the participant will see a button that returns them to Prolific.

## Change the example into a new study

Make one small change at a time and test after every change:

1. Replace the consent and instruction words in `public/index.html` with IRB-approved language.
2. Change `studySlug` in `public/js/config.js`.
3. Change the same study name in `firestore.rules`.
4. Replace the objects in `public/data/trials.json` with your trial conditions.
5. Change `renderTrial()` in `public/js/app.js` to draw your new stimulus.
6. Change `buildTrialResponse()` in `public/js/study.js` so it records everything needed for analysis.
7. Test locally with `debug=true`.
8. Deploy, submit a test response, and inspect the saved Firestore document.

Always save enough information to reconstruct what the participant saw. For example, save the stimulus IDs and condition as well as their answer and response time.

## Before collecting real data

- Remove all placeholder consent and instruction text.
- Use a separate Firebase project for each real study or carefully separate studies by name.
- Confirm public database reads are denied.
- Submit test responses from several browsers and phones.
- Confirm every needed value appears in the Firestore document.
- Test the Prolific URL parameters and completion button.
- Review who can access the Firebase Console and exported data.
- Review the current Firebase free-tier limits.
- Ask the PI and IRB to approve the data storage, access, and retention plan.
- Archive the exact code and `trials.json` used for data collection.

## Official Firebase help

- [What Firebase API keys mean](https://firebase.google.com/docs/projects/api-keys)
- [Add Firebase to a website](https://firebase.google.com/docs/web/setup)
- [Anonymous Authentication](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- [Firebase plans and free-tier information](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Firestore free quota and pricing](https://firebase.google.com/docs/firestore/pricing)
- [Hosting limits and pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
