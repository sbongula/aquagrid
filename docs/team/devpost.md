# AquaGrid

**Team BitHeads** — Rishik · Neekin · Srihan · Ednit · Gowtham
DreamHacks 2026 · Track 2 — AI, Automation & Logic

---

## Inspiration

We started from a fact that surprised all of us: on a small island, **water and energy are the same problem**.

Fresh water comes from rain when it falls, and from a desalination plant when it doesn't — and that plant is typically the single largest electrical load on the island. Its power is solar by day and a diesel generator by night, and the diesel arrives **by barge every few weeks**, whether or not you're running low.

So every hour there is a genuine decision: make water now, or wait. At noon on a clear day it's nearly free. At 02:00 it costs imported fuel. And because the tank holds a day or two of demand, **the tank is really a battery for water** — the decision *can* be deferred, if you know what tomorrow looks like.

Almost nowhere is that decision actually made. These plants are usually run on a wall timer set to overnight hours, a habit inherited from mainland off-peak electricity tariffs. On a solar island that is exactly backwards: those are the hours with no sun.

What made it real for us was Tuvalu. In **2011 a drought left Funafuti with days of drinking water remaining** and a state of emergency declared; neighbouring countries flew in portable desalination units. The plant wasn't too small. **Nobody could see far enough ahead to act early.**

And the thing that convinced us to build it: on most islands the hard parts are already solved. The panels are on the roof, the tank is in the ground, the plant works, and the weather forecast is free and public. What's missing is the thin layer that looks at tomorrow and decides what to do tonight — and that layer is **software**, the cheapest thing you can add to an island.

## What it does

AquaGrid predicts, decides, explains, and detects.

1. **Predict** — a `RandomForestRegressor` forecasts water demand 48 hours ahead.
2. **Decide** — eight priority-ordered rules with a 12-hour lookahead dispatch the pump across solar, battery, rainfall and diesel.
3. **Explain** — every hour carries a plain-language reason; an open-weight LLM writes the operator briefing and answers follow-up questions.
4. **Detect** — the same forecast catches a burst pipe, dirty panels, fouling membranes, and fuel running out before the barge.

On our test island it uses **78% less diesel** than the timer these plants run today. But the number we care about more: the fuel tank holds 300 L with 12 days until the next barge. AquaGrid's burn rate makes that last **39 days**. The fixed timer runs dry **3.4 days early**; the reactive controller, **4.4 days early**. *Burning too much diesel and running out of diesel are different failures.*

## How we built it

**The model.** Two years of synthetic hourly history with genuinely learnable structure — twin daily peaks, weekends +30%, tourist season +22%, and demand rising ≈3.5% per °C. We trained on a **chronological split**: the final 60 days held out, so the model is tested on the future, never on shuffled rows.

$$\text{MAE} = \frac{1}{n}\sum_{t=1}^{n}\bigl|\hat{d}_t - d_t\bigr| = 45.3\ \text{L/h}, \qquad R^2 = 0.987$$

against a naive "predict the mean" baseline of 409.7 L/h — an **89% improvement**.

**The scheduler.** Each hour we project whether the reserve floor will be breached within the lookahead window $L = 12$:

$$V_t + n_{\text{sun}}\,Q + A\phi\!\!\sum_{k=t}^{t+L} r_k \;-\!\! \sum_{k=t}^{t+L} d_k \;<\; V_{\text{floor}}$$

where $Q$ is pump output, $n_\text{sun}$ the hours where solar clears the pump draw, $A$ the roof catchment and $\phi$ the runoff coefficient. If that holds, the scheduler acts *early* — spending a little diesel during partial sun to avoid a full-diesel run overnight.

Rainwater flows into the same balance, since 1 mm over 1 m² is 1 litre:

$$H_t = r_t \, A \, \phi, \qquad V_{t+1} = \operatorname{clip}\bigl(V_t + P_t + H_t - D_t,\; 0,\; V_{\max}\bigr)$$

**Detection — one idea, four failures.** We know what the tank *should* do, so anything else is evidence:

$$\varepsilon_t = \underbrace{(S_{t-1} - S_t)}_{\text{measured drop}} - \underbrace{(D_t - P_t - H_t)}_{\text{expected drop}}, \qquad z_t = \frac{\varepsilon_t}{\sigma}$$

with $\sigma$ calibrated on the first 12 hours. An alert fires when $z_t > 3$ for three consecutive hours. A 450 L/h burst injected at hour 14 is caught at **hour 16**, estimated at 452 L/h.

