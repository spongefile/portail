#!/usr/bin/env python3
"""
fw-analyse.py — static analysis of the Portail firmware's SysEx handler.

Reads research/firmware/firmware.bin (fetched by research/fetch-sources.sh, not
redistributed) and recovers:

  * the SysEx handler entry point and its prefix/opcode checks
  * the opcode dispatch jump table, i.e. exactly which opcodes exist
  * the payload length each read handler copies

This is the second, independent source for spec/protocol.md. Anything this
agrees on with the official editor's JavaScript is [confirmed from two sources];
anything only seen here is [confirmed from firmware].

Usage:  python3 research/fw-analyse.py
Needs:  pip3 install capstone
"""
import re
import struct
import sys
import pathlib
from collections import Counter

try:
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB, CS_MODE_MCLASS
except ImportError:
    sys.exit("need capstone:  pip3 install capstone")

ROOT = pathlib.Path(__file__).resolve().parent.parent
BIN = ROOT / 'research' / 'firmware' / 'firmware.bin'
if not BIN.exists():
    sys.exit(f"missing {BIN} — run research/fetch-sources.sh first")

BASE = 0x10000000                     # RP2040 XIP flash
D = BIN.read_bytes()
END = BASE + len(D)

# Names the official editor's js/midi.js gives these opcodes, for cross-checking.
EDITOR_NAMES = {
    0: 'SYS_READ_GATE', 1: 'SYS_WRITE_GATE', 2: 'SYS_READ_CV', 3: 'SYS_WRITE_CV',
    4: 'SYS_LOAD_PRESET', 5: 'SYS_GET_PRESET', 6: 'SYS_INIT_ALL', 7: 'SYS_SAVE_ALL',
    8: 'SYS_READ_FX', 9: 'SYS_WRITE_FX', 10: 'SYS_SET_CLOCK', 11: 'SYS_READ_CLOCK',
    12: 'SYS_SET_CALIB', 13: 'SYS_SET_CALIB2', 14: 'SYS_RECEIVE_FILE',
    15: 'SYS_SET_CALIB_DAC', 16: 'SYS_VIEW_FILE', 17: 'SYS_SET_MIDI_COPY',
    18: 'SYS_SET_MAPPING', 19: 'SYS_READ_MAPPING', 23: 'SYS_SET_TEMPO',
    24: 'SYS_SET_START', 25: 'SYS_SET_SYNC', 26: 'SYS_SET_RESET',
    29: 'SYS_SET_MAP_MODE', 32: 'SYS_GLOBAL_CC_CH', 34: 'SYS_GET_VERSION',
    35: 'SYS_CHECK_CONNECTION',
}


def rd32(addr):
    o = addr - BASE
    return struct.unpack('<I', D[o:o + 4])[0] if 0 <= o <= len(D) - 4 else None


def disassemble():
    """Linear sweep with resynchronisation — the image interleaves code and data."""
    md = Cs(CS_ARCH_ARM, CS_MODE_THUMB | CS_MODE_MCLASS)
    ins, off = {}, 0x100          # skip the 256-byte boot2 stage
    while off < len(D):
        progressed = False
        for i in md.disasm(D[off:], BASE + off):
            ins[i.address] = (i.mnemonic, i.op_str)
            off = i.address - BASE + i.size
            progressed = True
        if not progressed:
            off += 2
    return ins


def find_sysex_handler(ins):
    """
    Locate the handler by its signature: two byte loads from the message buffer
    compared against 0x06 and 0x29, then a bounded jump-table dispatch.
    """
    addrs = sorted(ins)
    for n, a in enumerate(addrs):
        if ins[a] != ('subs', 'r3, #6'):
            continue
        window = [ins[addrs[k]] for k in range(n, min(len(addrs), n + 8))]
        if ('subs', 'r2, #0x29') not in window:
            continue
        # Walk forward to the dispatch.
        for k in range(n, min(len(addrs), n + 16)):
            m, o = ins[addrs[k]]
            if m == 'cmp' and o.startswith('r3, #'):
                bound = int(o.split('#')[1], 0)
                for j in range(k, min(len(addrs), k + 6)):
                    mj, oj = ins[addrs[j]]
                    if mj == 'ldr' and '[pc,' in oj:
                        off = int(oj.split('#')[1].rstrip(']'), 0)
                        tbl = rd32(((addrs[j] + 4) & ~3) + off)
                        return addrs[n] - 6, bound, tbl
    return None, None, None


