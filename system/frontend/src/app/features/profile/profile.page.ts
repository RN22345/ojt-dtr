// Profile for OJT and facilitator: assignment, contact number, password change (FR-PROF-01, FR-PROF-02, FR-AUTH-06).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AlertController, IonButton, IonCheckbox, IonContent, IonIcon, IonInput, IonNote, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, personOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth/auth.service';
import { homePath } from '../../core/auth/access';
import { MockStore } from '../../data/mock/mock-store.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { FAC_STRINGS } from '../../shared/strings-fac';
import { UI_STRINGS } from '../../shared/strings-ui';
import { dateLabel } from '../../shared/utils/format';

const PH_MOBILE = /^(09|\+639)\d{9}$/;
const MIN_PASSWORD = 8;

addIcons({ logOutOutline, personOutline });

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonButton, IonCheckbox, IonIcon, IonInput, IonNote],
  template: `
    <app-page-header #header [title]="strings.pages.profile" [backHref]="home()" [compact]="true" />
    <ion-content>
      <div class="ion-padding">
        <div class="who">
          <span class="avatar" aria-hidden="true"><ion-icon name="person-outline" /></span>
          <div>
            <h2>{{ auth.profile()?.fullName }}</h2>
            <p>{{ roleText() }}</p>
          </div>
        </div>
        @if (isOjt()) {
          <dl class="facts" [attr.aria-label]="text.assignment">
            <div><dt>{{ text.email }}</dt><dd>{{ me().email }}</dd></div>
            <div><dt>{{ text.contact }}</dt><dd>{{ me().contactNumber }}</dd></div>
            <div><dt>{{ text.company }}</dt><dd>{{ me().companyName }}</dd></div>
            <div><dt>{{ text.facilitator }}</dt><dd>{{ me().facilitatorName }}</dd></div>
            <div><dt>{{ text.batch }}</dt><dd>{{ me().batchName }}</dd></div>
            <div><dt>{{ text.requiredHours }}</dt><dd>{{ ui.hours(me().requiredHours * 60) }}</dd></div>
            <div><dt>{{ text.startDate }}</dt><dd>{{ date(me().startDate) }}</dd></div>
          </dl>
          <details class="contact">
            <summary>{{ text.editContact }}</summary>
            <ion-input
              [label]="text.contact"
              labelPlacement="floating"
              fill="outline"
              type="tel"
              [value]="contact()"
              [helperText]="text.contactHint"
              [errorText]="text.contactInvalid"
              [class.ion-invalid]="!contactValid()"
              [class.ion-touched]="true"
              (ionInput)="contact.set($any($event).detail.value ?? '')"
            />
            <ion-button [disabled]="!contactValid() || !contactChanged()" (click)="saveContact()">{{ text.save }}</ion-button>
          </details>
        } @else {
          <p>{{ text.assignedOjts(store.assignedOjts().length) }}</p>
        }

        <details class="password">
          <summary>{{ text.password }}</summary>
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
        </details>

        <ion-button class="logout" expand="block" fill="outline" color="danger" [disabled]="header.busy()" (click)="header.logout()">
          <ion-icon slot="start" name="log-out-outline" aria-hidden="true" />
          {{ strings.logout }}
        </ion-button>
        <details class="data">
          <summary>{{ text.data }}</summary>
          <ion-button color="medium" fill="outline" (click)="reset()">{{ text.reset }}</ion-button>
          <p><ion-note>{{ text.version }}</ion-note></p>
        </details>
      </div>
      <ion-note class="ion-padding ion-text-center note">{{ ui.prototypeNote }}</ion-note>
    </ion-content>
  `,
  styles: `
    ion-content { --background: var(--lb-panel, var(--ion-background-color)); }
    .who {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
      margin: 8px 0 24px;
      text-align: center;
    }
    .who h2 {
      margin: 0;
      font-weight: 700;
      font-size: 1.5rem;
      line-height: 1.3;
      color: var(--ion-color-dark);
    }
    .who p {
      display: inline-block;
      margin: 6px 0 0;
      padding: 5px 16px;
      border-radius: 4px;
      background: var(--ion-color-secondary);
      color: var(--ion-color-dark);
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .avatar {
      position: relative;
      width: 68px;
      height: 68px;
      margin-block: 4px;
      border: 2px solid currentColor;
      border-radius: 50%;
      overflow: hidden;
      color: var(--ion-color-primary);
    }
    .avatar ion-icon {
      position: absolute;
      top: 7px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 60px;
      --ionicon-stroke-width: 14px;
      clip-path: inset(0 0 16%);
    }
    .facts {
      margin: 0;
      background: var(--lb-panel, var(--ion-background-color));
      border: 1px solid var(--lb-panel-border, var(--ion-color-light-shade));
      border-radius: 12px;
    }
    .facts div {
      display: grid;
      grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
      align-items: center;
      gap: 10px;
      min-height: 46px;
      padding: 10px 14px;
      font-size: 0.75rem;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .facts div + div { border-top: 1px solid var(--lb-panel-border, var(--ion-color-light-shade)); }
    dt {
      color: var(--ion-color-medium-shade);
    }
    dd {
      margin: 0;
      text-align: right;
      font-weight: 650;
      color: var(--ion-color-dark);
    }
    summary {
      padding: 12px 4px;
      color: var(--ion-color-primary);
      font-size: 0.8125rem;
      font-weight: 650;
      cursor: pointer;
    }
    .password summary {
      width: fit-content;
      margin: 0 auto;
      color: var(--ion-color-danger);
      font-size: 0.875rem;
    }
    details[open] summary { margin-bottom: 8px; }
    .data { margin-top: 6px; }
    ion-input {
      font-size: 0.875rem;
      --border-radius: 7px;
      --border-color: var(--ion-color-light-shade);
    }
    ion-checkbox {
      margin-top: 12px;
      --checkbox-background-checked: var(--ion-color-primary);
      --border-color-checked: var(--ion-color-primary);
      font-size: 0.8125rem;
      --size: 18px;
    }
    ion-button {
      margin-top: 12px;
      min-height: 44px;
      --box-shadow: none;
    }
    .gap {
      margin-top: 8px;
    }
    .logout {
      --border-width: 1px;
      --border-radius: 12px;
      min-height: 48px;
      margin: 32px 0 8px;
    }
    .logout::part(native) {
      background: var(--lb-danger-soft);
    }
    .note {
      display: block;
      font-size: 0.6875rem;
      line-height: 1.5;
    }
  `,
})
export class ProfilePage {
  protected readonly strings = STRINGS;
  protected readonly text = FAC_STRINGS.profile;
  protected readonly ui = UI_STRINGS;
  protected readonly date = dateLabel;
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(MockStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  protected readonly me = this.store.me;
  protected readonly isOjt = computed(() => this.auth.role() === 'ojt');
  protected readonly home = computed(() => (this.auth.role() ? homePath(this.auth.role()!) : '/'));
  protected readonly roleText = computed(() => {
    const role = this.auth.role();
    return role ? this.text.role[role] : '';
  });

  protected readonly contact = signal(this.store.me().contactNumber);
  private readonly cleanContact = computed(() => this.contact().replace(/\s/g, ''));
  protected readonly contactValid = computed(() => PH_MOBILE.test(this.cleanContact()));
  protected readonly contactChanged = computed(() => this.cleanContact() !== this.store.me().contactNumber);

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

  protected async saveContact(): Promise<void> {
    this.store.updateContact(this.cleanContact());
    await this.toast(this.text.contactSaved, 'success');
  }

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

  protected async reset(): Promise<void> {
    const alert = await this.alerts.create({
      header: this.text.resetHeader,
      message: this.text.resetMessage,
      buttons: [
        { text: FAC_STRINGS.common.cancel, role: 'cancel' },
        { text: FAC_STRINGS.common.confirm, role: 'confirm' },
      ],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'confirm') {
      return;
    }
    this.store.reset();
    this.contact.set(this.store.me().contactNumber);
    await this.toast(this.text.resetDone, 'success');
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 2500, color });
    await toast.present();
  }
}
