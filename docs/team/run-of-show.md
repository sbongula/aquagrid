# AquaGrid — run of show

**One minute each.** Every section opens with a title slide — that is your cue to take over, and a free two seconds to breathe. Then two content slides. Deck: `slides.html` (arrow keys, `F` for fullscreen) or `AquaGrid-Slides.pdf`.

Everything below is written to be *said out loud*. Short sentences. Every number you need is already on your slide, so nothing has to be memorised — glance at it and say it.

| Who | Part | Slides | Time |
|---|---|---|---|
| **Rishik** | The problem | 2–4 | 60 s |
| **Neekin** | The solution | 5–7 | 60 s |
| **Srihan** | The architecture | 8–10 | 60 s |
| **Ednit** | The features | 11–13 | 60 s |
| **All** | Demo | 14–16 | 60 s |
| **Gowtham** | The code and the site | 17–19 | 60 s |

## Rishik — The problem
*Slides 2–4 · 60 seconds*

- Small islands can't just turn on a tap. Rain fills their tanks — and when the rain stops, a machine turns seawater into drinking water.

- That machine uses more electricity than anything else on the island.

- In the day that power is free, because it's sunshine. At night it's a diesel generator — and the diesel arrives by boat every few weeks.

- The tank holds about two days of water. So it's really a battery for water. You can fill it whenever you want — which means you should fill it when the power is free.

- But nobody actually chooses. Most islands run the machine on a timer set for the middle of the night, because that's when electricity is cheap on the mainland. On a solar island that's backwards — the middle of the night is exactly when there's no sun.

- And this matters. In 2011 Tuvalu got down to a few days of drinking water and declared a state of emergency. Their machine wasn't too small. Nobody could see what was coming.

**Then say:** “So we built something that can. Neekin.”

## Neekin — The solution
*Slides 5–7 · 60 seconds*

- Our app does four things: predict, decide, explain, detect.

- It predicts how much water the island will use for the next two days. It decides the best hours to run the machine. It explains why in plain English. And it spots problems early.

- We trained an AI on two years of water use. Then — and this is the important bit — we tested it on days it had never seen. Real future days, not a shuffled deck.

- It gets within about 45 litres an hour, out of roughly 940. That's 89% better than just guessing the average.

- Here's what that's worth. The normal night timer burns 70 litres of diesel. Ours burns 15.

- But the number that really matters is this: the island has 300 litres of fuel and the boat is 12 days away. The night timer runs out of fuel *before the boat arrives*. So does filling-when-low. Ours doesn't.

**Then say:** “And all of it runs on a phone. Srihan.”

## Srihan — The architecture
*Slides 8–10 · 60 seconds*

- The whole thing runs on the phone. There's no server anywhere.

- The app is React Native — that's what you see and tap. We drew every chart ourselves.

- The brain is a RandomForest AI. We trained it on a laptop, then packed it *inside* the app.

- The phone grabs its own weather forecast from Open-Meteo — that's free and needs no sign-up. And Groq gives us an open AI model called GPT-OSS that explains things in normal English.

- Normally an AI lives on a big computer and your phone asks it questions over the internet. We did the maths ahead of time for every situation the AI could face — 15,120 answers — and packed them all in. It predicts a whole day in a hundredth of a millisecond.

- And no server is deliberate. An app that needs the internet to decide when to make water would stop working exactly when an island gets cut off — which is when you need it most.

- One last thing: the AI makes every decision. The language model only writes the words. Delete it and every number stays the same.

**Then say:** “Ednit will show you what it actually does.”

## Ednit — The features
*Slides 11–13 · 60 seconds*

- This is one real day. Orange is sunshine, blue is water being used.

- When the orange goes above the dotted line, there's enough sun to run the machine for free.

- The strip along the bottom is what it actually chose. Green means it ran on sunshine. Red means it had to use diesel. Dark means it waited.

- It also catches problems. It knows how fast the tank *should* empty — so when the real tank drops faster than that, something's wrong.

- We tested it with a burst pipe. It found it in two hours. It also spots dirty solar panels, filters that need cleaning, and running low on fuel before the boat comes.

- And it uses the rain. Rain off the rooftops gave 24% of all the water — so if rain is coming, it waits instead of wasting fuel.

**Then say:** “Easier to just show you.”

## All — Demo
*Slides 14–16 · 60 seconds*

- Here's what it's doing right now — and why, in a full sentence.

- Here's the day ahead. Green is free sun, blue is stored sun, red is diesel.

- Here's how much fuel it saves.

- Now watch — press burst pipe. The alarm appears. Nobody would have spotted that for hours.

- Press cyclone. It stops trying to save fuel and fills the tank instead, because after a storm the boat isn't coming.

- Switch to a different island — it works everything out again, on the phone.

- Ask it a question. Then just ask 'why?' and it remembers what it said.

- And now aeroplane mode. Everything still works. Because on a real island, the internet is the first thing to go.

**Then say:** “Gowtham can show you it's real underneath.”

## Gowtham — The code and the site
*Slides 17–19 · 60 seconds*

- All the decisions come from 755 lines of code, and we can test the whole thing with one command — no phone needed.

- It's in four parts: one teaches the AI, one makes the decisions, one talks to the weather service, and one draws the screen.

- The weather data is completely free and needs no sign-up.

- Everything's written down — a website and a 35-page handbook explaining every file. The charts on the site are built from the real data, not screenshots, so they can't go out of date.

- And we didn't just claim it saves fuel. We ran three different ways of doing it — ours, the night timer, and fill-when-low — on the same weather, and compared them.

**Then say:** “Happy to take questions.”

## If a judge asks…

**“Is the AI real, or is it just ChatGPT?”**  
Real. We trained it ourselves on two years of data, and we tested it on days it had never seen. It makes every decision. The ChatGPT-style model only writes the sentences — you could delete it and every number would stay identical.

**“Why is Reykjavík only 23%?”**  
Because there's barely any sun in Iceland, so there's much less for us to save. We left that number in on purpose. A smaller honest number is worth more than a big one we can't back up.

**“Isn't the data made up?”**  
The water usage is simulated — we say so everywhere. But the weather is real and live, and the patterns we built in are the ones real households have: a morning peak, an evening peak, and more water on hot days.

## On the day

- **Don't tap the AI questions too fast.** Three in a row can hit the free limit and it falls back to a simpler answer. Leave a couple of seconds.
- **Move the blue gear button** out of the way before you start — that's part of the developer tool, not our app.
- **Finish on aeroplane mode.** It's the strongest ending you have.

