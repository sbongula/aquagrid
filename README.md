# AquaGrid

**An AI that forecasts an island's water demand, schedules desalination against the solar forecast, harvests the rain, and catches failures nobody would notice until they were expensive.**

**The island is a parameter, not a constant.** Search any place on Earth by name — AquaGrid fetches its real solar, temperature, rainfall and wind, forecasts its water demand *on the phone*, sizes a plant to its population, and re-runs every decision. Funafuti, Tuvalu is the worked example used throughout this README; every number below changes when you change the island. See [Any location](#any-location).

DreamHacks 2026 · Track 2 — AI, Automation & Logic
Repo: [github.com/sbongula/aquagrid](https://github.com/sbongula/aquagrid) · Site: [sbongula.github.io/aquagrid](https://sbongula.github.io/aquagrid)
**Team handbook:** [AquaGrid-Team-Handbook.pdf](docs/team/AquaGrid-Team-Handbook.pdf) — 35 pages, every file and every tuned value explained.
**Devpost story:** [devpost.md](docs/team/devpost.md)
**Presentation:** [slides.html](docs/team/slides.html) · [AquaGrid-Slides.pdf](docs/team/AquaGrid-Slides.pdf) · [run of show](docs/team/run-of-show.md)

---

## The problem

On a small isolated island, water and energy are the same problem. Fresh water comes from rain when it falls and from a desalination plant when it does not, and that plant is usually the single largest electrical load on the island. The electricity comes from solar when the sun is up and from a diesel generator when it is not — and the diesel arrives by barge, every few weeks, whether or not you are running low.

So every hour there is a real decision: make water now, or wait. Making it at noon on a clear day is nearly free. Making it at 02:00 costs imported fuel. And the tank is a battery — it will hold a day or two of demand — which means the decision can be deferred, if you know what tomorrow looks like.

Almost nowhere is that decision actually made. It is delegated to a timer set decades ago.

## How this is solved today

Eight approaches are in common use. None is stupid; all of them are blind in the same way.

| Approach | What it is | Where it falls short |
|---|---|---|
| **Wall timer / fixed schedule** | The pump runs the same hours every day, typically overnight, inherited from mainland off-peak electricity tariffs. | On a diesel-and-solar island there is no off-peak. Those hours are the ones with no sun, so the timer systematically picks the most expensive water of the day. |
| **Float switch / level control** | A level sensor starts the pump below a set point and stops it above another. | Purely reactive. It responds to the tank after it has already drained, never anticipates, and is equally happy to run at midnight as at noon. |
| **Operator judgement with SCADA** | A skilled operator watches gauges and decides by experience when to run. | Works, and often works well — but it does not scale, does not survive staff turnover, and no human runs a 12-hour lookahead over a weather forecast every hour. |
| **Commercial microgrid controllers** | Hybrid energy-management systems that dispatch generators, batteries and PV. | They optimise the electrical side, treating the desalination plant as a fixed load to be served. The water tank's value as storage is invisible to them. They also assume connectivity and a budget neither of which a village of 1,200 has. |
| **Rainwater, managed separately** | Household and community tanks collect rain independently of the plant. | The plant makes water on days the sky is about to fill the tank for free, and the rain overflows while diesel burns. |
| **Threshold alarms for leaks** | Alert when pressure or level crosses a fixed bound. | A threshold cannot distinguish a burst pipe from a busy evening. By the time the level is visibly wrong, the water is gone. Large utilities use district-metered minimum-night-flow analysis; that infrastructure does not exist on a small island. |
| **Calendar or run-to-failure maintenance** | Membranes cleaned on a schedule, or when performance becomes obviously bad. | Too early wastes a clean; too late means months of quietly elevated energy per cubic metre, paid for in diesel. |
| **Fuel tracked by dipstick** | Litres remaining checked manually against a barge schedule on a whiteboard. | Nobody projects the current burn rate forward against the delivery date until it is close, and the barge does not come early because you ran out. |

### What every one of them is missing

Each of these is reasonable on its own. The failure is that **none of them share a demand forecast**, so none can defer a decision. The timer cannot know that tomorrow is sunny; the float switch cannot know that rain is coming in four hours; the leak alarm cannot know what the tank *should* be doing at 03:00 on a Tuesday; the maintenance calendar cannot see that specific energy has been climbing for six weeks.

Predict demand once, and every one of those problems becomes tractable with arithmetic. That is the whole thesis of AquaGrid: **one forecast, shared by the scheduler and every detector.**


## What it does

| | | |
|---|---|---|
| **Predict** | A `RandomForestRegressor` forecasts water demand 48 hours ahead from hour, day of week, weekend, temperature and tourist season. | `ml/train_model.py` |
| **Decide** | An eight-rule scheduler with a 12-hour lookahead dispatches the pump across solar, battery, rainfall and diesel. | `app/src/logic/scheduler.js` |
| **Explain** | Every decision carries a plain-language reason; an LLM writes the operator briefing, answers questions, and drafts the public notice. | `app/src/lib/ai.js` |
| **Detect** | Residual analysis flags a burst pipe in hours, dirty panels in a day, and fouling membranes six weeks out. | `leak.js`, `assets.js` |

Point it at **any island on Earth** — see [Any location](#any-location).

## Features — what each one does

Fourteen features across five roles: **predict** the demand, **decide** the schedule, manage **supply**, **detect** failures, and **explain** it all to a human.

### 1. Demand forecasting

*Predict*

**What it does.** Predicts how many litres the island will use, every hour, 48 hours ahead.

**How it works.** A RandomForestRegressor trained on two years of hourly history using five features: hour of day, day of week, weekend flag, temperature and tourist season. Evaluated on a chronological split so it is tested on the future.

**Why it matters.** Everything else depends on this. Without a demand curve you cannot know whether the tank will hold, so you cannot decide anything except reactively.

**Code:** `ml/train_model.py, logic/demand.js` · **Result:** MAE 45.3 L/h · R² 0.987 · 89% better than predicting the average

### 2. Pump scheduling

*Decide*

**What it does.** Decides each hour whether to run the desalination pump, and on what power.

**How it works.** Eight rules in strict priority order with a 12-hour lookahead that projects tank level against forecast demand, full-solar hours and expected rainfall. First matching rule wins.

**Why it matters.** This is the product. A wall timer runs the pump when power is most expensive; this runs it when power is free, and spends a little diesel early to avoid spending a lot later.

**Code:** `logic/scheduler.js` · **Result:** 78% less diesel than a fixed timer, zero shortage hours

### 3. Rainwater harvesting

*Supply*

**What it does.** Captures rainfall into the tank and holds the pump when a shower is coming.

**How it works.** Precipitation comes from the same Open-Meteo call as solar. harvest = rain_mm × catchment_m² × runoff. Rule 2 suppresses pumping when forecast rain exceeds forecast demand over the next six hours.

**Why it matters.** Funafuti is in reality almost entirely rainwater-fed, with desalination as the backup. A scheduler that ignores rain is optimising the wrong variable, and makes water it is about to spill.

**Code:** `logic/scheduler.js — harvestFrom(), Rule 2` · **Result:** 11.3 m³ harvested — 24% of all water supplied

### 4. Battery storage

*Supply*

**What it does.** Stores surplus midday solar and spends it running the pump after dark.

**How it works.** Solar serves the pump first; surplus charges the battery at round-trip efficiency. When pumping without enough sun, the battery discharges before any diesel is burned. Energy that arrives with the battery full is counted as curtailed.

**Why it matters.** The demand peak is 18:00–20:00 and the solar peak is midday. Without storage those never meet and the evening runs on diesel.

**Code:** `logic/scheduler.js — settleHour(), Rule 4` · **Result:** 66 kWh discharged to the pump · 304 kWh curtailed

### 5. Storm preparation

*Decide*

**What it does.** Abandons fuel economy and fills the tank to 100% before a cyclone lands.

**How it works.** Scans the 24-hour wind outlook. Above the storm threshold, Rule 0 overrides every cost rule until the tank is full.

**Why it matters.** After landfall the array is down, the pump may be offline and the resupply barge will not sail. Whatever is in the tank is what the island has. Optimising for fuel at that moment is the wrong objective.

**Code:** `logic/scheduler.js — Rule 0, components/StormBanner.js` · **Result:** Simulate cyclone control, since the live forecast has none

### 6. Leak detection

*Detect*

**What it does.** Finds a burst pipe from the pattern of the loss, hours before the tank looks low.

**How it works.** Each hour, compare the drop the sensor reports against the drop the forecast predicts (demand − pumped − harvested). σ is calibrated on the first twelve hours as a known-good baseline. Alert on 3σ for three consecutive hours.

**Why it matters.** A level threshold cannot tell a leak from a busy evening — by the time the tank is visibly low, thousands of litres are gone. A forecast knows what normal looks like at 03:00 on a Tuesday.

**Code:** `logic/leak.js` · **Result:** 450 L/h burst caught in 2 hours · estimated 452 L/h at 99% confidence

### 7. Panel soiling detection

*Detect*

**What it does.** Notices the solar array is producing less than the sunlight falling on it warrants.

**How it works.** Compares metered array output against the irradiance-derived prediction across daylight hours only, and reports the shortfall and the kWh not collected.

**Why it matters.** Salt spray and dust cost an island real diesel silently, for months. Nobody climbs up to check panels that are still producing something.

**Code:** `logic/assets.js — detectSoiling()` · **Result:** 13% below predicted across 20 daylight hours — 90 kWh lost

### 8. Membrane fouling prediction

*Detect*

**What it does.** Predicts the date the reverse-osmosis membranes will need cleaning.

**How it works.** Specific energy — kWh per m³ of fresh water — rises as membranes foul, because the pump must push harder for the same flow. Least-squares fit on 90 days of daily readings, projected forward to the clean-in-place threshold.

**Why it matters.** Maintenance on an island is scheduled around a barge, not around a fault. Six weeks of warning is the difference between a planned clean and an emergency one.

**Code:** `logic/assets.js — projectFouling()` · **Result:** +11.1% from design · threshold reached in 40 days

### 9. Diesel inventory

*Detect*

**What it does.** Warns when the fuel will run out before the next resupply barge.

**How it works.** Projects the schedule's burn rate against litres remaining and days until the barge, and runs the same projection for both baseline strategies.

**Why it matters.** Burning too much diesel and running out of diesel are different failures. The barge does not come early because you ran out.

**Code:** `logic/fuel.js` · **Result:** AquaGrid 39 days; fixed timer dry 3.4 days early, reactive 4.4 days early

### 10. Demand-side advisory

*Explain*

**What it does.** Tells residents the hours when using water costs the island nothing.

**How it works.** Finds runs of consecutive hours where the pump is already running on sun or stored sun, and turns them into a public notice — drafted by the LLM, or by a deterministic template offline.

**Why it matters.** Everything else schedules supply. The cheapest litre of diesel is the one nobody needed because the laundry ran at noon.

**Code:** `logic/advisory.js — freeSolarWindows()` · **Result:** Free windows surfaced as tappable chips with litres available

### 11. Rationing outlook

*Explain*

**What it does.** Measures supply per person per day against the WHO minimum, and drafts the notice if it falls short.

**How it works.** Divides available supply over the horizon by population and days, and compares it to 15 L per person per day — the WHO floor for drinking, cooking and basic hygiene.

**Why it matters.** When shortfall is unavoidable, the question stops being about fuel and becomes about whether people have enough to drink. That deserves a number, not a vibe.

**Code:** `logic/advisory.js — rationingOutlook()` · **Result:** 18.2 L per person per day — 1.2× the WHO minimum

### 12. Any-island operation

*Predict*

**What it does.** Points the whole system at any location on Earth, with no retraining.

**How it works.** The trained forest is evaluated exhaustively over its entire input grid and exported as a 15,120-cell lookup table. Open-Meteo geocoding resolves a typed name; the forecast endpoint supplies that island's real weather; the plant is scaled to its population.

**Why it matters.** A demo tied to one island is a demo. This is the difference between a case study and a system.

**Code:** `logic/demand.js, logic/plant.js, lib/geo.js` · **Result:** Table reproduces the model to a mean 5.5 L/h — 12% of its own error

### 13. Operator briefing and Q&A

*Explain*

**What it does.** Writes the shift briefing in plain language and answers questions about the decisions.

**How it works.** A compact state object — never the whole forecast — goes to an open-weight model on Groq, raced against a six-second timeout. Three preset questions let a judge interrogate the scheduler in one tap.

**Why it matters.** A decision nobody can interrogate is not one an operator will trust. Every hour already carries a machine-written reason; this turns the set of them into something a person reads.

**Code:** `lib/ai.js, components/BriefingCard.js, AskPanel.js` · **Result:** ~620 ms round trip · falls back to a deterministic template

### 14. Offline operation

*Platform*

**What it does.** Runs completely with no network — scheduling, detection, charts and briefing.

**How it works.** The model's predictions and the weather forecast are bundled as a static asset at build time. The only two network calls, Groq and Open-Meteo geocoding, are optional enhancements that degrade to a deterministic path.

**Why it matters.** This is the actual operating condition on an isolated island. It is also why there is no backend to fail.

**Code:** `assets/forecast.json, lib/ai.js fallback` · **Result:** Airplane mode: every screen renders, only the briefing degrades

## System architecture

**The laptop trains; the phone does everything else.**

Python runs **once**, to generate the history, train the forest and export it. After that the laptop is not in the loop: it is not needed at runtime, not needed to change island, and not needed for fresh weather. The phone fetches its own forecast, runs the model, schedules the pump, detects the failures and draws the charts.

What ships in `forecast.json` is therefore two different things: the **model** — a 15,120-cell lookup table that works anywhere — and a **seed forecast** for the bundled island, so the app has something to show before it ever reaches the network.

Four layers. Everything above the dotted line runs once, at build time; everything below runs on the phone, every time you open the app.

```
                    ┌──────────────────────────────────────────────┐
  LAYER 1           │  generate_data.py   2 yr synthetic history   │
  TRAINING          │           ↓                                  │
  Python, offline   │  train_model.py     RandomForest + eval      │
  run once          │           ↓         chronological split      │
                    │  Open-Meteo         solar/temp/rain/wind     │
                    └──────────────────────┬───────────────────────┘
                                           │ writes
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
                                           ▼
  LAYER 2           ┌──────────────────────────────────────────────┐
  DATA CONTRACT     │  forecast.json   plant · model · demand_model│
  one static file   │                  warmup · hourly · maintenance│
                    └──────────────────────┬───────────────────────┘
                                           │ bundled as an asset
                                           ▼
  LAYER 3           ┌──────────────────────────────────────────────┐
  DECISION          │  demand.js    the model, on-device           │
  pure JS,          │  scheduler.js 8 rules + shared physics       │
  no React,         │  baselines.js what we compare against        │
  node-testable     │  leak · assets · fuel · advisory  detectors  │
                    └──────────────────────┬───────────────────────┘
                                           │ plain objects
                                           ▼
  LAYER 4           ┌──────────────────────────────────────────────┐
  PRESENTATION      │  18 React Native components · SVG charts     │
  React Native      │  ai.js → Groq (optional) → template fallback │
                    │  geo.js → Open-Meteo (optional, any island)  │
                    └──────────────────────────────────────────────┘
```

**Why the layers are cut here.** Layer 3 has no React imports at all, which is what makes `node src/logic/test.js` possible without a simulator or a phone. Layer 2 is a single file, so the Python and JavaScript halves can be developed and debugged independently. Layers 3 and 4 need no network — the two calls that do (Groq, Open-Meteo geocoding) are strictly optional enhancements that degrade to a deterministic path.

### Runtime data flow, one hour at a time

```
forecast.hourly[i] ──┬─► scheduler   ─► action, source, reason, tank, battery, diesel
                     │        │
     plant sizing ───┘        ├─► leak.js      residual vs simulated float sensor
                              ├─► assets.js    metered array + 90-day RO trend
                              ├─► fuel.js      burn rate vs barge lead time
                              └─► advisory.js  free-solar windows, L/person/day
                                       │
                                       └─► ai.js ─► briefing + public notice
```

### Why there is no backend

The model is trained and evaluated in Python; its predictions are exported to a single JSON file the app bundles as a static asset. All scheduling, harvesting, battery dispatch, detection and charting run in JavaScript on-device.

This is deliberate. A laptop-hosted API reached from a phone means LAN addresses, tunnels, CORS and cold starts — the four most common ways a demo dies. Removing the server removes all four.

More importantly it is the *correct* design for the problem. **The app works with zero connectivity** — precisely the situation on an isolated island, and the only honest design for an operator whose uplink is a satellite dish. "Trained offline, inference on-device" is also how most production mobile ML actually ships.

## APIs and data sources

Three network APIs and two device APIs. **Two of the three network APIs need no key or account at all**, and the third is optional.

### Open-Meteo Forecast
*NETWORK · None — no API key, no account*

```
https://api.open-meteo.com/v1/forecast
```
**Parameters** `latitude, longitude, hourly=shortwave_radiation,temperature_2m,cloud_cover,precipitation,wind_speed_10m, past_days=1, forecast_days=3, timezone=auto`

**Returns.** Hourly arrays of shortwave radiation (W/m²), temperature (°C), cloud cover (%), precipitation (mm) and wind speed (km/h).

**Feeds.** Solar output (radiation × panel area × efficiency), the demand model's temperature feature, rainwater harvest, and the cyclone check.

**Note.** timezone=auto is load-bearing. Funafuti is UTC+12, so UTC timestamps would put peak solar at local midnight and invert every pump decision. past_days=1 supplies the warm-up window used to derive the starting tank level.

*Code:* `ml/train_model.py at build time; app/src/lib/geo.js at runtime`

### Open-Meteo Geocoding
*NETWORK · None — no API key, no account*

```
https://geocoding-api.open-meteo.com/v1/search
```
**Parameters** `name, count=8, language=en, format=json`

**Returns.** Candidate places with name, country, admin region, latitude, longitude, population and timezone.

**Feeds.** Turns a typed island name into coordinates for the forecast call, and a population for plant sizing.

**Note.** Matches settlement names only, so "Malé Maldives" returns nothing on a literal query. We retry on the first token and prefer results whose country or region matches the rest. Population is missing for many small settlements; 3,000 is assumed and labelled as an estimate.

*Code:* `app/src/lib/geo.js — searchPlaces()`

### Groq Chat Completions
*NETWORK · OPTIONAL · Bearer token, free tier, no credit card*

```
https://api.groq.com/openai/v1/chat/completions
```
**Parameters** `model=openai/gpt-oss-120b (fallback groq/compound-mini), reasoning_effort=low, max_tokens=400, temperature=0.3`

**Returns.** The operator briefing, answers to the preset questions, and the public water notice.

**Feeds.** Narration only. It decides nothing — remove it and every number in the app is unchanged.

**Note.** OpenAI-compatible shape. gpt-oss is a reasoning model: without reasoning_effort=low it spends the whole token budget thinking and returns empty content. Raced against a 6-second timeout; any failure falls back to a deterministic on-device template. Measured round trip ~500-620 ms.

*Code:* `app/src/lib/ai.js`

### expo-location
*DEVICE · Foreground permission prompt*

```
requestForegroundPermissionsAsync · getCurrentPositionAsync · reverseGeocodeAsync
```
**Parameters** `accuracy=Balanced, 12-second timeout`

**Returns.** Device latitude and longitude, and a nearby place name.

**Feeds.** The 'Use my current location' button. The name is resolved back through geocoding so the plant is sized against a real population rather than bare coordinates.

**Note.** A refused permission is a normal outcome, not an error — the picker says so and search by name still works.

*Code:* `app/src/lib/geo.js — currentPlace()`

### AsyncStorage
*DEVICE · None*

```
@react-native-async-storage/async-storage
```
**Parameters** `Up to 8 cached locations, newest first`

**Returns.** Previously fetched forecasts and the last island viewed.

**Feeds.** Restores the operator's island on launch and keeps every island already visited working with no signal.

**Note.** A full or unavailable store never breaks the app — the bundled island always works and everything recomputes from it.

*Code:* `app/src/lib/store.js`

Nothing else talks to the network. No weather key, no maps SDK, no analytics, no crash reporter, no backend of our own.

## The two AI systems

These are different things and judges routinely conflate them. Only the first one makes decisions.

| | **Demand forecaster** | **Narrator** |
|---|---|---|
| Model | `RandomForestRegressor` | `openai/gpt-oss-120b` |
| Type | Supervised regression, 180 trees, depth 14 | Open-weight LLM, ~120B params |
| Trained by us? | **Yes** — 16,080 hours, chronological split | No, used as-is |
| Runs where | Python offline, then as a lookup table on-device | Groq API, optional |
| What it decides | **Everything.** Every pump hour, every alert | **Nothing.** It only phrases what the scheduler already decided |
| If it fails | The app cannot function | Template fallback, app unaffected |
| Verified by | MAE 45.3 L/h, R² 0.987, 89% over naive | n/a |

The scheduler, the detectors and the savings are pure arithmetic over the forecaster's output. **Remove the LLM entirely and every number in this README is unchanged.** That is deliberate: the intelligence is in the model and the rules, not in the prose.

## Technology stack

| Layer | Technology | Version | Why this one |
|---|---|---|---|
| ML | scikit-learn | 1.9.0 | RandomForest is interpretable, gives feature importances, and needs no GPU |
| | pandas / numpy | 3.0.5 / 2.5.2 | Feature frames and the synthetic history |
| | Python | 3.14.4 | |
| App | Expo (SDK) | 57.0.18 | Expo Go runs on a physical phone with no native build or signing |
| | React Native | 0.86.3 | |
| | React | 19.2.3 | |
| | react-native-svg | 15.15.4 | **The only native module.** Charts are hand-drawn; no charting library |
| | Node | 25.6.1 | Also runs the logic tests directly, thanks to ESM auto-detection |
| Weather | Open-Meteo Forecast | — | Solar radiation, temperature, precipitation, wind. **No API key** |
| Geocoding | Open-Meteo Geocoding | — | Place name → lat/lon/population. **No API key** |
| LLM | Groq | — | Serves open-weight models free, no credit card, ~620 ms round trip |
| Hosting | GitHub Pages | — | The project site. The app itself has no host |
| State | React `useState` / `useMemo` | — | No Redux, no context, no state library. It is one screen |

**Deliberately absent:** no backend, no database, no auth, no navigation library, no charting library, no state-management library, no CSS framework, no `eas build`. Every one of those is a dependency that can break at hour four of a hackathon, and none of them earn their place here.

## Component inventory

| Module | Lines | Responsibility |
|---|---|---|
| **`ml/train_model.py`** | 389 | Train, evaluate, fetch weather, export the lookup table and `forecast.json` |
| **`ml/generate_data.py`** | 80 | Two years of synthetic history with auditable structure |
| `logic/scheduler.js` | 268 | Eight rules, shared physics, warm-up replay |
| `logic/assets.js` | 117 | Panel soiling, RO membrane fouling |
| `logic/advisory.js` | 98 | Free-solar windows, WHO-minimum rationing |
| `logic/leak.js` | 95 | Burst-pipe residual detection, simulated float sensor |
| `logic/baselines.js` | 61 | Fixed-timer and reactive strategies |
| `logic/fuel.js` | 45 | Diesel inventory against barge lead time |
| `logic/plant.js` | 39 | Population scaling for arbitrary islands |
| `logic/demand.js` | 32 | The exported model, running on-device |
| `lib/ai.js` | 189 | Groq briefing, Q&A, public notice — each with a fallback |
| `lib/geo.js` | 155 | Location search and live weather |
| `App.js` | 239 | Composition, demo switches, the two async effects |
| `components/` × 18 | 1,421 | UI, SVG charts, all presentational |

Roughly **2,800 lines of JavaScript and 470 of Python.** The decision layer — everything the project actually claims — is 755 lines and has no dependencies beyond the language.

## Model performance

Trained on two years of hourly history with a **chronological split** — the final 60 days are held out, so the model is tested on the future, never on shuffled rows.

| Metric | Value |
|---|---|
| MAE | **45.3 L/h** |
| RMSE | 57.0 L/h |
| R² | **0.987** |
| Naive "predict the mean" MAE | 409.7 L/h |
| **Improvement over naive** | **89%** |
| Train / test rows | 16,080 / 1,440 |

Feature importances: `hour` 0.897, `is_tourist_season` 0.032, `is_weekend` 0.031, `day_of_week` 0.028, `temp_c` 0.012.

The synthetic history in `ml/generate_data.py` is readable in one screen — twin daily peaks, weekends +30%, tourist season +22%, ~3.5% more demand per °C, plus Gaussian noise. The patterns are real and deliberately auditable, so the model has something genuine to learn rather than noise to memorise.

## Results

**Worked example: Funafuti, Tuvalu.** 48-hour horizon, live Open-Meteo forecast. All three strategies run over the **identical forecast with identical physics** — same rain, same battery, same tank. Only the decision rule differs. Computed at runtime, not hardcoded.

| Strategy | Diesel | Cost | CO₂ | Pump hours | Shortage |
|---|---|---|---|---|---|
| **AquaGrid** | **15.3 L** | **$25** | **41 kg** | 6 h (3 solar / 1 battery / 1 partial / 1 diesel) | 0 h |
| Fixed timer 01:00–05:00 | 70.0 L | $112 | 188 kg | 8 h (all diesel) | 0 h |
| Reactive, top up below 80% | 79.2 L | $127 | 212 kg | 11 h | 0 h |

**78% less diesel than the fixed timer these plants run today.** The tank starts at 32% — the level yesterday's weather actually left it at — and never drops below 27% against a 25% reserve floor.

These are Funafuti's numbers on this forecast, not fixed properties of the system — the same code returns 80% on Apia and 23% on Reykjavík, because those islands get different amounts of sun.

### The number that matters more than the percentage

The fuel tank holds 300 L with **12 days until the next barge**.

| Strategy | Burn rate | Fuel lasts | Verdict |
|---|---|---|---|
| **AquaGrid** | 8 L/day | **39 days** | fine |
| Fixed timer | 35 L/day | 8.6 days | **runs dry 3.4 days early — 121 L short** |
| Reactive | 40 L/day | 7.6 days | **runs dry 4.4 days early — 176 L short** |

Burning too much diesel and running out of diesel are different failures. The barge does not come early because you ran out.

Assumptions stated openly: diesel at **$1.60/L** island-delivered, **2.68 kg CO₂/L** burned.

## The scheduler

Eight rules, evaluated in strict priority order, with a 12-hour lookahead that asks: *given the sun and rain I expect, do I breach the reserve floor before the next window?*

| # | Rule | Fires when |
|---|---|---|
| 0 | **Storm preparation** | Cyclone-force wind within 24 h → fill to 100% regardless of cost |
| 1 | **Emergency** | Below the 25% reserve floor |
| 2 | **Rain hold** | More rain than demand forecast in the next 6 h → hold, the tank fills free |
| 3 | **Free solar** | Solar clears the full 50 kW pump draw |
| 4 | **Stored solar** | Shortfall ahead and the battery can cover the pump |
| 5 | **Pre-emptive hybrid** | Shortfall ahead, partial sun — spend a little diesel now to avoid a lot tonight |
| 6 | **Reluctant diesel** | Shortfall ahead, no sun, empty battery |
| 7 | **Hold** | Wait for the sun |

**The starting tank level is a result, not a constant.** Open-Meteo is asked for `past_days=1` and the scheduler replays those 24 hours before the displayed horizon begins, so hour zero is the consequence of yesterday's actual weather at that location. Seeding every island at the same percentage would make the largest number on screen a decoration.

Rules 2, 4 and 5 are where the forecast earns its keep — they are the only ones that act on information the plant does not yet have.

## Rainwater, battery and storms

**Rain.** Funafuti is in reality almost entirely rainwater-fed. Precipitation comes from the same Open-Meteo call, and `harvest = rain_mm × catchment_m² × runoff` flows into the tank balance. Over this horizon 15.7 mm across 900 m² of public roof delivered **11.3 m³ — 24% of all water supplied.** Catchment is sized so rain matters without dominating; raise it and the reserve floor stops binding.

**Battery.** 150 kWh lets surplus midday solar run the pump into the 18:00–20:00 demand peak instead of being curtailed. Over the horizon: 180 kWh of solar went straight to the pump, 66 kWh came back out of the battery, and **304 kWh was curtailed** — sun that arrived with the battery full and the pump already running. That last figure is the honest ceiling on what a bigger battery could buy.

**Storms.** Sustained winds above 90 km/h flip the objective from *spend the least fuel* to *have the most water when the power goes out*. After landfall the array is down and the barge will not sail. Funafuti has no cyclone in the live forecast, so the app ships a **Simulate cyclone** control rather than leaving the rule as code that never runs.

## Detection — one idea, four failures

All four use the same move: compare what the plant *does* against what the forecast says it *should*. A threshold alarm sees none of them until they are expensive.

| Failure | Signal | Result |
|---|---|---|
| **Burst pipe** | Tank falling faster than demand-minus-supply explains | 450 L/h leak injected at hour 14, **caught at hour 16** — estimated 452 L/h, 99% confidence |
| **Dirty panels** | Metered array output vs irradiance | **13% below predicted across 20 daylight hours — 90 kWh not collected** |
| **Fouling membranes** | RO specific energy trending up over 90 days | **+11.1% from design; clean-in-place threshold in 40 days** |
| **Fuel exhaustion** | Burn rate vs barge lead time | AquaGrid fine; both baselines dry before resupply |

Leak detection calibrates σ on the first 12 hours as a known-good baseline and alerts on **3σ for three consecutive hours**. The residual accounts for harvested rain — omit it and every shower reads as a negative leak.

## Talking to the village, not just the plant

The cheapest litre of diesel is the one nobody needed. `advisory.js` finds the hours when the pump is already running on sun or stored sun and turns them into a public notice:

> Run laundry and irrigation between 12:00 and 15:00 — that is the free-solar window, when the pump is already running on 150 kWh of sun. Water used outside those hours comes out of the tank, and the tank is refilled on diesel.

It also computes supply per person per day against the **WHO minimum of 15 L**. Currently 18.2 L — 1.2× the floor, so no rationing notice is warranted. When it falls below, the LLM drafts the notice instead.

## Any location

Search any place by name and the app fetches its real solar, temperature, rainfall and wind, predicts its demand, sizes a plant for its population, and re-runs everything.

That works because **we ship the model, not only its predictions.** Every feature the forecaster uses is categorical except temperature, so `train_model.py` evaluates the trained forest exhaustively over its entire input grid and exports a **15,120-cell lookup table** (2 seasons × 7 days × 24 hours × 45 temperature buckets).

This is the model, not an approximation. The only loss is temperature discretised to 0.5 °C, costing a **mean 5.5 L/h** — 12% of the model's own 45.3 L/h error. `node src/logic/test.js` asserts that gap stays below a quarter of the model MAE.

A real forecaster running on the phone with no ML runtime, no server, and no inference API.

| | |
|---|---|
| Location search | Open-Meteo geocoding — free, no key |
| Weather | Open-Meteo forecast with `timezone=auto`, `past_days=1` |
| Demand | Lookup table, scaled linearly by population |
| Plant sizing | Tank, pump, output, panels, catchment, battery and fuel all scale with population |
| Offline | Falls back to the island bundled at build time |

Every figure moves with the choice. On live forecasts the same code returned **80% saved on Apia**, **70% on Malé**, **64% on Santorini** and **23% on Reykjavík** — where there is barely any sun to schedule against, so there is far less for a scheduler to win.

Search is forgiving of how people type place names: the geocoder matches settlement names alone, so `"Malé Maldives"` returns nothing on a literal query. The app retries on the first token and prefers results whose country or region matches the rest.

## Setup

### 1. Train the model and export the forecast

```bash
cd ml
python -m venv ../.venv && ../.venv/bin/pip install -r requirements.txt
../.venv/bin/python generate_data.py     # writes water_history.csv (17,520 rows)
../.venv/bin/python train_model.py       # trains, evaluates, writes ../app/assets/forecast.json
```

Falls back to a modelled clear-sky curve if the network is unavailable, labelling which it used in `weather_source`. The build never blocks on the network.

### 2. Run the app

```bash
cd app
npm install
cp src/config.example.js src/config.js   # optional: paste a Groq key for the LLM
npx expo start                            # add --ios for the simulator
```

Install **Expo Go** on a physical phone and scan the QR code. If the phone connects but never loads, the wifi is blocking device-to-laptop traffic — use `npx expo start --tunnel`. After changing the scheduler's shape, restart with `--clear`.

### 3. Verify the logic without a phone

```bash
cd app && node src/logic/test.js
```

Prints all three strategies, the savings, the leak result and the lookup-table fidelity. Exits non-zero if any check fails.

## The LLM layer

Two paths, and the app labels which one produced the text:

- **On-device template** — deterministic, instant, works in airplane mode. Primary path, always available.
- **Groq (`openai/gpt-oss-120b`, open-weight)** — raced against a 6-second timeout, upgrades in place. Any error, timeout or missing key falls silently back.

Groq serves **open-weight** models free with no credit card — no proprietary model is in the loop. `gpt-oss-120b` is a reasoning model, so the call caps `reasoning_effort` at `low`; without that it spends the whole token budget thinking and returns empty content. Measured round trip: **~620 ms**. `groq/compound-mini` is tried before falling back to the template.

**The key lives client-side.** There is no backend to hide it behind — the deliberate trade for an app that works offline. `src/config.js` is gitignored and no key is committed. Beyond a demo this belongs behind a proxy.

## Why we built this

Tuvalu is one of the most climate-vulnerable countries on Earth. Nine low-lying atolls, a highest point of around four metres, and a freshwater lens so thin and so easily contaminated by saltwater intrusion that groundwater is largely undrinkable. The island runs on rain. When the rain stops, it runs on desalination, and desalination runs on diesel that arrives by barge.

This is not hypothetical. In 2011 a prolonged drought left Funafuti with days of fresh water remaining. A state of emergency was declared and neighbouring countries flew in portable desalination units and shipped in water. The vulnerability was never really about the plant being too small. It was that nobody could see far enough ahead to act early.

What struck us, reading about how these plants are actually operated, is that the hard parts are already solved. The panels are on the roof. The tank is in the ground. The desalination unit works. The weather forecast is free and public. What is missing is the thin layer in between — the part that looks at tomorrow and decides what to do tonight. That layer is software, and software is the cheapest thing you can add to an island.

So AquaGrid is deliberately not a hardware proposal. It does not ask anyone to buy anything. It takes the equipment an island already has and schedules it against a forecast, which is the difference between making water when it is free and making water when it is expensive. On our test case that is 78% less diesel — and, more importantly, the difference between fuel lasting until the next barge and not.

We also made a decision early that shaped everything else: it had to work with no signal. An app that needs a server to decide whether to run a pump is an app that fails exactly when an island is cut off, which is exactly when it matters. So the model is trained offline and runs on the phone. You can put the device in airplane mode in the middle of the demo and nothing stops working. That is not a limitation we worked around. It is the requirement.

Every number in this project is computed, not asserted. The savings come from running three schedulers over the same forecast and the same physics. The model is tested on the 60 days that came after the ones it learned from. The leak detector is given a real injected fault and has to find it. We would rather show a smaller honest number than a larger one we cannot defend — which is why Reykjavík, where there is barely any sun to schedule against, is in the results table at 23% alongside Apia at 80%.

None of this makes anyone's water secure on its own. It is a scheduler, built in a hackathon, on synthetic demand data and simulated sensors, and we have said so plainly wherever it applies. But the underlying idea — that a forecast shared between the pump, the tank and the fuel log turns four separate blind spots into one solved problem — is real, and it does not need any new hardware to be true.

### The team

**BitHeads**

| | Presenting | |
|---|---|---|
| **Rishik** | The problem | Why an island's water and energy are the same problem, and how these plants are run today. |
| **Neekin** | The solution | One forecast, shared by the scheduler and every detector. What that buys. |
| **Srihan** | The architecture | Four layers, no backend, and shipping the model rather than its predictions. |
| **Ednit** | The features | The eight rules, rainwater, the battery, and the four detectors. |
| **Gowtham** | The code and the site | Repository walkthrough, the live test run, the website and the handbook. |

BitHeads · DreamHacks 2026, Track 2 — AI, Automation & Logic.


## Limitations

Stated plainly, because a system you cannot audit is not one you should trust with an island's water.

- **Demand history is synthetic.** Generated by `ml/generate_data.py` from published domestic-usage profiles, not measured at a real plant. The model genuinely learns those patterns; the patterns are our construction.
- **All sensors are simulated** — tank float, array power meter, and the RO specific-energy log. No hardware is connected.
- **Demand patterns are assumed universal.** New locations scale the reference village's profile by population. A real deployment would retrain on that island's meter data.
- **Plant sizing scales linearly with population**, which keeps specific energy, days of storage and solar-hours-vs-pump-draw constant. That is why savings vary by weather rather than by size.
- **Population comes from the geocoder** and is missing for many small settlements; 3,000 is assumed and labelled as an estimate.
- **Single plant, single tank.** No distribution network, pressure zones or multi-tank routing.
- **Diesel price assumed at $1.60/L.** Real island prices vary widely with barge schedules.
- **48-hour horizon.** The lookahead cannot see past the end of the weather forecast.

## Repository

```
ml/                        RandomForest pipeline — history, training, forecast + lookup-table export
app/src/logic/scheduler.js eight-rule dispatch across solar, battery, rain and diesel
app/src/logic/baselines.js fixed-timer and reactive strategies, identical physics
app/src/logic/leak.js      burst-pipe detection by residual analysis
app/src/logic/assets.js    panel soiling and RO membrane fouling
app/src/logic/fuel.js      diesel inventory against barge lead time
app/src/logic/advisory.js  free-solar windows and WHO-minimum rationing
app/src/logic/demand.js    the exported model, running on-device
app/src/lib/geo.js         location search + live weather for any island
app/src/lib/ai.js          Groq briefing and public notice, with on-device fallback
docs/index.html            project website
```

All of `app/src/logic/` is free of React imports and testable with plain `node`.
