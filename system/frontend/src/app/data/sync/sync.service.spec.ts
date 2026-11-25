import { TestBed } from '@angular/core/testing';
import { PlatformService } from '../../core/platform.service';
import { LocalDb } from '../local-db/local-db';
import { LOCAL_DB_OPENER } from '../local-db/local-db.service';
import { SqlJsDb } from '../local-db/sqljs.db';
import { APP_LIFECYCLE } from '../../plugins/app-lifecycle.plugin';
import { NETWORK } from '../../plugins/network.plugin';
import { RETRY_DELAYS_MS, retryDelayMs } from '../../shared/utils/retry';
import { SyncOutcome } from './sync-engine';
import { STALE_UNSYNCED_MS, SYNC_ENGINE_FACTORY, SyncRunner, SyncService } from './sync.service';
import { enqueue, removeOps } from './outbox';
import { STRINGS } from '../../shared/strings';
import { FILE_UPLOADER } from './file-upload';
import { SYNC_TRANSPORT } from './sync-transport';

const FAIL: SyncOutcome = { ok: false, pushed: 0, pulled: 0, issues: 0, error: 'unreachable' };
const OK: SyncOutcome = { ok: true, pushed: 0, pulled: 0, issues: 0 };

describe('sync triggers and retry (offline sync design, section 6)', () => {
  let db: SqlJsDb;
  let runner: SyncRunner & { calls: number[]; outcome: SyncOutcome };
  let networkListener: (online: boolean) => void;
  let resumeListener: () => void;

  beforeEach(async () => {
    db = await SqlJsDb.create();
    vi.useFakeTimers();
    runner = {
      calls: [],
      outcome: FAIL,
      lastOutcome: null,
      async requestSync() {
        this.calls.push(Date.now());
        (this as { lastOutcome: SyncOutcome | null }).lastOutcome = this.outcome;
      },
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PlatformService, useValue: { platform: 'mobile' } },
        { provide: LOCAL_DB_OPENER, useValue: () => Promise.resolve(db as LocalDb) },
        { provide: SYNC_TRANSPORT, useValue: {} },
        { provide: FILE_UPLOADER, useValue: {} },
        { provide: SYNC_ENGINE_FACTORY, useValue: () => runner },
        {
          provide: NETWORK,
          useValue: {
            isOnline: async () => true,
            onChange: async (l: (online: boolean) => void) => ((networkListener = l), () => undefined),
          },
        },
        { provide: APP_LIFECYCLE, useValue: { onResume: async (l: () => void) => ((resumeListener = l), () => undefined) } },
      ],
    });
  });
  afterEach(async () => {
    TestBed.inject(SyncService).stop();
    vi.useRealTimers();
    await db.close();
  });

  /** The times of the sync calls, in ms after the start. */
  const callTimes = (start: number) => runner.calls.map((t) => t - start);

  it('TC-U-SYNC-03: the retry delays are 5 s, 15 s, 60 s, then 300 s', () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelayMs)).toEqual([5_000, 15_000, 60_000, 300_000, 300_000, 300_000]);
    expect(RETRY_DELAYS_MS).toEqual([5_000, 15_000, 60_000, 300_000]);
  });

  it('TC-U-SYNC-03: after failed syncs, the service tries again after 5 s, 15 s, and 60 s', async () => {
    const service = TestBed.inject(SyncService);
    const start = Date.now();
    await service.start('u1');
    await vi.advanceTimersByTimeAsync(80_000);
    expect(callTimes(start)).toEqual([0, 5_000, 20_000, 80_000]);
    expect(service.connection()).toBe('unreachable');
  });

  it('TC-U-SYNC-03: a network-online event resets the delay and starts a sync', async () => {
    const service = TestBed.inject(SyncService);
    const start = Date.now();
    await service.start('u1');
    await vi.advanceTimersByTimeAsync(25_000); // syncs at 0, 5 s, 20 s. The next retry waits 60 s.
    networkListener(false);
    expect(service.connection()).toBe('offline');
    networkListener(true);
    // D-80 (DEF-020): after an online event, a failed sync tries again after 2 s, three times.
    // Then the normal delays start again at 5 s.
    await vi.advanceTimersByTimeAsync(12_000);
    expect(callTimes(start)).toEqual([0, 5_000, 20_000, 25_000, 27_000, 29_000, 31_000, 36_000]);
  });

  it('TC-U-SYNC-03: the 2 s tries after an online event stop at the first good sync (D-80)', async () => {
    const service = TestBed.inject(SyncService);
    const start = Date.now();
    await service.start('u1');
    await vi.advanceTimersByTimeAsync(1_000);
    networkListener(false);
    networkListener(true); // sync at 1 s fails
    await vi.advanceTimersByTimeAsync(1_000);
    runner.outcome = OK;
    await vi.advanceTimersByTimeAsync(10_000); // sync at 3 s is good; no more tries
    expect(callTimes(start)).toEqual([0, 1_000, 3_000]);
    expect(service.connection()).toBe('online');
  });

  it('TC-U-SYNC-03: a repeated online event with no change does not start a sync or reset the delay (DEF-011)', async () => {
    const service = TestBed.inject(SyncService);
    const start = Date.now();
    await service.start('u1');
    await vi.advanceTimersByTimeAsync(25_000); // syncs at 0, 5 s, 20 s. The next retry waits 60 s.
    // The Android plugin sends "connected" again every few seconds with no change.
    for (let i = 0; i < 10; i++) {
      networkListener(true);
      await vi.advanceTimersByTimeAsync(3_000);
    }
    await vi.advanceTimersByTimeAsync(25_000);
    expect(callTimes(start)).toEqual([0, 5_000, 20_000, 80_000]);
    expect(service.connection()).toBe('unreachable');
  });

  it('TC-ST-OJT-01 (unit part): a sync that fails after the network went away keeps "No network" (DEF-015)', async () => {
    const service = TestBed.inject(SyncService);
    let release: () => void = () => undefined;
    runner.requestSync = function () {
      this.calls.push(Date.now());
      (this as { lastOutcome: SyncOutcome | null }).lastOutcome = FAIL;
      return new Promise<void>((r) => (release = r));
    };
    await service.start('u1');
    networkListener(false);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(service.connection()).toBe('offline');
  });

  it('TC-U-SYNC-03: no sync while offline, and the 5-minute timer and the app resume start a sync', async () => {
    runner.outcome = OK;
    const service = TestBed.inject(SyncService);
    const start = Date.now();
    await service.start('u1');
    await vi.advanceTimersByTimeAsync(300_000);
    expect(callTimes(start)).toEqual([0, 300_000]);
    resumeListener();
    await vi.advanceTimersByTimeAsync(0);
    expect(runner.calls).toHaveLength(3);
    networkListener(false);
    await service.trigger();
    expect(runner.calls).toHaveLength(3);
    expect(service.connection()).toBe('offline');
  });

  it('TC-U-SYNC-03: a session error stops the retry and sets sessionRejected', async () => {
    runner.outcome = { ...FAIL, error: 'session' };
    const service = TestBed.inject(SyncService);
    await service.start('u1');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(runner.calls).toHaveLength(1);
    expect(service.sessionRejected()).toBe(true);
  });

  describe('TC-ST-Q-SF-01 (unit part, QR-SF-04): warning for old unsynced changes', () => {
    const HOUR = 3_600_000;
    const addOp = () =>
      enqueue(db, { userId: 'u1', entity: 'punches', entityId: 'p1', opType: 'create', payload: {} });

    it('the limit is 72 hours, and the warning text exists', () => {
      expect(STALE_UNSYNCED_MS).toBe(72 * HOUR);
      expect(typeof STRINGS.sync.stale).toBe('string');
      expect(STRINGS.sync.stale.length).toBeGreaterThan(0);
    });

    it('no warning with an empty outbox', async () => {
      const service = TestBed.inject(SyncService);
      await service.start('u1');
      expect(service.staleUnsynced()).toBe(false);
    });

    it('an unsynced change of 72 hours or more shows the warning, also offline with no new event', async () => {
      const service = TestBed.inject(SyncService);
      await service.start('u1');
      networkListener(false);
      await addOp();
      service.changed();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.unsynced()).toBe(1);
      expect(service.staleUnsynced()).toBe(false);
      // Offline, a sync does not run. The 5-minute timer must still examine the age of the changes.
      await vi.advanceTimersByTimeAsync(72 * HOUR - 10 * 60_000);
      expect(service.staleUnsynced()).toBe(false);
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(service.staleUnsynced()).toBe(true);
    });

    it('a change that is old at the app start shows the warning at once', async () => {
      const service = TestBed.inject(SyncService);
      await service.start('u1');
      await addOp();
      service.stop();
      vi.setSystemTime(Date.now() + 73 * HOUR);
      await service.start('u1');
      expect(service.staleUnsynced()).toBe(true);
    });

    it('the warning goes away when the old change syncs', async () => {
      const service = TestBed.inject(SyncService);
      await service.start('u1');
      const opId = await addOp();
      service.stop();
      vi.setSystemTime(Date.now() + 73 * HOUR);
      await service.start('u1');
      expect(service.staleUnsynced()).toBe(true);
      await removeOps(db, [opId]);
      runner.outcome = OK;
      await service.trigger();
      expect(service.staleUnsynced()).toBe(false);
    });
  });
});
