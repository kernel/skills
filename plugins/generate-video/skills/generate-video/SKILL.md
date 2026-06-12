---
name: generate-video
description: Generate crisp, perfectly smooth MP4 videos from a web page or animated visualization by driving headless Chromium over the Chrome DevTools Protocol (CDP) with deterministic frame-stepping, then encoding with ffmpeg and (if remote) sharing via a cloudflared tunnel. Use when asked to make/generate a demo video, explainer clip, launch/marketing animation, social teaser, or any short rendered video from a web scene — especially animated stat/timeline/diagram visualizations — and when you need to iterate on it (tweak, re-render, compare). Solves the common "the recording has hitches / judder / dropped frames" problem.
---

# Generate Video

Turn a web page (usually a small Next.js/React scene you build) into a **smooth, deterministic MP4**. The core trick: don't screen-capture whatever the browser happens to paint — drive the animation off an **injected virtual clock** and render exactly N evenly-spaced frames per second as lossless PNGs, then encode with ffmpeg. Every frame is an exact point in time, so there is zero judder.

This is the pipeline behind the Kernel blog/launch animation clips (timeline races, fan-outs, throughput counters, live browser grids).

## When to use

- "make a short video of this", "record this animation", "I need a demo/launch/explainer clip"
- Animated visualizations: stat counters, timeline/race bars, architecture diagrams, before/after, live grids
- The user iterates: "make it smoother", "snappier", "try a few versions", "re-cut with X"
- Anytime a previous screen-recording looked choppy or had hitches

## If the video is a brand asset

Build the scene with your design system's tokens (colors, type stack, border treatment) before animating anything. On-brand scene → on-brand video.

## Composing the scene

The patterns below are the video-specific composition lessons — what makes these explainer animations read well *as a clip*.

**Pick a pattern that matches the point:**

| Point you're making | Pattern |
| --- | --- |
| "X is way faster than Y" | two/three **bars or racing chips** on a shared idea |
| "this number is big/small" | a single **count-up** stat, oversized |
| "many at once / at scale" | a **grid** that fills in (live tiles or animated cells) |
| "a pipeline of steps" | a **left-to-right flow** with labeled stages |

**Race / timeline anatomy** (top to bottom): left-aligned **eyebrow** (kicker) → row of **name + readout** (the live count-up `ms`) → the **track** (animated fill or a moving chip) → **stage subtitles** under the track → one **footnote** for caveats. Keep the eyebrow left-aligned to the *content column*, not the viewport — a centered content block with a viewport-left eyebrow looks broken.

**Conventions that worked:**
- **Color = meaning.** Neutral grey for the baseline/slow thing; your brand accent for the product/fast path. Don't color by row index.
- **A race is in *time*, not distance.** If two things "race", normalize each lane to the same finish and let them arrive at different *times* (fast one snaps and waits) — don't make the fast one travel a shorter track.
- **Make slow feel slow, fast feel instant.** Slow path keeps an eased curve; the fast path goes linear and short (~150ms) so it reads as a snap, not a glide.
- **Stage labels: anchor to the segment start, absolutely positioned — not fixed-width flex cells.** A narrow segment (e.g. a 300ms stage in a 6,900ms bar) will truncate its label ("identity bind" → "ident") if you size the label to the segment. Position each label at its start `left%`, `white-space: nowrap`, and let short ones overflow into the empty space after.
- **Count up the numbers** rather than snapping them — a ticking `ms` value sells motion even on otherwise-static bars. Set `font-variant-numeric: tabular-nums` (or a monospace font) on any live readout — proportional digits change width every frame and jitter the surrounding layout.
- **One reveal at a time.** Don't animate two independent elements simultaneously — the eye can't track both. Reveal, beat, next.
- **Open on a held beat** (~400ms of the composed-but-unstarted state) so the viewer reads the labels before anything moves, and **hold the final frame ≥1s** before the clip ends.

