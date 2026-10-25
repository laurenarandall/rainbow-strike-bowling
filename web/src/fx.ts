// DOM celebration effects: name phrases, dancing animals, fireworks.
export const PLAYER_NAME = "Narek";

const FONTS = [
  "'Luckiest Guy', cursive",
  "'Chewy', cursive",
  "'Bungee', cursive",
  "'Pacifico', cursive",
  "'Fredoka', sans-serif",
  "'Bubblegum Sans', cursive",
  "'Baloo 2', cursive",
];
const COLORS = ["#ff3b3b", "#ff8c1a", "#ffd60a", "#3ddc4a", "#1fb6ff", "#4c5cff", "#b14cff", "#ff4fb8"];

export const NAME_PHRASES = [
  `Go, ${PLAYER_NAME}!`,
  `You're doing amazing, ${PLAYER_NAME}!`,
  `${PLAYER_NAME} the Bowling Champ!`,
  `Super roll, ${PLAYER_NAME}!`,
  `${PLAYER_NAME} is a superstar! ⭐`,
  `Keep going, ${PLAYER_NAME}!`,
  `High five, ${PLAYER_NAME}! ✋`,
  `${PLAYER_NAME} rocks! 🎸`,
  `Way to go, ${PLAYER_NAME}!`,
  `${PLAYER_NAME}, you've got this!`,
  `Bowling wizard ${PLAYER_NAME}! 🪄`,
  `${PLAYER_NAME} is on fire! 🔥`,
  `Look at ${PLAYER_NAME} go!`,
  `${PLAYER_NAME} the Pin Smasher!`,
  `Wow, ${PLAYER_NAME}! Wow wow wow!`,
  `${PLAYER_NAME} for the win! 🏆`,
  `Rainbow power, ${PLAYER_NAME}! 🌈`,
  `${PLAYER_NAME} is unstoppable!`,
  `Nice aim, ${PLAYER_NAME}! 🎯`,
  `Roll it, ${PLAYER_NAME}!`,
  `Believe in yourself, ${PLAYER_NAME}!`,
  `${PLAYER_NAME} makes it look easy!`,
  `Big roll energy, ${PLAYER_NAME}!`,
  `The pins are scared of ${PLAYER_NAME}! 😱`,
  `${PLAYER_NAME}, bowling legend!`,
  `So proud of you, ${PLAYER_NAME}! 💖`,
  `${PLAYER_NAME} the Brave!`,
  `Super ${PLAYER_NAME}! 🦸`,
  `${PLAYER_NAME} is a rock star! ⭐`,
  `You're a natural, ${PLAYER_NAME}!`,
  `Lucky lane for ${PLAYER_NAME}! 🍀`,
  `Champion vibes, ${PLAYER_NAME}!`,
  `${PLAYER_NAME} saves the castle! 🏰`,
  `Practice makes perfect, ${PLAYER_NAME}!`,
  `Smooth roll, ${PLAYER_NAME}!`,
  `${PLAYER_NAME}'s got the magic touch! ✨`,
  `The crowd loves ${PLAYER_NAME}! 📣`,
  `Unicorn approved, ${PLAYER_NAME}! 🦄`,
  `Turtle-y awesome, ${PLAYER_NAME}! 🐢`,
  `Squirrel says WOW, ${PLAYER_NAME}! 🐿️`,
  `${PLAYER_NAME} = awesome!`,
  `Better every roll, ${PLAYER_NAME}!`,
  `Don't stop now, ${PLAYER_NAME}!`,
  `${PLAYER_NAME}, captain of the castle!`,
  `That's how it's done, ${PLAYER_NAME}!`,
  `Strike time, ${PLAYER_NAME}!`,
  `Fearless ${PLAYER_NAME}! 💪`,
  `${PLAYER_NAME} is dazzling! 🌟`,
  `Hooray for ${PLAYER_NAME}! 🎉`,
  `Gold medal roll, ${PLAYER_NAME}! 🥇`,
  `Epic, ${PLAYER_NAME}!`,
  `${PLAYER_NAME} is a bowling boss!`,
  `Keep shining, ${PLAYER_NAME}! ☀️`,
];

export const STRIKE_PHRASES = [
  `STRIKE KING ${PLAYER_NAME}! 👑`,
  `All 10! Incredible!`,
  `${PLAYER_NAME} knocked them ALL down!`,
  `Pin party! 🎉`,
  `Perfect hit!`,
  `Legendary, ${PLAYER_NAME}!`,
  `Boom! Strike!`,
  `Unbelievable, ${PLAYER_NAME}!`,
  `Total pin wipeout!`,
  `The castle bows to ${PLAYER_NAME}!`,
  `Kapow! 💥`,
  `You're a strike machine, ${PLAYER_NAME}!`,
];

