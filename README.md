# Portail Reboot

> **Unofficial. Use at your own risk.** This is an AI-generated project, not made by,
> affiliated with, or endorsed by eowave. It talks to your hardware over MIDI SysEx
> based on reverse-engineering, not official documentation. It is provided "as is",
> with no warranty of any kind; you are responsible for anything that happens to your
> module or your patches. It does **not** and cannot flash firmware — firmware updates
> remain eowave's official editor's job. "eowave" and "Portail" are the trademarks of
> their owner and are used here only to describe compatibility.

Unofficial, AI-generated rewrite of the two weakest parts of the eowave Portail experience:

1. **`app/`** — a better web editor (replacement for https://www.eowave.app/portail/)
2. **`docs/`** — a rewritten, actually-clear manual

Shared ground truth lives in **`spec/`** — the SysEx/config protocol and the module's
feature model. Both the app and the manual are generated against that spec, so they
cannot drift apart.

`research/` holds raw captures: the original editor's JS bundle, the official manual,
SysEx dumps from the hardware.

Hardware: eowave Portail, 5HP, 8x 16-bit CV + 8x 12-bit gate, USB-C + TRS MIDI, 8 presets.

---

By **spongefile** · [www.spongefile.com](https://www.spongefile.com)
Security policy: [SECURITY.md](SECURITY.md)

## Scope

**MVP (in progress):** feature parity with the official editor, plus honest connection
state, offline editing with explicit sync, undo, all-16-outputs overview, portable JSON
configs, live MIDI monitor, preset backup.

**Deliberately out of scope:** firmware flashing. Config/preset only — a config-protocol
mistake is recoverable, a firmware-protocol mistake is a brick. Use eowave's official
editor for firmware.

**Deferred, revisit once the MVP is solid:**
- Patch librarian — named configs, tags, diffing between configs, shareable files
- Live-tweak mode — parameter changes audible immediately with the module attached,
  editor as performance surface

Unofficial. Not affiliated with or endorsed by eowave.
