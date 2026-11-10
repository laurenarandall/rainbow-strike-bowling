import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:4173/rainbow-strike-bowling/";
const OUT = "/workspace/rainbow-strike-bowling/peek5/";
const mode = process.argv[2] || "desktop";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const phone = mode === "phone";
await page.setViewport(phone ? { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { width: 1280, height: 800 });
await page.goto(BASE + "?q=1", { waitUntil: "networkidle2" });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("rainbow-strike-bowling-theme", "rainbow"); });
await page.goto(BASE + "?q=1", { waitUntil: "networkidle2" });
await page.click('[data-testid="pick-knight"]');
await sleep(7000);
const dbg = () => page.evaluate(() => window.__rsbDebug && window.__rsbDebug());
async function waitAim(prevFrameThrows) {
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const d = await dbg();
    if (d && d.phase === "aiming") return d;
  }
  return dbg();
}
async function doThrow(o) {
  await page.evaluate((o) => window.__rsbThrow(o), o);
  await sleep(800);
  return waitAim();
}
const p = phone ? "phone_" : "desktop_";
const shot = (name, clip) => page.screenshot({ path: OUT + p + name + ".png", ...(clip ? { clip } : {}) });
const boardInfo = () => page.evaluate(() => {
  const el = document.querySelector('[data-testid="starboard"]');
  const r = el.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), w: innerWidth, h: Math.round(r.height), text: el.innerText.replace(/\s+/g, " ").slice(0, 200) };
});
console.log("start", JSON.stringify(await dbg()));
await shot("01_rainbow_start");
// A few throws so the scoreboard has marks
await doThrow({ aimX: 0.25, power: 0.66, spin: 0 });
await doThrow({ aimX: -0.6, power: 0.66, spin: 0 });
let d = await doThrow({ aimX: 0.3, power: 0.66, spin: 0 });
console.log("after3", JSON.stringify({ frame: d.frame, pins: d.pins.map((x) => x.k ? 1 : 0).join("") }), JSON.stringify(await boardInfo()));
await shot("02_rainbow_midgame");
// Globe dropdown
await page.click('[data-testid="globe-button"]');
await sleep(600);
await shot("03_globe_dropdown_open");
const before = await boardInfo();
await page.click('[data-testid="world-lava"]');
await sleep(7000);
d = await dbg();
console.log("lava", JSON.stringify({ frame: d.frame, phase: d.phase, physOn: d.physOn, pinsOff: d.pins.map((x) => x.k ? 1 : 0).join("") }), JSON.stringify(await boardInfo()), "before:", before.text);
await shot("04_switched_to_lava_midgame");
d = await doThrow({ aimX: 0.25, power: 0.66, spin: 0 });
await shot("05_lava_after_next_throw");
await page.evaluate(() => window.__rsbUI.setTheme("hero"));
await sleep(7000);
console.log("hero", JSON.stringify(await boardInfo()));
await shot("06_switched_to_hero_city");
await page.evaluate(() => window.__rsbUI.setTheme("space"));
await sleep(7000);
await shot("07_switched_to_outer_space");
// Palette menu
await page.click('[data-testid="palette-button"]');
await sleep(600);
await shot("08_scoreboard_style_menu");
await page.evaluate(() => window.__rsbUI.menu(null));
const styles = ["world", "rainbow", "redglitter", "blackglitter", "blackgold", "glass", "neon", "candy"];
for (const [i, s] of styles.entries()) {
  await page.evaluate((s) => window.__rsbUI.setBoard(s), s);
  await sleep(900);
  if (phone) await shot(`style_${String(i + 1).padStart(2, "0")}_${s}`, { x: 0, y: 0, width: 390, height: 200 });
  else await shot(`style_${String(i + 1).padStart(2, "0")}_${s}`, { x: 0, y: 0, width: 1280, height: 260 });
}
await page.evaluate(() => { window.__rsbUI.setBoard("redglitter"); window.__rsbUI.setAlpha(0.6); });
await sleep(800);
await shot("09_redglitter_see_through_full");
await page.evaluate(() => { window.__rsbUI.setBoard("glass"); window.__rsbUI.setAlpha(0.28); });
await sleep(800);
await shot("10_glass_ghost_full");
console.log("persist", await page.evaluate(() => [localStorage.getItem("rainbow-strike-bowling-theme"), localStorage.getItem("rainbow-strike-bowling-board"), localStorage.getItem("rainbow-strike-bowling-board-alpha")].join(",")));
if (phone) {
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await sleep(1500);
  await page.evaluate(() => { window.__rsbUI.setBoard("world"); window.__rsbUI.setAlpha(1); });
  await sleep(800);
  console.log("375", JSON.stringify(await boardInfo()));
  await shot("11_375px_width");
}
console.log("errors", JSON.stringify(errors.slice(0, 10)));
await browser.close();
