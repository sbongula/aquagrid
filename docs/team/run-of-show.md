# AquaGrid — run of show

Six parts, about seven minutes plus questions. Every number below is one the app computes; none of it needs to be remembered, but saying the specific figure is what makes it land.

| # | Who | Part | Time |
|---|---|---|---|
| 1 | **Rishik** | The problem | 60–75 s |
| 2 | **Neekin** | The solution | 60–75 s |
| 3 | **Srihan** | The architecture | 60–75 s |
| 4 | **Ednit** | The features | 75–90 s |
| 5 | **All** | The demo | 90 s |
| 6 | **Gowtham** | The code and the site | 60 s |

## 1 · The problem — Rishik
*60–75 s*

- On a small isolated island, water and energy are the same problem. Fresh water comes from rain when it falls and from a desalination plant when it does not — and that plant is the single largest electrical load on the island.

- The power comes from solar when the sun is up and from a diesel generator when it is not. The diesel arrives by barge every few weeks, whether or not you are running low.

- So every hour there is a real decision: make water now, or wait. At noon on a clear day it is nearly free. At 02:00 it costs imported fuel. And the tank holds a day or two — so the decision *can* be deferred, if you know what tomorrow looks like.

- Almost nowhere is that decision made. It is delegated to a wall timer, usually set to overnight hours inherited from mainland off-peak electricity tariffs. On a solar island that is exactly backwards: those are the hours with no sun.

- Tuvalu makes it concrete. The freshwater lens is thin and salt-contaminated, so the island runs on rain. In 2011 a drought left Funafuti with days of water and a declared state of emergency. The plant was not too small — nobody could see far enough ahead to act early.

**Hand off:** “So the question is what you could do with a forecast. Neekin.”

## 2 · The solution — Neekin
*60–75 s*

- One idea holds the whole thing together: predict demand once, and share that forecast with everything else.

- Four stages. Predict — a random forest forecasts water demand 48 hours ahead. Decide — eight rules with a 12-hour lookahead dispatch the pump across solar, battery, rain and diesel. Explain — every hour carries a plain-language reason. Detect — the same forecast catches failures nobody would notice.

- The model: mean error 45.3 litres per hour, R-squared 0.987, 89% better than predicting the average. Tested on a chronological split — the last 60 days held out, so it is evaluated on the future, never on shuffled rows.

- The result on our test island: 78% less diesel than the fixed timer these plants run today. Same water, fewer pump hours — it just chooses which hours.

- But the number that matters more: the fuel tank holds 300 litres and the next barge is 12 days away. AquaGrid's burn rate makes that last 39 days. The fixed timer runs dry 3.4 days early. The reactive controller, 4.4 days early. Burning too much diesel and running out of diesel are different failures.

- And none of this asks anyone to buy hardware. The panels, the tank and the plant already exist.

**Hand off:** “The interesting part is how that runs on a phone. Srihan.”

## 3 · The architecture — Srihan
*60–75 s*

- Four layers. Python trains — once. A single JSON file is the contract. Pure JavaScript decides. React Native presents.

- The laptop trains the model and is then out of the loop: not needed at runtime, not to change island, not for fresh weather. The phone fetches its own forecast.

- The key move is that we ship the model, not only its predictions. Every feature the forecaster uses is categorical except temperature — so we evaluate the trained forest exhaustively over its entire input grid and export a 15,120-cell lookup table. That is the model, not an approximation: the only loss is temperature rounded to half a degree, costing 5.5 litres per hour against the model's own 45.

- So the forecaster genuinely runs on the phone, for islands the laptop never saw. 72 predictions in 0.011 milliseconds. The full recompute — schedule, both baselines, all four detectors — 0.15 milliseconds.

- There is no backend, on purpose. An app that needs a server to decide whether to run a pump fails exactly when an island is cut off. Put the phone in airplane mode and nothing stops working.

- One distinction worth stating plainly: there are two AI systems here. The random forest makes every decision. The language model makes none — it only phrases what the scheduler already decided. Remove it and every number is unchanged.

**Hand off:** “Ednit will show you what that actually does.”

## 4 · The features — Ednit
*75–90 s*

- Eight rules, strict priority, first match wins. Storm preparation. Emergency below the reserve floor. Rain hold. Free solar. Stored solar. Pre-emptive hybrid. Reluctant diesel. Hold.

- Rules 3, 5 and 6 are where the forecast earns its keep — they act on information the plant does not yet have. Rule 5 spends a little diesel now to avoid a lot tonight.

- Rain is not a bolt-on. Tuvalu is rainwater-fed, so precipitation flows straight into the tank balance, and the scheduler holds the pump when a shower is coming. Over our horizon rain supplied 24% of all water.

- A 150 kWh battery carries midday surplus into the evening peak: 66 kWh went back out to the pump, and 304 kWh was curtailed — sun that arrived with the battery full. That last number is the honest ceiling on what a bigger battery would buy.

- Then four detectors, all the same idea — compare what the plant does against what the forecast says it should. A 450 L/h burst pipe caught in two hours. Panels 13% below irradiance. Membranes fouling, clean-in-place due in 40 days. Fuel against the barge.

- It also talks to the village, not just the plant: the free-solar windows when water costs nothing, and supply per person per day against the WHO minimum of 15 litres.

- And it works for any island on Earth — search a name and everything re-runs on-device.

**Hand off:** “Which is easier to show than describe.”

## 5 · The demo — All
*90 s*

- Open the app. Read the current decision and its reason line out loud — it is a sentence, not a status code.

- The chart: point at the dashed pump-draw line. Green hours are free solar, cyan is stored solar running the pump after dark, amber is a deliberate partial-solar top-up.

- Scroll to the savings, say the percentage, then the fuel card: both naive schedulers run dry before the barge.

- Tap Simulate burst pipe. The alert fires. “Caught from the forecast residual, not a threshold — no human would have noticed for hours.”

- Tap Simulate cyclone. The objective flips from saving fuel to filling the tank.

- Change the island. Everything recomputes on-device.

- Ask the operator a question, then a follow-up.

- Airplane mode. Everything still works. End there.

**Hand off:** “Gowtham can show you it is real underneath.”

## 6 · The code and the site — Gowtham
*60 s*

- The decision layer is 755 lines with no dependencies beyond the language, and no React imports at all — which is why it can be tested without a phone.

- Run `node src/logic/test.js` live. It prints all three strategies, the savings, the leak result, and asserts the lookup table stays within a quarter of the model's own error.

- Repository: ml/ trains and exports; logic/ decides and detects; lib/ handles location and the LLM; components/ is presentation only.

- APIs: Open-Meteo for forecast and geocoding — no key, no account — and Groq for the narration, which is optional. Nothing else touches the network.

- The website and the 32-page handbook are in the same repo, and the site's charts are generated from the real forecast rather than screenshots, so they cannot drift from what the app computes.

**Hand off:** “Happy to take questions.”

## Notes

- **Pace the AI taps.** Three questions in quick succession can hit Groq's free-tier rate limit. It fails to the on-device template, which is safe but less impressive. Leave a couple of seconds between.
- **Move the Expo Go gear button** out of the way before recording; it is Expo's dev overlay, not ours.
- **End on airplane mode.** It is the strongest closing beat available.
- **If asked whether the AI is real:** the random forest is trained by us, on a chronological split, and makes every decision. The language model makes none. Removing it changes no number.
- **If asked why Reykjavík is only 23%:** because there is barely any sun there to schedule against. It is in the table on purpose — a smaller honest number beats a larger indefensible one.