export const SPARE_PHRASES = [
  `Clean up crew ${PLAYER_NAME}! 🧹`,
  `Spare-tacular!`,
  `No pin left behind, ${PLAYER_NAME}!`,
  `Sweet spare!`,
  `Smart shot, ${PLAYER_NAME}!`,
  `Picked them all up!`,
  `Spare-o-rama, ${PLAYER_NAME}!`,
  `Nailed the spare!`,
];

export const MISS_PHRASES = [
  `Shake it off, ${PLAYER_NAME}! You can do it!`,
  `Next one's yours, ${PLAYER_NAME}!`,
  `Even champions miss sometimes!`,
  `Deep breath, ${PLAYER_NAME}, try again!`,
  `Oops! Let's go again!`,
  `You'll get them, ${PLAYER_NAME}!`,
  `That was a practice roll!`,
  `Keep trying, ${PLAYER_NAME}! 💪`,
  `Aim for the middle, ${PLAYER_NAME}!`,
  `Good try! Roll again!`,
];

export const BIG_HIT_PHRASES = [
  `So close to a strike!`,
  `Almost all of them!`,
  `Huge hit!`,
  `What a roll!`,
  `Pins went flying!`,
  `Massive!`,
];

export const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

let styleAdded = false;
function ensureStyle() {
  if (styleAdded || typeof document === "undefined") return;
  styleAdded = true;
  const st = document.createElement("style");
  st.textContent = `
@keyframes rsbFloatAcross{0%{transform:translateX(0) translateY(0) rotate(-4deg) scale(.6);opacity:0}
10%{opacity:1;transform:translateX(calc(var(--dist)*.1)) translateY(-10px) rotate(3deg) scale(1)}
50%{transform:translateX(calc(var(--dist)*.5)) translateY(12px) rotate(-3deg) scale(1.08)}
90%{opacity:1}100%{transform:translateX(var(--dist)) translateY(-8px) rotate(4deg) scale(1);opacity:0}}
@keyframes rsbDisco{0%,100%{transform:translateY(0) rotate(-12deg) scaleX(1)}25%{transform:translateY(-28px) rotate(10deg) scaleX(-1)}
50%{transform:translateY(0) rotate(-8deg) scaleX(-1)}75%{transform:translateY(-22px) rotate(14deg) scaleX(1)}}
@keyframes rsbFadeInOut{0%{opacity:0}12%{opacity:1}85%{opacity:1}100%{opacity:0}}
@keyframes rsbSpin{to{transform:rotate(360deg)}}
@keyframes rsbSpark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.3);opacity:0}}
@keyframes rsbBadge{0%{transform:translate(-50%,-40px) scale(.3);opacity:0}15%{transform:translate(-50%,0) scale(1.15);opacity:1}
25%{transform:translate(-50%,0) scale(1)}85%{opacity:1}100%{transform:translate(-50%,-20px) scale(.9);opacity:0}}
`;
  document.head.appendChild(st);
}

/** Where phrases fly: the side gutters on wide screens, the sky above the lane on narrow ones. */
export function phraseLane(w: number, h: number, rnd = Math.random): { side: "left" | "right" | "top"; topPct: number; bandPct: number } {
  if (w > 900 && w / Math.max(1, h) > 1.3) {
    return { side: rnd() < 0.5 ? "left" : "right", topPct: 16 + rnd() * 48, bandPct: 27 };
  }
  return { side: "top", topPct: 9 + rnd() * 10, bandPct: 100 };
}

/** A cute phrase with the player's name floats across the sky (or down the side bands on big screens). */
export function floatPhrase(container: HTMLElement, text = pick(NAME_PHRASES)) {
  ensureStyle();
  const el = document.createElement("div");
  const w = container.clientWidth || 800;
  const h = container.clientHeight || 600;
  const lane = phraseLane(w, h);
  el.textContent = text;
  el.dataset.phraseSide = lane.side;
  const base =
    `font-family:${pick(FONTS)};color:${pick(COLORS)};pointer-events:none;z-index:12;-webkit-text-stroke:1.5px #fff;` +
    "text-shadow:0 3px 0 rgba(0,0,0,.18),0 0 14px rgba(255,255,255,.9);";
  if (lane.side === "top") {
    const ltr = Math.random() < 0.5;
    el.style.cssText =
      `position:absolute;top:${lane.topPct}%;${ltr ? "left:-10%" : "right:-10%"};white-space:nowrap;` +
      base + "font-size:clamp(22px,4.5vw,44px);" +
      `--dist:${(ltr ? 1 : -1) * w * 1.2}px;animation:rsbFloatAcross ${6 + Math.random() * 2}s ease-in-out forwards;`;
  } else {
    // Fly in from the screen edge across the side band, stop short of the lane.
    const band = (w * lane.bandPct) / 100;
    const left = lane.side === "left";
    el.style.cssText =
      `position:absolute;top:${lane.topPct}%;${left ? "left" : "right"}:${-band * 0.55}px;width:${band * 0.85}px;` +
      `text-align:center;white-space:normal;line-height:1.05;` +
      base + "font-size:clamp(24px,2.7vw,50px);" +
      `--dist:${(left ? 1 : -1) * band * 0.65}px;animation:rsbFloatAcross ${6 + Math.random() * 2}s ease-in-out forwards;`;
  }
  container.appendChild(el);
  setTimeout(() => el.remove(), 8500);
}

