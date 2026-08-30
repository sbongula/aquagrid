# AquaGrid

**Team BitHeads** — Rishik · Neekin · Srihan · Ednit · Gowtham
DreamHacks 2026 · Track 2 — AI, Automation & Logic

---

## Inspiration

On a small island, water and electricity are the same problem.

Rain fills the tanks. When the rain stops, a machine turns seawater into drinking water — and that machine uses more electricity than anything else on the island. In the day that power is free sunshine. At night it's a diesel generator, and the diesel comes by boat every few weeks.

So every hour there's a choice: make water now, or wait. At midday it's basically free. At 2 a.m. it costs fuel. The tank holds about two days of water, so **the tank is really a battery** — you can fill it whenever you want.

But nobody chooses. Most islands run the machine on a timer set for the middle of the night, copying how electricity is priced on the mainland. On a solar island that's backwards, because the middle of the night is when there's no sun.

In 2011 a drought left Tuvalu with a few days of drinking water and a state of emergency. Their machine wasn't too small. **Nobody could see what was coming.**

The expensive parts already exist on these islands — panels, tank, machine. The weather forecast is free. The only missing piece is software that looks at tomorrow and decides what to do tonight.

## What it does

**Predict, decide, explain, detect.**

It predicts how much water the island will use for the next two days, picks the best hours to run the machine, explains why in normal English, and spots problems early.

It uses **78% less diesel** than the timer these places use today.

But this is the number we care about: the island has **300 litres of fuel** and the boat is **12 days away**. AquaGrid makes it last **39 days**. The night timer runs out **3.4 days before the boat arrives**.

## How we built it

**The AI.** We made two years of hourly water-use data with real patterns — a morning rush, an evening rush, more on weekends, more when it's hot — and trained a Random Forest on it.

The important bit is how we tested it. We held back the **last 60 days** and only tested on those, so it was always guessing about days it had never seen. It gets within **45 litres an hour** out of about 940. Guessing the average is off by 410, so we're **89% better than guessing**.

**Deciding.** Every hour it looks 12 hours ahead and asks: *if I only run the machine when the sun is strong, will the tank drop below the safety line?* If yes, it acts early — a little diesel now beats a lot at midnight. Eight rules, checked in order, first match wins.

**Rain.** One millimetre of rain on one square metre is one litre:

$$\text{litres} = \text{mm of rain} \times \text{roof area} \times 0.8$$

If rain is coming, it waits instead of burning fuel. Rain gave **24%** of all our water.

**Catching problems.** One idea catches four failures. The app knows how fast the tank *should* empty, so:

$$\text{surprise} = \text{what actually vanished} - \text{what should have}$$

If the surprise stays big for three hours, something's wrong. We faked a burst pipe leaking 450 litres an hour — it found it in **2 hours** and guessed 452. The same trick spots dirty solar panels (ours lose 13%) and worn-out filters (40 days until cleaning).

**Putting the AI on the phone.** Normally an AI lives on a server and your phone asks it questions. We didn't want that — an app that needs internet to run a pump fails exactly when an island gets cut off.

Then we noticed everything our AI looks at is a short list: 24 hours, 7 days, 2 seasons, plus temperature. So we worked out the answer for **every situation it could ever face** and put them all in the app:

$$2 \times 7 \times 24 \times 45 = 15{,}120 \text{ answers}$$

That isn't a summary of the AI. That *is* the AI. It predicts a whole day in **0.011 milliseconds**, offline, even for islands our laptop never saw.

**Built with** React Native, scikit-learn, Open-Meteo for free weather, and Groq running an open model called GPT-OSS for the explanations. No server anywhere.

## Challenges

**We made it too easy — three times.** Our first version had so much solar the app never faced a hard choice. Zero diesel, "100% savings", half our rules never running. Fixing it meant making the problem *harder*. A system with no hard decisions looks broken, not clever.

**Every island started at exactly 59%** — we'd just made that number up. Now we download *yesterday's* real weather and run it through first, so the starting level is a result. Funafuti starts at 32%, Reykjavík at 41%.

**Rain broke the leak detector.** We forgot to tell it rain adds water, so every shower looked like the tank mysteriously filling itself.

**Time zones almost ruined everything.** Tuvalu is 12 hours ahead. The wrong clock put "peak sunshine" at midnight and flipped every decision.

**Our AI got deleted mid-project.** The provider shut down the model we were using. Its replacement returned totally empty answers — it was a "thinking" model burning its whole word budget thinking, with nothing left to say.

**Xcode wouldn't build the app.** A library inside Expo doesn't compile with Apple's newest compiler. We patched it ourselves and made the patch reapply automatically.

## What we learned

- **Making the problem harder made the project better.** Most of our work was adding constraints, not removing them.
- **An AI can be turned into a list** — and then it runs offline on a phone.
- **One good idea beat four separate ones.** The leak, the dirty panels, the worn filters and the fuel warning are all the same comparison underneath.
- **Say the number that makes you look worse.** In Reykjavík we only save 23%, because Iceland barely gets sun. We left it in on purpose.

## What's next

Real water-meter data instead of ours. A bigger battery — we currently waste 304 kWh of sunshine with nowhere to put it. And a test with a real sensor in a real tank.

## Being honest

Our water-use data and sensors are simulated, and we say so everywhere including inside the app. The weather is real and live. We'd rather show a smaller number we can prove than a bigger one we can't.

**Code:** [github.com/sbongula/aquagrid](https://github.com/sbongula/aquagrid) · **Site:** [sbongula.github.io/aquagrid](https://sbongula.github.io/aquagrid)
