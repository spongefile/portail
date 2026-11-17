import { describe, it, expect } from 'vitest';
import { SimulatorDevice } from '../src/device/simulator';
import { parseScl } from '../src/model/scl';

describe('tuning send path (device)', () => {
  it('writeMicrotonalTable stores the sanitized table on the simulator', async () => {
    const dev = new SimulatorDevice({ latency: 0 });
    await dev.start();
    const scl = `! q\nQuarter-comma-ish\n 12\n 76.0\n 193.2\n 310.3\n 386.3\n 503.4\n 579.5\n 696.6\n 772.6\n 889.7\n 1006.8\n 1082.9\n 1200.0\n`;
    const { cents } = parseScl(scl);
    await dev.writeMicrotonalTable(5, cents);
    const stored = (dev as any).getTable(5) as number[];
    expect(stored.length).toBe(12);
    expect(stored[0]).toBe(0);
    expect(stored[3]).toBe(Math.round(cents[3]!)); // 386 (just major third)
  });
  it('rejects an out-of-range slot at the device boundary', async () => {
    const dev = new SimulatorDevice({ latency: 0 });
    await dev.start();
    await expect(dev.writeMicrotonalTable(8, new Array(12).fill(0))).rejects.toThrow(/0-7/);
  });
});
