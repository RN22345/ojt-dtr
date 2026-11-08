import { TestBed } from '@angular/core/testing';
import { NETWORK } from '../../plugins/network.plugin';
import { AdminOnline } from './admin-online.service';

describe('admin online state (D-13, TC-ST-ADM-02)', () => {
  let listener: (online: boolean) => void;
  const remove = vi.fn();

  function setup(initial: boolean): AdminOnline {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NETWORK,
          useValue: {
            isOnline: async () => initial,
            onChange: async (l: (online: boolean) => void) => ((listener = l), remove),
          },
        },
      ],
    });
    return TestBed.inject(AdminOnline);
  }

  it('starts with the state of the device', async () => {
    const online = setup(false);
    await vi.waitFor(() => expect(online.online()).toBe(false));
  });

  it('follows the network changes and enables saves again when the network returns', async () => {
    const online = setup(true);
    await vi.waitFor(() => expect(listener).toBeDefined());
    listener(false);
    expect(online.online()).toBe(false);
    listener(true);
    expect(online.online()).toBe(true);
  });

  it('removes the listener when the injector is destroyed', async () => {
    setup(true);
    await vi.waitFor(() => expect(listener).toBeDefined());
    TestBed.resetTestingModule();
    expect(remove).toHaveBeenCalled();
  });
});
