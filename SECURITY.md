# Security

This is an unofficial, community project. It talks to the eowave Portail over MIDI
SysEx based on reverse-engineering.

## Coordinated disclosure

During reverse-engineering, this project identified a small number of memory-safety
defects in the Portail's **firmware** (not in this software). In line with
responsible disclosure, they were **reported privately to eowave on 2026-08-26,
before this repository was made public.**

The full technical analysis — addresses, mechanism, and reproduction steps — is
**deliberately withheld from this public repository** until eowave has had the
opportunity to address them. It is held privately by the maintainer and will be
shared with eowave on request.

What is stated publicly here is only what this software needs in order to be safe:
which SysEx opcodes it must never send. The editor cannot emit those opcodes by
construction, and a unit test enforces it. None of the defects can brick the module
or write its firmware, and exploiting any of them requires the ability to send SysEx
to the module in the first place (physical/USB access or a malicious file); there is
no network exposure.

## For eowave

If you're from eowave: thank you for making the Portail — the hardware is the reason
this project exists. We'd love to help. The complete write-up of every issue, with
addresses and repro, is yours whenever you want it. The quickest way to reach the
maintainer is via **[spongefile.com](https://www.spongefile.com)**. We're happy to
hold off on any public detail for as long as is useful to you.

## Reporting a new issue

Please contact the maintainer at **[spongefile.com](https://www.spongefile.com)**
rather than opening a public issue for anything security-sensitive.