The same trick, aimed at slow decay: reverse-osmosis **specific energy** (kWh per m³) rises as membranes foul, so we fit $y = \beta_0 + \beta_1 t$ by least squares over 90 days and project the clean-in-place date, $t^{*} = (y_{\text{thresh}} - \beta_0)/\beta_1$ — currently **40 days out**.

**Running the AI on the phone.** This is the part we're proudest of. Normally a model lives on a server and the phone asks it questions. Instead we noticed that *every feature the forecaster uses is categorical except temperature*. So we evaluate the trained forest exhaustively over its entire input grid and ship the answers:

$$|\mathcal{T}| = \underbrace{2}_{\text{season}} \times \underbrace{7}_{\text{day}} \times \underbrace{24}_{\text{hour}} \times \underbrace{45}_{\text{temp buckets}} = 15{,}120$$

That is the model, not an approximation of it. The only loss is temperature discretised to 0.5 °C, costing a mean **5.5 L/h** — about 12% of the model's own error. The result: **72 predictions in 0.011 ms**, for islands the laptop never saw, with no ML runtime and no signal.

**Stack.** React Native (Expo) · scikit-learn · Open-Meteo for forecast and geocoding (no API key) · Groq serving open-weight `gpt-oss-120b` for the narration. **No backend** — an app that needs a server to decide whether to run a pump fails exactly when an island is cut off.

## Challenges we ran into

**Three times, we made the plant too good and broke the demo.** Our first parameters let the scheduler coast on solar alone: zero diesel, "100% savings", and half the rules unreachable. Fixing it meant *tightening* constraints — pump draw 42 → 50 kW, and rainwater catchment 2,500 → 900 m² when rain started covering 72% of demand and the reserve floor stopped binding. A system with no hard decisions looks broken, not impressive.

**Every island opened at exactly 59%.** The starting tank level was a seeded constant, so the biggest number on screen was decoration. We now request `past_days=1` and **replay yesterday's real weather** through the scheduler, so hour zero is a consequence. Funafuti opens at 32%, Reykjavík at 41%.

**Adding rain silently broke leak detection.** Harvest wasn't in the expected drop, so every shower read as a *negative* leak. One term, easy to miss, and the kind of bug that only appears when two features meet.

**Timezones nearly inverted everything.** Funafuti is UTC+12. With UTC timestamps, peak solar landed at local midnight and every pump decision flipped.

**Our LLM disappeared mid-build.** `llama-3.3-70b` was decommissioned on Groq. We moved to `gpt-oss-120b`, which returned *empty strings* — it's a reasoning model, and without capping `reasoning_effort` it spent the entire token budget thinking before emitting anything.

**Xcode 26.3 wouldn't compile Expo.** `expo-modules-jsi` annotates constructors with `SWIFT_RETURNS_RETAINED` but applies `SWIFT_SHARED_REFERENCE` at the closing brace, after those constructors are parsed. Swift 6's C++ interop rejects that ordering. We patched the header and wired the patch to `postinstall` so `npm install` can't silently undo it.

## What we learned

- **Constraints are the product.** Most of our tuning was making the problem *harder*, so the scheduler had something real to decide.
- **A model is data.** Realising the forecaster could be exhaustively evaluated and shipped as a table is what let real ML run offline on a phone.
- **One forecast beats four detectors.** The leak, the panels, the membranes and the fuel all reduce to the same comparison: what happened versus what should have.
- **Report the number that hurts.** Reykjavík saves only 23% because there's barely any sun to schedule against. We left it in the results table. A smaller honest number is worth more than a big one we can't defend.

## What's next

Real meter data instead of synthetic history; a battery sized against the 304 kWh we currently curtail; multi-tank distribution; and a hardware trial with an actual float sensor. The scheduler and the detectors would not need to change — only the data feeding them.

## Honest limitations

Demand history is synthetic, and all sensors — tank float, array meter, RO energy log — are simulated. Plant sizing scales linearly with population. Diesel is assumed at \$1.60/L. The lookahead cannot see past the 48-hour weather horizon. All of this is stated in the README and the handbook, because a system you cannot audit is not one to trust with an island's water.

**Repository:** [github.com/sbongula/aquagrid](https://github.com/sbongula/aquagrid) · **Site:** [sbongula.github.io/aquagrid](https://sbongula.github.io/aquagrid)
