# AquaGrid

**An AI that forecasts an island's water demand, schedules desalination against the solar forecast, and catches leaks before anyone notices.**

DreamHacks 2026 · Track 2 — AI, Automation & Logic

---

## The problem

On a small isolated island, the desalination plant is the single largest electrical load, and it is almost always run on a wall timer set to overnight hours — a habit inherited from mainland off-peak grid pricing. On a solar island that is exactly backwards: 01:00–05:00 has no sun, so every one of those litres is made on diesel that arrived by barge.

The water tank is a battery nobody schedules. AquaGrid schedules it.

## What it does

Four things make this an AI system rather than a dashboard:

| | | |
|---|---|---|
| **Predict** | A `RandomForestRegressor` forecasts water demand 48 hours ahead from hour, day of week, weekend, temperature and tourist season. | `ml/train_model.py` |
| **Decide** | A five-rule scheduler with a 12-hour lookahead picks pump hours to minimise diesel while never breaching the reserve floor. | `app/src/logic/scheduler.js` |
| **Explain** | Every decision carries a plain-language reason, and an LLM writes the shift briefing and answers the operator's questions. | `app/src/lib/ai.js` |
| **Detect** | Residual analysis against the forecast flags leaks from the pattern of the loss, not from a level threshold. | `app/src/logic/leak.js` |

