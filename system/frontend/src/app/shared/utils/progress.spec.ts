import { ProgressPunch, dailyMinutesSplit, progressTotals } from './progress';

describe('TC-U-MON-01 progress calculation (FR-MON-01, A-06)', () => {
  // Times are UTC (+08:00 in Manila). Week 1 is approved; week 2 is not.
  const punches: ProgressPunch[] = [
    { id: 'a', type: 'in', time: '2026-10-19T00:00:00Z', approved: true }, // Mon 08:00
    { id: 'b', type: 'out', time: '2026-10-19T09:00:00Z', approved: true }, // 17:00, 9 h
    { id: 'c', type: 'in', time: '2026-10-20T00:00:00Z', approved: true },
    { id: 'd', type: 'out', time: '2026-10-20T08:30:00Z', approved: true }, // 8.5 h
    { id: 'e', type: 'in', time: '2026-10-26T00:00:00Z', approved: false },
    { id: 'f', type: 'out', time: '2026-10-26T08:00:00Z', approved: false }, // 8 h, not approved
    { id: 'g', type: 'in', time: '2026-10-27T00:00:00Z', approved: false }, // open session: not counted
  ];

  it('TC-U-MON-01 logged minutes include all closed sessions, approved only approved ones', () => {
    const { daily, approvedDaily } = dailyMinutesSplit(punches);
    expect(daily).toEqual({ '2026-10-19': 540, '2026-10-20': 510, '2026-10-26': 480 });
    expect(approvedDaily).toEqual({ '2026-10-19': 540, '2026-10-20': 510 });
  });

  it('TC-U-MON-01 totals, remaining, and percent use approved hours only', () => {
    const { daily, approvedDaily } = dailyMinutesSplit(punches);
    const t = progressTotals(100, daily, approvedDaily);
    expect(t.requiredMinutes).toBe(6000);
    expect(t.loggedMinutes).toBe(1530);
    expect(t.approvedMinutes).toBe(1050);
    expect(t.remainingMinutes).toBe(4950);
    expect(t.percent).toBe(18); // 1050 / 6000 = 17.5 %
    expect(t.loggedPercent).toBe(26); // 1530 / 6000 = 25.5 %
  });

  it('TC-U-MON-01 a corrected punch does not count twice', () => {
    const withCorrection: ProgressPunch[] = [
      ...punches.slice(0, 2),
      { id: 'b2', type: 'out', time: '2026-10-19T08:00:00Z', correctsPunchId: 'b', approved: true }, // 8 h
    ];
    const { daily, approvedDaily } = dailyMinutesSplit(withCorrection);
    expect(daily['2026-10-19']).toBe(480);
    expect(approvedDaily['2026-10-19']).toBe(480);
  });

  it('TC-U-MON-01 the percent stops at 100 and remaining at 0', () => {
    const t = progressTotals(10, { d: 900 }, { d: 900 });
    expect(t.percent).toBe(100);
    expect(t.remainingMinutes).toBe(0);
  });

  it('TC-U-MON-01 no required hours gives 0 percent', () => {
    const t = progressTotals(0, { d: 60 }, { d: 60 });
    expect(t.percent).toBe(0);
    expect(t.loggedPercent).toBe(0);
    expect(t.remainingMinutes).toBe(0);
  });
});
