# AquaGrid — run of show

**One minute each, six minutes total**, plus the demo and questions. Slide deck: `slides.html` (arrow keys, `F` for fullscreen) or `AquaGrid-Slides.pdf`.

| Who | Part | Slides | Time |
|---|---|---|---|
| **Rishik** | The problem | 2–4 | 60 s |
| **Neekin** | The solution | 5–8 | 60 s |
| **Srihan** | The architecture | 9–11 | 60 s |
| **Ednit** | The features | 12–14 | 60 s |
| **All** | Demo | 15 | 60 s |
| **Gowtham** | The code and the site | 16–17 | 60 s |

Every number below is one the app computes. Saying the specific figure is what makes it land — but none of it needs memorising, it is all on the slide.

## Rishik — The problem
*Slides 2–4 · 60 seconds*

- Water and energy are the same problem on an island. Fresh water is rain when it falls, desalination when it isn't — and that plant is the biggest electrical load there is.

- Its power is solar by day, diesel by night. The diesel comes by barge every few weeks, whether or not you're running low.

- So every hour is a decision: make water now, or wait. Noon on a clear day is nearly free. 02:00 costs imported fuel. And the tank holds a day or two — so you *can* wait, if you know what tomorrow looks like.

- Almost nowhere is that decision made. It's a wall timer, set to overnight hours borrowed from mainland off-peak tariffs. On a solar island that's exactly backwards.

- Tuvalu makes it real: in 2011 a drought left Funafuti with days of water and a state of emergency. The plant wasn't too small — nobody could see far enough ahead.

**Hand off:** “So what could you do with a forecast? Neekin.”

## Neekin — The solution
*Slides 5–8 · 60 seconds*

- One idea: predict demand once, and share that forecast with everything else.

- Predict, decide, explain, detect. A random forest forecasts 48 hours out; eight rules dispatch the pump across solar, battery, rain and diesel.

- The model is honest — 45.3 litres per hour mean error, R-squared 0.987, 89% better than predicting the average, tested on the 60 days that came *after* the ones it learned from.

- Result: 78% less diesel than the timer these plants run today. Same water, fewer pump hours — it just picks which hours.

- But here's the number that matters more. 300 litres of fuel, 12 days to the barge. We make it last 39. The fixed timer runs dry 3.4 days early; the reactive one, 4.4. Burning too much fuel and running out are different failures.

**Hand off:** “The interesting part is that this runs on a phone. Srihan.”

## Srihan — The architecture
*Slides 6–7 · 60 seconds*

- It all runs on the phone. The app is React Native — one screen, eighteen components, charts hand-drawn in SVG because a charting library is one more thing that can break.

- The brain is a RandomForest, trained offline in scikit-learn and **bundled inside the app**. There is no server call to make a prediction.

- The phone fetches its own weather from Open-Meteo — solar, temperature, rain and wind — with no API key. And Groq serves an open-weight model, GPT-OSS 120B, that writes the briefing and answers questions. That one is optional.

- The trick that makes it work on-device: every feature is categorical except temperature, so we evaluate the trained forest over its entire input grid and carry the whole thing as a 15,120-cell table. That is the model, not a sample of it — the only loss is temperature rounded to half a degree, 5.5 litres against its own 45.

- 72 predictions in 0.011 milliseconds. So it forecasts for islands the laptop never saw, with no ML runtime and no signal.

- And there is no backend, deliberately — an app that needs a server to decide whether to run a pump fails exactly when an island is cut off.

- Two AI systems, and only one decides: the forest makes every call, the language model makes none. Remove it and no number changes.

**Hand off:** “Ednit will show you what it actually does.”

## Ednit — The features
*Slides 12–14 · 60 seconds*

- Here's one real day. Amber is solar, cyan is demand, the dashed line is the pump draw. Bars along the top are rain. The strip underneath is what the pump actually did.

- Eight rules, first match wins. Three of them act on information the plant doesn't have yet — rain hold, stored solar, and the pre-emptive hybrid that spends a little diesel now to avoid a lot tonight.

- Rain isn't a bolt-on: Tuvalu is rainwater-fed, and it supplied 24% of all water here. The battery carried 66 kilowatt-hours of midday sun into the evening peak — and 304 were curtailed, which is the honest ceiling on a bigger battery.

- Then four detectors, all the same idea — compare what the plant does against what the forecast says it should. Burst pipe in two hours. Panels 13% down. Membranes due in 40 days. Fuel against the barge.

**Hand off:** “Easier to show than describe.”

## All — Demo
*Slides 15 · 60 seconds*

- Current decision — read the reason line out loud. It's a sentence, not a status code.

- Chart and timeline: green is free solar, cyan is stored solar after dark, amber is a deliberate top-up.

- Savings, then the fuel card.

- Simulate burst pipe — the alert fires. “Caught from the forecast residual, not a threshold.”

- Simulate cyclone — the objective flips from saving fuel to filling the tank.

- Change the island. Everything recomputes on-device.

- Ask the operator a question, then a follow-up.

- Airplane mode. Nothing stops working. End there.

**Hand off:** “Gowtham can show you it's real underneath.”

## Gowtham — The code and the site
*Slides 16–17 · 60 seconds*

- The decision layer is 755 lines, no dependencies beyond the language, and zero React imports — which is why it tests without a phone.

- Run `node src/logic/test.js` live: all three strategies, the savings, the leak result, and an assertion that the lookup table stays within a quarter of the model's own error.

- ml/ trains and exports. logic/ decides and detects. lib/ handles location and the LLM. components/ is presentation only.

- APIs: Open-Meteo for forecast and geocoding — no key, no account — and Groq for narration, which is optional. Nothing else touches the network.

- The site and the 32-page handbook are in the same repo, and the site's charts are generated from the real forecast, so they can't drift from what the app computes.

**Hand off:** “Happy to take questions.”

## On the day

- **Pace the AI taps.** Three questions in quick succession can hit Groq's free-tier limit. It falls back to the on-device template — safe, but less impressive. Leave a couple of seconds.
- **Move the Expo Go gear button** out of shot. It is Expo's dev overlay, not ours.
- **End on airplane mode.** Strongest closing beat available.
- **“Is the AI real?”** The random forest is trained by us on a chronological split and makes every decision. The language model makes none.
- **“Why is Reykjavík only 23%?”** Because there is barely any sun there to schedule against. It is in the table on purpose — a smaller honest number beats a larger indefensible one.