Point it at **any island on Earth** — see [Any location](#any-location) below.

## Architecture — and why there is no backend

```
┌─────────────────────┐         ┌──────────────────────────────┐
│  Python (laptop)    │         │  Expo app (phone)            │
│                     │         │                              │
│  synthetic history  │         │  forecast.json (bundled)     │
│         ↓           │         │         ↓                    │
│  RandomForest ──────┼────────▶│  scheduler.js  (decisions)   │
│         ↓           │ writes  │  leak.js       (anomalies)   │
│  Open-Meteo solar   │ JSON    │  charts        (SVG)         │
│         ↓           │         │         ↓                    │
│  forecast.json      │         │  Groq LLM (optional briefing)│
└─────────────────────┘         └──────────────────────────────┘
```

The model is trained and evaluated in Python; its predictions are exported to a single JSON file that the app bundles as a static asset. All scheduling, leak detection and charting run in JavaScript on-device.

This is deliberate. **The app works with zero connectivity** — which is precisely the situation on an isolated island, and the only honest design for an operator whose uplink is a satellite dish. "Trained offline, inference on-device" is also how most production mobile ML actually ships.

## Any location

The app is not hardcoded to one island. Search any place by name and it will fetch that location's real solar and temperature forecast, predict its water demand, size a plant for its population, and re-run the whole schedule.

That works because **we ship the model, not only its predictions.** Every feature the forecaster uses is categorical — hour, day of week, weekend, tourist season — except temperature, which is a single continuous variable. So `train_model.py` evaluates the trained forest exhaustively over its entire input grid and exports the result as a **15,120-cell lookup table** (2 seasons × 7 days × 24 hours × 45 temperature buckets, ~300 KB).

This is the model, not an approximation of it. The only loss is temperature discretised to 0.5 °C, which costs a **mean 5.5 L/h** — 12% of the model's own 45.3 L/h error, and 0.6% of typical demand. `node src/logic/test.js` asserts that gap stays below a quarter of the model MAE.

The result is a real forecaster running on the phone with no ML runtime, no server, and no inference API.

| | |
|---|---|
| Location search | Open-Meteo geocoding — free, no key |
| Weather | Open-Meteo forecast with `timezone=auto` |
| Demand | Lookup table, scaled linearly by population |
| Plant sizing | Tank, pump, output and panel area all scale with population off the reference plant |
| Offline | Falls back to the island bundled at build time, which needs no network at all |

Plant sizing scales everything together, which keeps the ratios that actually drive decisions constant — specific energy per m³, days of storage, and how many hours a day solar clears the pump draw. So the scheduler faces the same *shape* of decision on a village of 1,200 as on a city of 130,000, and **only the weather genuinely differs between locations.** That is an assumption, and it is why savings vary by island rather than by size.

Malé, Maldives (pop. 103,693) resolves to a 5,184,650 L tank, a 4,320 kW pump and 27,651 m² of panels — an 86× scale-up computed at runtime on the phone.

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

48-hour horizon, live Open-Meteo solar forecast for Funafuti, Tuvalu. All three strategies run over the **identical forecast with identical tank physics** — only the decision rule differs. These numbers are computed in the app at runtime, not hardcoded.

| Strategy | Diesel | Cost | CO₂ | Pump hours | Shortage |
|---|---|---|---|---|---|
| **AquaGrid** | **19.7 L** | **$32** | **53 kg** | 5 h (3 solar / 1 partial / 1 diesel) | 0 h |
| Fixed timer 01:00–05:00 | 112.0 L | $179 | 300 kg | 8 h (all diesel) | 0 h |
| Reactive, top up below 80% | 103.4 L | $165 | 277 kg | 10 h (0 solar / 4 partial / 6 diesel) | 0 h |

**82% less diesel than the fixed timer these plants run today**, with the tank never dropping below 26.7% against a 25% reserve floor.

Assumptions stated openly: diesel at **$1.60/L** island-delivered, **2.68 kg CO₂ per litre** burned.

## The scheduler

Five rules, evaluated in strict priority order, with a 12-hour lookahead that asks: *if I only ever pump on full solar, do I breach the reserve floor before the next sun?*

1. **Emergency** — below the 25% floor, top up regardless of cost.
2. **Free solar** — solar output clears the full 50 kW pump draw, so the water is free.
3. **Pre-emptive hybrid** — a shortfall is forecast within 12 h and there is partial sun. Spend a little diesel *now* to avoid a full-diesel run tonight.
4. **Reluctant diesel** — shortfall forecast, no usable sun, reserves thin.
5. **Hold** — wait for the sun.

Rule 3 is where the forecast earns its keep: it is the only rule that acts on information the plant does not yet have.

## Leak detection

A level threshold cannot tell a leak from a busy evening. A forecast can.

```
expectedDrop = predicted demand − water pumped     (what should happen)
actualDrop   = sensor[t−1] − sensor[t]             (what did happen)
residual     = actualDrop − expectedDrop           (unexplained loss)
```

σ is calibrated on the first 12 hours as a known-good baseline; an alert fires when the residual exceeds **3σ for three consecutive hours**. In testing, a 450 L/h burst injected at hour 14 is caught at hour 16 — with an estimated rate of 452 L/h against a true 450, and 99% confidence — long before the tank itself looks low.

Tap **Simulate burst pipe** in the app to watch it fire.

## Setup

### 1. Train the model and export the forecast

```bash
cd ml
python -m venv ../.venv && ../.venv/bin/pip install -r requirements.txt
../.venv/bin/python generate_data.py     # writes water_history.csv (17,520 rows)
../.venv/bin/python train_model.py       # trains, evaluates, writes ../app/assets/forecast.json
```

`train_model.py` fetches a live 48-hour solar and temperature forecast from Open-Meteo — no API key — and falls back to a modelled clear-sky curve if the network is unavailable, labelling which one it used in `weather_source`. The build never blocks on the network.

### 2. Run the app

```bash
cd app
npm install
cp src/config.example.js src/config.js   # optional: paste a Groq key for the LLM briefing
npx expo start
```

Install **Expo Go** on a physical phone and scan the QR code. If the phone connects but never loads, the wifi is blocking device-to-laptop traffic — use `npx expo start --tunnel`.

### 3. Verify the logic without a phone

```bash
cd app && node src/logic/test.js
```

Prints all three strategies, the savings percentage, and the leak-detection result. Exits non-zero if any definition-of-done check fails.

## The LLM briefing

The operator briefing has two paths, and the app labels which one produced the text:

- **On-device template** — deterministic, instant, works in airplane mode. This is the primary path and it is always available.
- **Groq (`openai/gpt-oss-120b`, open-weight)** — if a key is present, the live call is raced against a 6-second timeout and upgrades the briefing in place. Any error, timeout, or missing key falls silently back to the template.

Groq was chosen because it serves **open-weight** models on a free tier with no credit card — no proprietary model is in the loop. `gpt-oss-120b` is a reasoning model, so the call caps `reasoning_effort` at `low`; without that it spends the entire token budget thinking and returns empty content. Measured round trip: **~620 ms**. A second model (`groq/compound-mini`) is tried before falling back to the template. The **Ask the operator** panel offers three preset questions so the scheduler can be interrogated in one tap.

**The key lives client-side.** There is no backend to hide it behind, which is the deliberate trade for an app that works offline. `src/config.js` is gitignored and no key is committed. For anything beyond a demo this belongs behind a proxy.

## Limitations

Stated plainly, because a system you cannot audit is not one you should trust with an island's water:

- **Demand history is synthetic.** Two years of it, generated by `ml/generate_data.py` with patterns drawn from published domestic-usage profiles rather than measured from a real plant. The model genuinely learns those patterns; the patterns themselves are our construction.
- **The tank sensor is simulated.** `simulateSensor` models a float sensor with Gaussian noise. No hardware is connected.
- **Single plant, single tank.** No distribution network, no pressure zones, no multi-tank routing.
- **Diesel price is assumed** at $1.60/L delivered. Real island prices vary widely with barge schedules.
- **The solar forecast is real but the array is modelled** — 320 m² at 19% efficiency, converted from Open-Meteo shortwave radiation. No inverter losses, soiling, or temperature derating.
- **48-hour horizon.** The lookahead cannot see past the end of the weather forecast.
- **Demand patterns are assumed universal.** Picking a new location scales the reference village's usage profile by population. A real deployment would retrain on that island's own meter data; the morning and evening peaks are not the same everywhere.
- **Population comes from the geocoder** and is missing for many small settlements, in which case 3,000 is assumed and the app labels the figure as an estimate.

## Repository

```
ml/                    RandomForest pipeline — synthetic history, training, forecast export
app/src/logic/         scheduler, baselines, leak detection, on-device demand model (pure JS, node-testable)
app/src/lib/geo.js     location search + live weather for any island
app/src/components/    9 UI components, charts hand-drawn in react-native-svg
app/src/lib/ai.js      Groq briefing with on-device fallback
app/assets/forecast.json   the single interface between Python and the app
```
