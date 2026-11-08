// Admin users page (FR-ADM-01): list with search and role filter, create, change, deactivate or activate, reset password.
// The form is inline. Its values stay when the app is offline or a save fails (TC-ST-ADM-02).
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { AlertController, IonBadge, IonButton, IonInput, IonNote, IonSelect, IonSelectOption } from '@ionic/angular';
import { AdminApi } from '../../data/admin/admin-api.service';
import { AdminRole, AdminUser } from '../../data/admin/admin-models';
import { STRINGS } from '../../shared/strings';
import { ADM_STRINGS } from '../../shared/strings-adm';
import {
  EMPTY_USER,
  UserForm,
  errorMessage,
  filterUsers,
  hasErrors,
  validatePassword,
  validateUser,
} from './admin-forms';
import { AdminOnline } from './admin-online.service';
import { AdminPageComponent } from './admin-page.component';

type Mode = 'create' | 'edit' | 'password' | null;

@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminPageComponent, IonButton, IonInput, IonNote, IonSelect, IonSelectOption, IonBadge],
  template: `
    <app-admin-page [title]="pages.adminUsers" [error]="error()" [notice]="notice()">
      <div class="adm-bar">
        <ion-input [label]="t.search" labelPlacement="stacked" fill="outline" [value]="search()"
          (ionInput)="search.set($any($event).detail.value ?? '')" data-testid="search" />
        <ion-select [label]="t.filterRole" labelPlacement="stacked" fill="outline" interface="popover"
          [value]="roleFilter()" (ionChange)="roleFilter.set($any($event).detail.value ?? '')" data-testid="role-filter">
          <ion-select-option value="">{{ s.all }}</ion-select-option>
          @for (r of roles; track r) {
            <ion-select-option [value]="r">{{ s.roles[r] }}</ion-select-option>
          }
        </ion-select>
        <ion-button (click)="open('create')" data-testid="new">{{ t.create }}</ion-button>
      </div>

      @if (mode() === 'create' || mode() === 'edit') {
        <form class="adm-form" (submit)="$event.preventDefault(); save()" novalidate data-testid="form">
          <h2>{{ mode() === 'create' ? t.createTitle : t.editTitle }}</h2>
          @if (mode() === 'create') {
            <div>
              <ion-input type="email" autocomplete="off" [label]="t.email" labelPlacement="stacked" fill="outline"
                [value]="form().email" (ionInput)="patch({ email: $any($event).detail.value ?? '' })" data-testid="email" />
              @if (shown().email; as m) {
                <ion-note color="danger">{{ m }}</ion-note>
              }
            </div>
            <div>
              <ion-input type="password" autocomplete="new-password" [label]="t.password" labelPlacement="stacked" fill="outline"
                [value]="form().password" (ionInput)="patch({ password: $any($event).detail.value ?? '' })" data-testid="password" />
              @if (shown().password; as m) {
                <ion-note color="danger">{{ m }}</ion-note>
              }
            </div>
          } @else {
            <p class="adm-muted adm-wide">{{ t.emailNote }}</p>
          }
          <div>
            <ion-input [label]="t.fullName" labelPlacement="stacked" fill="outline"
              [value]="form().fullName" (ionInput)="patch({ fullName: $any($event).detail.value ?? '' })" data-testid="full-name" />
            @if (shown().fullName; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div>
            <ion-input inputmode="tel" [label]="t.contact" labelPlacement="stacked" fill="outline"
              [value]="form().contactNo" (ionInput)="patch({ contactNo: $any($event).detail.value ?? '' })" data-testid="contact" />
            @if (shown().contactNo; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div>
            <ion-select [label]="t.role" labelPlacement="stacked" fill="outline" interface="popover"
              [value]="form().role" (ionChange)="patch({ role: $any($event).detail.value ?? '' })" data-testid="role">
              @for (r of roles; track r) {
                <ion-select-option [value]="r">{{ s.roles[r] }}</ion-select-option>
              }
            </ion-select>
            @if (shown().role; as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div class="adm-actions adm-wide">
            <ion-button type="submit" [disabled]="!canSave()" data-testid="save">{{ busy() ? s.saving : s.save }}</ion-button>
            <ion-button fill="outline" (click)="close()">{{ s.cancel }}</ion-button>
          </div>
        </form>
      }

      @if (mode() === 'password') {
        <form class="adm-form" (submit)="$event.preventDefault(); savePassword()" novalidate data-testid="password-form">
          <h2>{{ t.resetPassword }}: {{ target()?.fullName }}</h2>
          <div>
            <ion-input type="password" autocomplete="new-password" [label]="t.newPassword" labelPlacement="stacked" fill="outline"
              [value]="newPassword()" (ionInput)="newPassword.set($any($event).detail.value ?? '')" data-testid="new-password" />
            @if (submitted() && passwordError(); as m) {
              <ion-note color="danger">{{ m }}</ion-note>
            }
          </div>
          <div class="adm-actions adm-wide">
            <ion-button type="submit" [disabled]="!canSave()" data-testid="save-password">{{ busy() ? s.saving : s.save }}</ion-button>
            <ion-button fill="outline" (click)="close()">{{ s.cancel }}</ion-button>
          </div>
        </form>
      }

      <div class="adm-scroll">
        <table class="adm-table" data-testid="table">
          <thead>
            <tr>
              <th>{{ t.tableName }}</th>
              <th>{{ t.tableRole }}</th>
              <th>{{ t.tableContact }}</th>
              <th>{{ t.tableStatus }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (u of visible(); track u.id) {
              <tr>
                <td>{{ u.fullName }}</td>
                <td>{{ s.roles[u.role] }}</td>
                <td>{{ u.contactNo || '-' }}</td>
                <td>
                  <ion-badge [color]="u.status === 'active' ? 'success' : 'medium'">
                    {{ u.status === 'active' ? s.statusActive : s.statusInactive }}
                  </ion-badge>
                </td>
                <td class="adm-actions">
                  <ion-button size="small" fill="outline" (click)="open('edit', u)">{{ s.edit }}</ion-button>
                  <ion-button size="small" fill="outline" (click)="open('password', u)">{{ t.resetPassword }}</ion-button>
                  <ion-button size="small" fill="outline" [color]="u.status === 'active' ? 'danger' : 'success'"
                    [disabled]="!canSave()" (click)="toggleActive(u)">
                    {{ u.status === 'active' ? t.deactivate : t.activate }}
                  </ion-button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!loading() && visible().length === 0) {
        <p class="adm-muted">{{ s.empty }}</p>
      }
    </app-admin-page>
  `,
})
export class AdminUsersPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly online = inject(AdminOnline);
  private readonly alerts = inject(AlertController);
  protected readonly pages = STRINGS.pages;
  protected readonly s = ADM_STRINGS;
  protected readonly t = ADM_STRINGS.users;
  protected readonly roles: AdminRole[] = ['ojt', 'facilitator', 'admin'];

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly search = signal('');
  protected readonly roleFilter = signal<AdminRole | ''>('');

  protected readonly mode = signal<Mode>(null);
  protected readonly target = signal<AdminUser | null>(null);
  protected readonly form = signal<UserForm>(EMPTY_USER);
  protected readonly newPassword = signal('');
  protected readonly submitted = signal(false);

  protected readonly visible = computed(() => filterUsers(this.users(), this.search(), this.roleFilter()));
  private readonly errors = computed(() => validateUser(this.form(), this.mode() === 'edit' ? 'edit' : 'create'));
  protected readonly shown = computed(() => (this.submitted() ? this.errors() : {}) as ReturnType<typeof validateUser>);
  protected readonly passwordError = computed(() => validatePassword(this.newPassword()));
  /** Save buttons are off when the app is offline (TC-ST-ADM-02) or a save runs. */
  protected readonly canSave = computed(() => this.online.online() && !this.busy());

  ngOnInit(): void {
    void this.load();
  }

  protected patch(change: Partial<UserForm>): void {
    this.form.update((f) => ({ ...f, ...change }));
  }

  protected open(mode: Mode, user: AdminUser | null = null): void {
    this.mode.set(mode);
    this.target.set(user);
    this.submitted.set(false);
    this.error.set('');
    this.notice.set('');
    this.newPassword.set('');
    this.form.set(
      user ? { ...EMPTY_USER, fullName: user.fullName, contactNo: user.contactNo ?? '', role: user.role } : EMPTY_USER,
    );
  }

  protected close(): void {
    this.mode.set(null);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.users.set(await this.api.listUsers());
    } catch (e) {
      this.error.set(`${this.s.loadFailed} ${errorMessage(e)}`);
    } finally {
      this.loading.set(false);
    }
  }

  /** Runs one server action. On success the form closes. On failure the form values stay. */
  private async run(action: () => Promise<void>, notice: string): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await action();
      this.notice.set(notice);
      this.close();
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.canSave() || hasErrors(this.errors())) {
      return;
    }
    const f = this.form();
    const common = { fullName: f.fullName.trim(), contactNo: f.contactNo.trim(), role: f.role as AdminRole };
    const user = this.target();
    if (this.mode() === 'edit' && user) {
      await this.run(() => this.api.updateUser(user.id, common), this.s.saved);
    } else {
      await this.run(
        () => this.api.createUser({ ...common, email: f.email.trim(), password: f.password }).then(() => undefined),
        this.t.created,
      );
    }
  }

  protected async savePassword(): Promise<void> {
    this.submitted.set(true);
    const user = this.target();
    if (!user || !this.canSave() || this.passwordError()) {
      return;
    }
    await this.run(() => this.api.resetPassword(user.id, this.newPassword()), this.s.saved);
  }

  protected async toggleActive(user: AdminUser): Promise<void> {
    if (user.status === 'active' && !(await this.confirmDeactivate(user))) {
      return;
    }
    await this.run(() => this.api.setUserActive(user.id, user.status !== 'active'), this.s.saved);
  }

  private async confirmDeactivate(user: AdminUser): Promise<boolean> {
    const alert = await this.alerts.create({
      message: this.t.confirmDeactivate(user.fullName),
      buttons: [
        { text: this.s.cancel, role: 'cancel' },
        { text: this.t.confirm, role: 'destructive' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'destructive';
  }
}
