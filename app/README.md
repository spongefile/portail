# Portail Editor (unofficial)

> **Unofficial. Use at your own risk.** This is a community project, not made by, affiliated with, or
> endorsed by eowave. It talks to your hardware over MIDI SysEx based on reverse-engineering, not
> official documentation. It is provided "as is", with no warranty of any kind; you are responsible
> for anything that happens to your module or your patches. It does **not** and cannot flash
> firmware — firmware updates remain eowave's official editor's job. "eowave" and "Portail" are the
> trademarks of their owner and are used here only to describe compatibility.

A browser-based editor for the [eowave Portail](https://www.eowave.com/) — a 5 HP Eurorack
MIDI-to-CV interface with 8 CV + 8 D-GATE outputs. A replacement for the official web editor, built
to be honest about what it knows, safe against bricking the module, and fully usable with no hardware
attached.

Runs entirely in your browser. No backend, no accounts, no cloud — it works from any static host or
straight off your disk. by [spongefile](https://www.spongefile.com).

## Run it

```
cd app
npm install
npm run dev      # opens against a built-in simulator — no hardware needed
npm run build    # static site in dist/
npm test         # Vitest — the SysEx codec and model
```

`npm run dev` opens the editor against a **simulator** (a simulated Portail with its own memory and 8
presets), so the whole UI is usable immediately. To talk to a real module, click **Use real
hardware** — this needs a Chromium browser (Chrome/Edge); Safari and Firefox don't implement Web
MIDI, and the app says so plainly rather than appearing broken.

## What works

- **All 16 outputs on one screen**, laid out like the panel (CV left, D-GATE right), tinted by an
  editor mode-family colour, each drilling into a full parameter editor.
- **Every parameter labelled** with its unit, range, default, and a plain-language explanation.
  Anything not yet confirmed against hardware is visibly marked *unverified*.
- **Offline editing with explicit sync.** Edit with no module attached; the connection bar always
  says whether a module matches the editor and when it was last verified. **Read from module** and
  **Send to module** are separate, deliberate actions — nothing is ever written as a side effect of
  editing.
- **Undo/redo** across the whole config, and your working state **survives a reload** (localStorage).
- **Portable config files** — versioned, validated, human-diffable JSON; import/export raw `.syx`;
  and import an `output.txt` from the official editor so your existing patches aren't stranded.
- **FX signal-flow view** — each output's FX chain shown as MIDI → effects → jack, in processing
  order, instead of eight abstract "target" dropdowns.
- **A decoded MIDI activity monitor** — incoming notes/CC/clock shown live, so you can tell whether
  the module is even receiving.
- **Preset manager** — see all 8 slots, name them (names live in your browser), back all 8 up in one
  action, load and save.
- **Module reference** — decodes the panel's LEDs and the two front-panel buttons, both recovered
  from the firmware and otherwise undocumented.
- **The manual, built in** — the rewritten manual is bundled and searchable inside the editor; a "?"
  next to a mode jumps to its page.
- **Keyboard accessible, responsive, dark/light themes.**

## Safety

The transport can only ever emit the small set of SysEx opcodes on the config/preset critical path.
Every other opcode — factory reset, calibration, file transfer, the memory-safety-defect opcodes,
and everything undocumented — is unrepresentable in the code, and a unit test enforces that the
emittable set is exactly the allowlist. See [`SECURITY.md`](../SECURITY.md). The app has no
firmware-flashing path at all; the worst case is a preset you can rewrite, and even a corrupted
module is recoverable through the RP2040's mask-ROM bootloader.

## What's stubbed pending protocol confirmation

The protocol was recovered by reading the official editor and disassembling the firmware — strong
evidence, but not the same as testing a live module. Behind the `PortailDevice` interface, a
**simulator** stands in for hardware so the whole UI is exercisable today; the real Web MIDI
transport drops in behind the same interface. These specific things still need a physical module to
confirm (see [`../spec/open-questions.md`](../spec/open-questions.md)):

- **Preset numbering (OQ-1).** Recovered as recall-1-based / query-0-based. The **first preset save
  is gated** behind a one-time on-hardware numbering check that runs before any write — it will not
  save to a slot until your module confirms it lands where expected.
- **Gate mode-byte high bits (OQ-2).** Whether a gate round-trip preserves everything.
- **Hold-to-repeat timing of the front-panel buttons (OQ-3).** Marked unverified in the Module
  reference panel.
- **LED trigger colours and brightness curve (OQ-15).** Marked unverified in the same panel.

## What to test against your module

If you have a Portail, the highest-value thing you can do is run the tests in
[`../spec/open-questions.md`](../spec/open-questions.md) and record the results — especially the
preset-numbering check (OQ-1) and the gate mode byte (OQ-2). Confirming those removes the last
"unverified" markers from the editor.

## How it's built

Plain TypeScript + Vite, no UI framework. The feature model, every label and range, is generated from
`spec/model.json` at build time (`npm run sync-spec`) — the app refuses to build without it, so it
can never ship an invented value. See [`DESIGN.md`](DESIGN.md) for the full design and
[`AUDIT.md`](AUDIT.md) for what the official editor does and where it fails.

## Licence

MIT — see [`LICENSE`](LICENSE).
