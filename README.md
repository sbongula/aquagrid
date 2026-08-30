# AquaGrid

**An AI that forecasts an island's water demand, schedules desalination against the solar forecast, harvests the rain, and catches failures nobody would notice until they were expensive.**

DreamHacks 2026 · Track 2 — AI, Automation & Logic
Repo: [github.com/sbongula/aquagrid](https://github.com/sbongula/aquagrid) · Site: [sbongula.github.io/aquagrid](https://sbongula.github.io/aquagrid)

---

## The problem

On a small isolated island the desalination plant is the single largest electrical load, and it is almost always run on a wall timer set to overnight hours — a habit inherited from mainland off-peak grid pricing. On a solar island that is exactly backwards: 01:00–05:00 has no sun, so every one of those litres is made on diesel that arrived by barge.

The water tank is a battery nobody schedules. AquaGrid schedules it.

And on Funafuti specifically, desalination is not even the primary source — the island runs on rainwater, with desal as backup. Any system that ignores the rain forecast is planning against the wrong problem.

## What it does

| | | |
|---|---|---|
| **Predict** | A `RandomForestRegressor` forecasts water demand 48 hours ahead from hour, day of week, weekend, temperature and tourist season. | `ml/train_model.py` |
| **Decide** | An eight-rule scheduler with a 12-hour lookahead dispatches the pump across solar, battery, rainfall and diesel. | `app/src/logic/scheduler.js` |
| **Explain** | Every decision carries a plain-language reason; an LLM writes the operator briefing, answers questions, and drafts the public notice. | `app/src/lib/ai.js` |
| **Detect** | Residual analysis flags a burst pipe in hours, dirty panels in a day, and fouling membranes six weeks out. | `leak.js`, `assets.js` |

Point it at **any island on Earth** — see [Any location](#any-location).

## Architecture — and why there is no backend

```
┌─────────────────────┐         ┌──────────────────────────────┐
│  Python (laptop)    │         │  Expo app (phone)            │
│                     │         │                              │
│  synthetic history  │         │  forecast.json (bundled)     │
│         ↓           │         │         ↓                    │
│  RandomForest ──────┼────────▶│  scheduler.js  (decisions)   │
│         ↓           │ writes  │  leak.js       (burst pipe)  │
│  Open-Meteo         │ JSON    │  assets.js     (slow decay)  │
│  solar/rain/wind    │         │  fuel.js       (barge risk)  │
│         ↓           │         │  advisory.js   (the village) │
│  forecast.json      │         │  Groq LLM (optional)         │
└─────────────────────┘         └──────────────────────────────┘
```

The model is trained and evaluated in Python; its predictions are exported to a single JSON file the app bundles as a static asset. All scheduling, harvesting, battery dispatch, detection and charting run in JavaScript on-device.

This is deliberate. **The app works with zero connectivity** — precisely the situation on an isolated island, and the only honest design for an operator whose uplink is a satellite dish. "Trained offline, inference on-device" is also how most production mobile ML actually ships.

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

48-hour horizon, live Open-Meteo forecast for Funafuti, Tuvalu. All three strategies run over the **identical forecast with identical physics** — same rain, same battery, same tank. Only the decision rule differs. Computed at runtime, not hardcoded.

| Strategy | Diesel | Cost | CO₂ | Pump hours | Shortage |
|---|---|---|---|---|---|
| **AquaGrid** | **15.3 L** | **$25** | **41 kg** | 6 h (3 solar / 1 battery / 1 partial / 1 diesel) | 0 h |
| Fixed timer 01:00–05:00 | 70.0 L | $112 | 188 kg | 8 h (all diesel) | 0 h |
| Reactive, top up below 80% | 79.2 L | $127 | 212 kg | 11 h | 0 h |

**78% less diesel than the fixed timer these plants run today.** The tank starts at 32% — the level yesterday's weather actually left it at — and never drops below 27% against a 25% reserve floor.

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

**Rain.** Tuvalu is in reality almost entirely rainwater-fed. Precipitation comes from the same Open-Meteo call, and `harvest = rain_mm × catchment_m² × runoff` flows into the tank balance. Over this horizon 15.7 mm across 900 m² of public roof delivered **11.3 m³ — 24% of all water supplied.** Catchment is sized so rain matters without dominating; raise it and the reserve floor stops binding.

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