**Legibility for video, not for a desktop viewport:** type much larger than a normal web page (it'll be watched small / on mobile / autoplaying muted), generous spacing, high contrast. Render at 1600×900 or 1920×1080; bump `deviceScaleFactor` to 2 for retina-crisp text if the file size is fine.

**Square the numbers with reality.** If a bar/curve implies a real metric, match the source (blog, benchmark) and keep multiple bars apples-to-apples (same inclusion/exclusion — e.g. all exclude connect time). Label anything reconstructed or illustrative; never imply an animation is a live measurement.

## The stack

- **Scene**: a real web page. Easiest is a tiny Next.js (App Router) + React + TypeScript app with each scene on its own route (`/race`, `/fanout`, …). Animate with CSS + a `requestAnimationFrame` ramp; **no animation library needed**.
- **Driver**: headless **Chromium** controlled over **CDP** — raw WebSocket from **Node** (Node ≥ 18 has a global `WebSocket`). **No puppeteer/playwright required.**
- **Encode**: **ffmpeg** (PNG image sequence → H.264).
- **Deliver**: `python3 -m http.server` + a **cloudflared** quick tunnel when the user is remote from the rendering machine.

## Workflow

### 1. Build the scene with an injectable clock

The whole smoothness trick depends on the animation reading a clock you can *set*, not real wall-time. Add a hook that uses real `rAF` normally, but reads `window.__vt` (virtual time, ms) when `window.__REC__` is set:

```ts
// useClock(): elapsed ms. Recorder sets window.__REC__ + window.__vt and
// fires a "vt" event each frame, so every captured frame is an exact instant.
// Note: it ALWAYS subscribes — do not gate the subscription on an `active`
// flag, or a ramp that starts mid-clip will resubscribe late and skip frames.
export function useClock(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const w = window as unknown as { __REC__?: boolean; __vt?: number };
    if (w.__REC__) {
      const h = () => setT(w.__vt || 0);
      h(); window.addEventListener("vt", h);
      return () => window.removeEventListener("vt", h);
    }
    let raf = 0; const start = performance.now();
    const tick = (n: number) => { setT(n - start); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

// derive everything from the clock — eased ramps, phase switches, counters
export const useStart = (delay = 400) => useClock() >= delay;

// Eased 0..target ramp that begins the instant `go` flips true. It ANCHORS to
// the clock value at that moment (startRef) so it always starts from 0.
// power 1 = linear (no curve).
export function useRamp(target: number, dur: number, go: boolean, power = 2): number {
  const clock = useClock();
  const startRef = useRef<number | null>(null);
  if (go && startRef.current === null) startRef.current = clock;
  if (!go || startRef.current === null) return 0;
  const x = Math.min(1, (clock - startRef.current) / dur);
  return target * (1 - Math.pow(1 - x, power));
}
```

**Why the anchor matters (a bug that will bite you):** the clock reports *absolute* elapsed/virtual time. If a ramp computes `x = clock / dur`, then the moment `go` flips at clock=400ms it jumps straight to `400/dur` of the way — the bar visibly snaps to ~⅓ instead of growing from 0. Anchoring to `startRef` (the clock value when `go` first became true) fixes it. Same reason `useClock` must subscribe unconditionally rather than re-subscribing when a ramp activates.

Drive **all** time-based state from this — bar widths, count-ups, and phase switches (use `clock >= 4800` instead of `setTimeout`). Anything still on `setTimeout`/real `rAF` will freeze during recording.

One caveat on live (non-recording) mode: each `useClock` instance runs its own `rAF` loop anchored at its own mount time, so hooks in components mounted at different times read different timelines, and a late-mounted component starts at 0. Mount the whole scene up front (the patterns here all do), or call `useClock()` once in the scene root and derive ramps from that single value. Recording is immune either way — every instance reads the same global `window.__vt`.

Tip: a slower thing should keep an eased curve (`power 2`); to make something read as *instant* against it, make it **linear and short** (`power 1`, ~150 ms).

### 2. Record deterministically (the recorder)

A self-contained Node script — raw CDP, no deps:

```js
// node recsmooth.mjs <url> <durationMs> <framesDir> <cdpPort>
import fs from "node:fs";
const [,, URL, MS, DIR, PORT] = process.argv;
const FPS = 60, N = Math.round((Number(MS) / 1000) * FPS), step = 1000 / FPS;
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });

// connect to a PAGE target (not the browser endpoint — it lacks Page/Runtime)
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const page = list.find((t) => t.type === "page");
if (!page) throw new Error("no page target in /json/list — is Chromium running with a tab open?");
const ws = new WebSocket(page.webSocketDebuggerUrl.replace("localhost", "127.0.0.1"));
let id = 0; const pend = new Map();
const send = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
const ev = (x, awaitPromise = false) => send("Runtime.evaluate", { expression: x, awaitPromise });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
// install recording flags BEFORE any page script runs
await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__REC__=true; window.__vt=0;" });

await send("Page.navigate", { url: URL });
await sleep(1500);                              // let bundle + fonts load (clock stays at 0)
await ev("document.fonts && document.fonts.ready", true).catch(() => {});

for (let i = 0; i < N; i++) {
  await ev(`window.__vt=${Math.round(i * step)}; window.dispatchEvent(new Event('vt'));`);
  await ev("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))", true); // commit+paint
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(`${DIR}/f${String(i).padStart(4, "0")}.png`, Buffer.from(data, "base64"));
}
ws.close();
```

Launch Chromium headful-less first:

```bash
/usr/bin/chromium --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1600,900 \
  --remote-debugging-port=9460 about:blank >/tmp/chrome.log 2>&1 &
```

Size the clip: `durationMs` = intro hold + animation + a hold on the final frame (≥1s).

### 3. Encode with ffmpeg

```bash
ffmpeg -y -framerate 60 -i frames/f%04d.png -vf "format=yuv420p" -r 60 \
  -c:v libx264 -preset slow -crf 18 -movflags +faststart out.mp4
```

`yuv420p` + `+faststart` = plays everywhere and in-browser. PNG source + crf 18 = crisp. Sanity check with `ffprobe -show_entries stream=r_frame_rate,nb_frames,duration out.mp4`.

**Also want a GIF?** (Slack/docs that don't autoplay mp4.) Use a two-pass palette from the *same* PNG frames — a global palette keeps brand colors clean and the file small:

```bash
# 1) build an optimized palette
ffmpeg -y -framerate 60 -i frames/f%04d.png \
  -vf "fps=30,scale=1000:-1:flags=lanczos,palettegen=stats_mode=full" pal.png
# 2) encode the gif using it
ffmpeg -y -framerate 60 -i frames/f%04d.png -i pal.png \
  -lavfi "fps=30,scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" out.gif
```

30fps + ~1000px wide keeps a few-second clip well under ~250KB. Skip the single-pass `gif` encoder — it dithers per-frame and looks muddy.

### 4. Iterate (preview a single frame, no full record)

Before recording, **preview one frame** at a chosen virtual time to check the look: load the page with the flags injected, advance the clock (`window.__vt=<t>; window.dispatchEvent(new Event('vt'))` — the dispatch matters, `useClock` only updates on the `vt` event), wait 2 rAFs, `captureScreenshot` to a PNG, and view it. Tweak copy/timing/curve, repeat. Only do a full 60 fps record once the still looks right — it saves minutes per loop.

### 5. Deliver

- **Local user**: just give the `file://` path or a `http://localhost` link.
- **Remote user** (you're rendering on a remote/headless machine): serve the output dir and tunnel it.

```bash
mkdir -p /tmp/share && cp out.mp4 /tmp/share/
( cd /tmp/share && nohup python3 -m http.server 8088 --bind 127.0.0.1 >/tmp/fs.log 2>&1 & )
nohup cloudflared tunnel --url http://127.0.0.1:8088 --protocol http2 \
  --metrics 127.0.0.1:45088 --no-autoupdate >/tmp/cf.log 2>&1 &
sleep 9; grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf.log | head -1
```

Share `<tunnel>/out.mp4`. Tear down when they've grabbed it.

## Gotchas (these will bite you)

- **`localhost` may not resolve on minimal/sandboxed VMs.** Use `127.0.0.1` everywhere, and **rewrite the CDP WebSocket URL** (`webSocketDebuggerUrl.replace("localhost","127.0.0.1")`) — it comes back with `localhost`. Same reason cloudflared needs `--metrics 127.0.0.1:<port>` or it crashes resolving `localhost`.
- **Connect to a PAGE target, not the browser endpoint.** `/json/version`'s socket only has `Target`/`Browser` domains — `Page.*`/`Runtime.*` throw "wasn't found". Pull a `type === "page"` entry from `/json/list`.
- **Anything on real `setTimeout`/`rAF` freezes during recording.** It won't advance with `__vt`. Route every animation, phase switch, and counter through the clock hook. (Scenes with genuinely async content — e.g. real network/live browsers loading — can't be made fully deterministic; record those in real time and accept some variance.)
- **Fonts flicker on the first frames** if you start stepping before they load. Wait `document.fonts.ready` after navigate (and give a real-time `sleep` for the bundle).
- **`pkill -f cloudflared` / `pkill -f "next start"` can match its own command line** and kill the shell (exit 144). Kill by port (`fuser -k 8088/tcp`) or by exact PID instead.
- **Quick tunnels die after idle.** The `*.trycloudflare.com` hostname rotates or the edge registration drops. If a link 404s/000s, restart cloudflared and hand over the new URL — the files on disk are fine.
- **Clean up real browser sessions.** If a scene spins up real cloud browsers (e.g. a live grid of [Kernel](https://www.kernel.sh) browsers), delete them afterward, scoped to the ones you just created, so they don't keep billing.

## Guidelines

- Keep clips short (a few seconds to ~30s). One idea per clip; chain clips if needed.
- 60 fps, 1600×900 (or 1920×1080) is a good default. Bump `deviceScaleFactor` to 2 for retina-crisp text if file size allows.
- Make timings honest. If a number/curve implies a real metric, match the source (blog, benchmark). Label any reconstructed/illustrative element as such — don't pass an animation off as a live measurement.
- Always preview a still before the full record.
- Verify the encoded MP4 before sharing, not just the PNG frames: `ffprobe -show_entries stream=nb_frames,duration out.mp4` should match `durationMs` × fps, and extract + view the first, a middle, and the last frame (`ffmpeg -ss <t> -i out.mp4 -frames:v 1 check.png`) to catch font flicker, missing assets, or a truncated render.