/** Unicorns, squirrels and turtles have a little disco party. */
export function animalDisco(container: HTMLElement, ms = 3500) {
  ensureStyle();
  const party = document.createElement("div");
  party.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:11;" +
    `animation:rsbFadeInOut ${ms}ms ease forwards;`;
  const ball = document.createElement("div");
  ball.textContent = "🪩";
  ball.style.cssText =
    "position:absolute;top:13%;left:50%;margin-left:-28px;font-size:56px;animation:rsbSpin 1.2s linear infinite;";
  party.appendChild(ball);
  // Disco light beams
  for (let i = 0; i < 6; i++) {
    const beam = document.createElement("div");
    beam.style.cssText =
      `position:absolute;top:18%;left:50%;width:14px;height:70%;transform-origin:top center;` +
      `background:linear-gradient(${COLORS[i]},transparent);opacity:.35;` +
      `transform:rotate(${-60 + i * 24}deg);filter:blur(2px);`;
    party.appendChild(beam);
  }
  const animals = ["🦄", "🐿️", "🐢", "🦄", "🐿️", "🐢"];
  animals.forEach((a, i) => {
    const el = document.createElement("div");
    const left = i < 3 ? 3 + i * 9 : 70 + (i - 3) * 9;
    el.textContent = a;
    el.style.cssText =
      `position:absolute;top:${30 + (i % 3) * 7}%;left:${left}%;font-size:clamp(36px,6vw,64px);` +
      `animation:rsbDisco ${0.55 + (i % 3) * 0.08}s ease-in-out ${i * 0.07}s infinite;` +
      "filter:drop-shadow(0 4px 4px rgba(0,0,0,.25));";
    party.appendChild(el);
  });
  container.appendChild(party);
  setTimeout(() => party.remove(), ms + 100);
}

/** Fireworks bursting all over the screen. */
export function fireworks(container: HTMLElement, bursts = 8, spreadMs = 2200) {
  ensureStyle();
  for (let b = 0; b < bursts; b++) {
    setTimeout(() => {
      const x = 8 + Math.random() * 84;
      const y = 8 + Math.random() * 55;
      const color = pick(COLORS);
      const color2 = pick(COLORS);
      const n = 28;
      for (let i = 0; i < n; i++) {
        const s = document.createElement("div");
        const ang = (i / n) * Math.PI * 2;
        const dist = 60 + Math.random() * 90;
        s.style.cssText =
          `position:absolute;left:${x}%;top:${y}%;width:7px;height:7px;border-radius:50%;` +
          `background:${i % 2 ? color : color2};box-shadow:0 0 8px ${color};pointer-events:none;z-index:13;` +
          `--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist + 30}px;` +
          `animation:rsbSpark ${0.9 + Math.random() * 0.5}s cubic-bezier(.1,.8,.3,1) forwards;`;
        container.appendChild(s);
        setTimeout(() => s.remove(), 1600);
      }
    }, (b / bursts) * spreadMs + Math.random() * 200);
  }
}

/** A badge pops in at the top of the screen. */
export function badgeToast(container: HTMLElement, icon: string, title: string, delay = 0) {
  ensureStyle();
  setTimeout(() => {
    const el = document.createElement("div");
    el.innerHTML = `<span style="font-size:40px">${icon}</span><div><div style="font-size:13px;opacity:.8">NEW AWARD!</div><div>${title}</div></div>`;
    el.style.cssText =
      "position:absolute;top:96px;left:50%;display:flex;gap:10px;align-items:center;" +
      "padding:10px 20px;border-radius:20px;background:linear-gradient(135deg,#fde68a,#f9a8d4);" +
      "border:4px solid #fff;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:40;pointer-events:none;" +
      "font-family:'Luckiest Guy','Fredoka',sans-serif;font-size:22px;color:#6d28d9;white-space:nowrap;" +
      "animation:rsbBadge 3.6s ease forwards;";
    container.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }, delay);
}