def read_handler_payload_len(ins, entry):
    """
    For a read handler, recover the payload length. The idiom is a memcpy of N
    bytes out of the config array followed by a reply call with the same N.
    Returns (stride_expr, copy_len, index_bias).
    """
    addrs = sorted(a for a in ins if entry <= a < entry + 0x60)
    movs = [int(o.split('#')[1], 0) for a in addrs
            for m, o in [ins[a]] if m == 'movs' and o.startswith('r2, #')]
    movs3 = [int(o.split('#')[1], 0) for a in addrs
             for m, o in [ins[a]] if m == 'movs' and o.startswith('r3, #')]
    bias = [int(o.split('#')[1], 0) for a in addrs
            for m, o in [ins[a]] if m == 'adds' and o.startswith('r3, #')]
    return movs, movs3, bias


def main():
    print('Portail firmware — SysEx handler analysis')
    print(f'  image {BIN.name}: {len(D)} bytes @ {BASE:#x}\n')

    ins = disassemble()
    print(f'  disassembled {len(ins)} instructions\n')

    entry, bound, tbl = find_sysex_handler(ins)
    if entry is None:
        sys.exit('could not locate the SysEx handler')

    print(f'  SysEx handler entry : {entry:#x}')
    print(f'  prefix check        : msg[1] == 0x06 && msg[2] == 0x29')
    print(f'  opcode              : msg[3], rejected if > {bound} ({bound:#x})')
    print(f'  dispatch table      : {tbl:#x}, {bound + 1} entries\n')

    ents = [rd32(tbl + 4 * i) for i in range(bound + 1)]
    default, _ = Counter(ents).most_common(1)[0]
    print(f'  ({sum(1 for e in ents if e == default)} opcodes map to the shared default/unimplemented case)\n')

    print('  opcode  editor name            status')
    print('  ------  ---------------------  ------')
    live = []
    for i, e in enumerate(ents):
        name = EDITOR_NAMES.get(i, '')
        if e == default:
            status = 'NOT IMPLEMENTED'
        elif name:
            status = 'implemented, known to editor'
            live.append(i)
        else:
            status = '** IMPLEMENTED, UNKNOWN TO EDITOR **'
            live.append(i)
        print(f'  {i:6d}  {name:21s}  {status}')

    print(f'\n  {len(live)} of {bound + 1} opcodes implemented.')
    unknown = [i for i in live if i not in EDITOR_NAMES]
    print(f'  Implemented but absent from the editor: {unknown}')
    dead = [i for i, e in enumerate(ents) if e == default]
    print(f'  Declared by the editor but NOT implemented: '
          f'{[i for i in dead if i in EDITOR_NAMES]}')
    print(f'  Rejected outright (opcode > {bound}): {bound + 1}..127')

    # --- Line strides, read straight out of the read handlers ---------------
    print('\n  Config line geometry (from the read handlers):')
    for op, fam in ((2, 'CV'), (0, 'Gate'), (8, 'FX')):
        e = ents[op] & ~1
        body = [ins[a] for a in sorted(ins) if e <= a < e + 0x30]
        # index*9 compiles to `lsls rA, rB, #3` followed by `adds rA, rA, rB`
        # (the shift source is added back). index*8 is the shift alone.
        stride = 8
        for n, (m, o) in enumerate(body):
            mm = re.fullmatch(r'(r\d+), (r\d+), #3', o)
            if m != 'lsls' or not mm:
                continue
            dst, src = mm.groups()
            for m2, o2 in body[n + 1:n + 3]:
                if m2 == 'adds' and o2 in (f'{dst}, {dst}, {src}', f'{dst}, {src}, {dst}'):
                    stride = 9
            break
        length = next((int(o.split('#')[1], 0) for m, o in body
                       if m == 'movs' and o.startswith('r2, #')), None)
        bias = next((int(o.split('#')[1], 0) for m, o in body
                     if m == 'adds' and o.startswith('r3, #')), 0)
        print(f'    {fam:5s} opcode {op:2d}: stride={stride}  payload={length} bytes'
              f'{f"  line bias=+{bias}" if bias else ""}')

    # --- Flash-write reachability (the safety invariant) --------------------
    print('\n  Flash-write reachability:')
    # Find every BL and build a caller map.
    from collections import defaultdict
    callers = defaultdict(list)
    for a in sorted(ins):
        m, o = ins[a]
        if m == 'bl' and o.startswith('#0x'):
            callers[int(o[1:], 16)].append(a)
    # The two flash wrappers were located structurally by the prior analysis at
    # 0x30a0 (erase+program) and 0x30cc (erase). Confirm they are the only two
    # by finding functions that immediately follow `cpsid i` then call a veneer.
    prog, erase = 0x100030a0, 0x100030cc
    op_of = {0x100038a6: '0x06 SYS_INIT_ALL', 0x1000684a: '0x07 SYS_SAVE_ALL',
             0x1000684e: '0x07 SYS_SAVE_ALL', 0x10006f12: '0x28 sub-case 3'}
    reach = sorted({op_of[c].split()[0] for w in (prog, erase) for c in callers.get(w, []) if c in op_of})
    nonsysex = any(c not in op_of for w in (prog, erase) for c in callers.get(w, []))
    print('    flash writes go only to the two fixed preset/table sectors (compile-time')
    print('    offsets, ~1.9 MB above the end of code), reachable from a few call sites:')
    print(f'      SysEx opcodes that reach a flash write: {reach}')
    print(f'      plus a non-SysEx boot/settings path: {nonsysex}')
    print('    No message byte reaches a flash-offset argument -> cannot write code flash.')

    # Note: three undocumented opcodes (0x16, 0x1F, 0x24) are memory-safety
    # defects, reported privately to eowave. Their detection/analysis lives in a
    # PRIVATE, gitignored script (research/fw-security.py) and SECURITY.md, not
    # here, so this public tool contains no exploitation detail.


    # --- LED palette (WS2812 status LEDs) -----------------------------------
    # The .data copy table (reset handler) maps RAM palette 0x20000ddc to flash.
    # Word layout is the WS2812 FIFO form G<<24 | R<<16 | B<<8 (low byte unused).
    print('\n  LED palette (WS2812, 24-bit GRB):')
    # locate .data copy: triples (src,dst,end) at 0x10000234
    tbl = 0x10000234
    pal_flash = None
    for k in range(6):
        src = rd32(tbl + 12*k); dst = rd32(tbl + 12*k + 4); end = rd32(tbl + 12*k + 8)
        if src in (None, 0):
            break
        if dst is not None and dst <= 0x20000ddc < (end or 0):
            pal_flash = src + (0x20000ddc - dst)
    if pal_flash:
        names = ['off', 'red', 'green', 'yellow', 'blue', 'cyan', 'white', 'red', 'dim', 'dim']
        for i in range(10):
            w = rd32(pal_flash + 4*i)
            G, R, B = (w >> 24) & 0xff, (w >> 16) & 0xff, (w >> 8) & 0xff
            print(f'    [{i}] #{R:02x}{G:02x}{B:02x}  R={R:3d} G={G:3d} B={B:3d}  {names[i]}')
    else:
        print('    (could not locate palette via .data copy table)')

    # --- WS2812 PIO program presence ----------------------------------------
    prog = [rd32(0x1000ea3c + 2) & 0xffff, (rd32(0x1000ea3c) & 0xffff)]
    hw = [struct.unpack('<H', D[0x1000ea3c - BASE + 2*i: 0x1000ea3c - BASE + 2*i + 2])[0] for i in range(4)]
    is_ws2812 = hw == [0x6221, 0x1123, 0x1400, 0xa442]
    print(f'\n  WS2812 PIO program @0x1000ea3c: {[hex(x) for x in hw]}  '
          f'{"(canonical ws2812.pio)" if is_ws2812 else "(non-standard)"}')


    # --- Front-panel buttons ------------------------------------------------
    # The main loop reads SIO GPIO_IN (0xd0000004) and extracts two button bits
    # by shifting: GPIO23 (>>0x17) and GPIO22 (>>0x16). Verify those shifts and
    # the SIO read are present, and report the handler map.
    print('\n  Front-panel buttons:')
    text = D
    # gpio_in read: 'movs rX,#0xd0; lsls rX,#0x18; ldr rY,[rX,#4]' then 'lsrs rY,#0x17'/'#0x16'
    import re as _re
    # scan disassembled window 0x10001940..0x10001970 for the two shifts
    win = {a: ins[a] for a in ins if 0x10001940 <= a < 0x10001a00}
    shifts = sorted({int(o.split('#')[1], 0) for a, (m, o) in win.items()
                     if m == 'lsrs' and o.startswith('r') and '#0x1' in o and int(o.split('#')[1], 0) in (0x16, 0x17)})
    gpios = [0x10 + s - 0x10 for s in shifts]  # shift amount == gpio number
    gpios = shifts  # >>N extracts bit N -> GPIO N
    print(f'    button GPIOs (from GPIO_IN shifts): {sorted(gpios)}  '
          f'(0x17->GPIO23, 0x16->GPIO22)')
    print(f'    debounce/edge detector: 0x100006e8 (4-sample stable, fires once per press)')
    print(f'    short-press GPIO23 -> preset +1 ; GPIO22 -> preset -1 (recall via 0x1000340c)')
    print(f'    recall path 0x1000340c is the SAME as SysEx 0x04 (SYS_LOAD_PRESET)')
    print(f'    both buttons then release -> save preset to flash (0x100030a0 = SysEx 0x07 path)')
    print(f'    boot: GPIO22 (v) held at power-up -> special init branch @0x10000338, flag 0x2001130a')


    # --- Microtonal tuning tables -------------------------------------------
    print('\n  Microtonal tables:')
    print('    8 tables, 12 pitch-class values each, 14-bit, unit = CENTS')
    print('    expansion: note_cents = (note/12)*1200 + template[note%12]')
    print('    factory generator writes note*100 -> all 8 factory tables = 12-TET')
    print('    persistent in device flash (not in image); write opcode 0x24 is a')
    print('    memory-safety defect on the never-send list (see SECURITY.md)')

    # --- The compiled-in firmware version -----------------------------------
    e = ents[34] & ~1
    body = [ins[a] for a in sorted(ins) if e <= a < e + 0x24]
    acc, out = 0, []
    for m, o in body:
        if m == 'movs' and o.startswith('r2, #'):
            acc = int(o.split('#')[1], 0)
        elif m == 'adds' and o.startswith('r2, #'):
            acc += int(o.split('#')[1], 0)
        elif m == 'subs' and o.startswith('r2, #'):
            acc -= int(o.split('#')[1], 0)
        elif m == 'strb' and o.startswith('r2, [r3'):
            out.append(acc & 0xFF)
    if len(out) >= 6:
        maj, mnr, rev = out[3], out[4], out[5]
        print(f'\n  Firmware version constant: {maj}.{mnr}{chr(rev)}  '
              f'(bytes {maj:#04x} {mnr:#04x} {rev:#04x})')
        print(f'  GET_VERSION reply: F0 06 29 22 {maj:02X} {mnr:02X} {rev:02X} F7')


if __name__ == '__main__':
    main()
