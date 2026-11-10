// Profile for OJT and facilitator: assignment, contact number, password change (FR-PROF-01, FR-PROF-02, FR-AUTH-06).
// The mobile Log out button is here. It uses the logout flow of the page header (FR-AUTH-05).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonCheckbox, IonContent, IonIcon, IonInput, IonItem, IonLabel, IonList, IonNote, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth/auth.service';
import { homePath } from '../../core/auth/access';
import { WorkStore } from '../../data/store/work-store.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { FAC_STRINGS } from '../../shared/strings-fac';
import { UI_STRINGS } from '../../shared/strings-ui';
import { dateLabel } from '../../shared/utils/format';

const MIN_PASSWORD = 8;

addIcons({ logOutOutline });

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonButton, IonCheckbox, IonIcon, IonInput, IonItem, IonLabel, IonList, IonNote],
  template: `
    <app-page-header #header [title]="strings.pages.profile" [backHref]="home()" />
    <ion-content>
      <div class="ion-padding">
        <div class="who">
          <div class="avatar" role="img" [attr.aria-label]="text.photo">{{ text.photo }}</div>
          <div>
            <h2>{{ auth.profile()?.fullName }}</h2>
            <p>{{ roleText() }}</p>
          </div>
        </div>
        @if (isOjt()) {
          <h3>{{ text.assignment }}</h3>
          <ion-list lines="none">
            <ion-item><ion-label><p>{{ text.company }}</p><h3>{{ me().companyName }}</h3></ion-label></ion-item>
            <ion-item><ion-label><p>{{ text.facilitator }}</p><h3>{{ me().facilitatorName }}</h3></ion-label></ion-item>
            <ion-item><ion-label><p>{{ text.batch }}</p><h3>{{ me().batchName }}</h3></ion-label></ion-item>
            <ion-item><ion-label><p>{{ text.requiredHours }}</p><h3>{{ me().requiredHours }}</h3></ion-label></ion-item>
            <ion-item><ion-label><p>{{ text.startDate }}</p><h3>{{ date(me().startDate) }}</h3></ion-label></ion-item>
            @if (me().contactNumber) {
              <ion-item><ion-label><p>{{ text.contact }}</p><h3>{{ me().contactNumber }}</h3></ion-label></ion-item>
            }
          </ion-list>
        } @else {
          <p>{{ text.assignedOjts(store.assignedOjts().length) }}</p>
        }

        <h3>{{ text.password }}</h3>
        <ion-input [label]="text.current" labelPlacement="floating" fill="outline" [type]="type()" autocomplete="current-password"
          [value]="current()" (ionInput)="current.set($any($event).detail.value ?? '')" />
        <ion-input class="gap" [label]="text.next" labelPlacement="floating" fill="outline" [type]="type()" autocomplete="new-password"
          [value]="next()" (ionInput)="next.set($any($event).detail.value ?? '')" />
        <ion-input class="gap" [label]="text.confirmPassword" labelPlacement="floating" fill="outline" [type]="type()" autocomplete="new-password"
          [value]="confirm()" (ionInput)="confirm.set($any($event).detail.value ?? '')" />
        <ion-checkbox [checked]="show()" (ionChange)="show.set($any($event).detail.checked)">{{ text.show }}</ion-checkbox>
        @if (passwordProblem(); as problem) {
          <p><ion-note color="danger">{{ problem }}</ion-note></p>
        }
        @if (passwordFailure(); as failure) {
          <p><ion-note color="danger">{{ failure }}</ion-note></p>
        }
        <ion-button [disabled]="passwordProblem() !== null || busy()" (click)="changePassword()">{{ text.change }}</ion-button>

        <p><ion-note>{{ text.version }}</ion-note></p>

        <ion-button class="logout" expand="block" fill="outline" color="danger" [disabled]="header.busy()" (click)="header.logout()">
          <ion-icon slot="start" name="log-out-outline" aria-hidden="true" />
          {{ strings.logout }}
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: `
    .who {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      margin: var(--space-3) 0 28px;
      text-align: center;
    }
    .who h2 {
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.5;
      color: var(--ion-color-dark);
    }
    .who p {
      display: inline-block;
      margin: 7px 0 0;
      padding: var(--space-1) var(--space-3);
      border-radius: var(--space-1);
      background: var(--ion-color-secondary);
      color: var(--ion-color-secondary-contrast);
      font-size: 0.75rem;
      font-weight: 600;
    }
    .avatar {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ion-color-medium);
      width: 84px;
      height: 84px;
      overflow: hidden;
      border: 1px solid var(--ion-color-primary);
      border-radius: 50%;
      background: rgba(var(--ion-color-tertiary-rgb), 0.08);
    }
    h3 {
      margin: var(--space-5) 0 var(--space-3);
      font-size: 0.9375rem;
      color: var(--ion-color-primary);
    }
    ion-item {
      --padding-start: 0;
      --inner-padding-end: 0;
      --min-height: 48px;
      margin: 0;
      border-bottom: 1px solid var(--ion-color-light-shade);
    }
    ion-item ion-label {
      display: grid;
      grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.25fr);
      align-items: start;
      gap: var(--space-3);
      margin: var(--space-3) 0;
    }
    ion-item p {
      margin: 0;
      font-size: 0.75rem;
      line-height: 1.6;
      color: var(--ion-color-medium-shade);
    }
    ion-item h3 {
      margin: 0;
      font-family: var(--ion-font-family);
      font-size: 0.875rem;
      line-height: 1.6;
      white-space: normal;
      overflow-wrap: anywhere;
      color: var(--ion-color-dark);
    }
    ion-checkbox {
      margin-top: var(--space-3);
    }
    ion-button {
      margin-top: var(--space-3);
    }
    .gap {
      margin-top: var(--space-2);
    }
    .logout {
      margin: var(--space-5) 0 var(--space-2);
    }
  `,
})
export class ProfilePage {
  protected readonly strings = STRINGS;
  protected readonly text = FAC_STRINGS.profile;
  protected readonly ui = UI_STRINGS;
  protected readonly date = dateLabel;
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(WorkStore);
  private readonly toasts = inject(ToastController);

  protected readonly me = this.store.me;
  protected readonly isOjt = computed(() => this.auth.role() === 'ojt');
  protected readonly home = computed(() => (this.auth.role() ? homePath(this.auth.role()!) : '/'));
  protected readonly roleText = computed(() => {
    const role = this.auth.role();
    return role ? this.text.role[role] : '';
  });

  protected readonly current = signal('');
  protected readonly next = signal('');
  protected readonly confirm = signal('');
  protected readonly show = signal(false);
  protected readonly type = computed(() => (this.show() ? 'text' : 'password'));
  protected readonly busy = signal(false);
  protected readonly passwordFailure = signal<string | null>(null);

  /** The first problem of the password form, or null when the form is valid. */
  protected readonly passwordProblem = computed(() => {
    const t = this.text;
    if (!this.current()) {
      return t.currentRequired;
    }
    if (this.next().length < MIN_PASSWORD) {
      return t.tooShort;
    }
    if (this.next() === this.current()) {
      return t.same;
    }
    return this.next() === this.confirm() ? null : t.mismatch;
  });

  protected async changePassword(): Promise<void> {
    this.busy.set(true);
    this.passwordFailure.set(null);
    try {
      const result = await this.auth.changePassword(this.current(), this.next());
      if (result.ok) {
        this.current.set('');
        this.next.set('');
        this.confirm.set('');
        await this.toast(this.text.changed, 'success');
      } else {
        this.passwordFailure.set(this.text.failure[result.reason]);
      }
    } catch {
      this.passwordFailure.set(this.text.failure.unknown);
    } finally {
      this.busy.set(false);
    }
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 2500, color });
    await toast.present();
  }
}
