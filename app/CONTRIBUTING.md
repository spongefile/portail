# Contributing

This is an unofficial, community-built editor for the eowave Portail. It is not affiliated with
or endorsed by eowave, and eowave provides no support for it.

## Ground rules

**Never ship a guessed value.** Every parameter range, default and enumeration in this editor comes
from `spec/model.json`, which is mechanically extracted from the official editor's source. If you
learn something new from real hardware, change the spec — not the app. Anything we have inferred
rather than confirmed must be visibly marked as unverified in the UI. A wrong number that looks
authoritative is worse than a missing one.

**No firmware flashing.** This tool reads and writes configurations and presets only. A mistake in
the config protocol is recoverable by rewriting a config; a mistake in a firmware protocol bricks
someone's module. Firmware updates stay with the official editor.

**Nothing is written to the module as a side effect of editing.** Sending is always an explicit,
separate action. If you add a feature that touches hardware, it needs its own deliberate control.

## Getting set up

```
cd app
npm install
npm run dev
```

The editor opens with a built-in simulator, so you can develop the whole UI without a Portail
attached. `npm test` runs the codec unit tests.

## Where things live

| Path | What it is |
|------|-----------|
| `spec/model.json` | Canonical feature model. Owned by the spec, not the app. |
| `app/scripts/build-model.mjs` | Adapts the spec into `src/model/model.json`. Run via `npm run sync-spec`. |
| `app/src/device/sysex.ts` | Wire encode/decode. Changes here need tests. |
| `app/src/device/simulator.ts` | Simulated firmware used for development. |
| `app/src/device/webmidi.ts` | The real transport. |
| `app/AUDIT.md` | What the official editor does and where it fails. |

## Testing against hardware

The protocol was recovered by reading the official editor, not from documentation. `app/README.md`
lists the specific unknowns that still need confirming against a real module. If you have a Portail
and can check any of them, that is the single most valuable contribution you can make — please open
an issue with what you observed, including the raw SysEx bytes.

## Pull requests

- Run `npm run build` and `npm test` before opening a PR.
- Keep the editor working with no hardware attached and in browsers without Web MIDI.
- Don't add runtime dependencies without a good reason; this is deliberately a static, dependency-light site.
