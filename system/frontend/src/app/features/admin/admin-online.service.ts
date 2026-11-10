// Online state of the admin web app (D-13, TC-ST-ADM-02). Admin pages save only when `online()` is true.
// When the app is offline, a page shows a message and disables its save buttons. It keeps the form values.
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { NETWORK } from '../../plugins/network.plugin';

@Injectable({ providedIn: 'root' })
export class AdminOnline {
  private readonly network = inject(NETWORK);
  private readonly state = signal(true);
  /** False when the device has no network connection. */
  readonly online = this.state.asReadonly();

  constructor() {
    let stop: (() => void) | undefined;
    let destroyed = false;
    this.network
      .isOnline()
      .then((now) => this.state.set(now))
      .catch(() => undefined);
    this.network
      .onChange((now) => this.state.set(now))
      .then((remove) => (destroyed ? remove() : (stop = remove)))
      .catch(() => undefined);
    inject(DestroyRef).onDestroy(() => {
      destroyed = true;
      stop?.();
    });
  }
}
