// Login page (FR-AUTH-01, FR-AUTH-03). Form errors show at the field (QR-IC-04).
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonInput, IonNote, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { PlatformService } from '../../core/platform.service';
import { BRAND } from '../../shared/brand';
import { STRINGS } from '../../shared/strings';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonContent, IonInput, IonButton, IonNote, IonSpinner],
  template: `
    <ion-content [class.web]="isWeb">
      <div class="login">
        <div class="hero">
          <div class="logo anim-pop">
            <img [src]="brand.logo" [alt]="s.appName" />
          </div>
        </div>
        <form class="anim-rise-in" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h1>{{ s.login.title }}</h1>
          <ion-input
            formControlName="email"
            type="email"
            inputmode="email"
            autocomplete="username"
            [label]="s.login.email"
            [labelPlacement]="isWeb ? 'floating' : 'stacked'"
            fill="outline"
            [errorText]="emailError()"
            data-testid="email"
          />
          <ion-input
            formControlName="password"
            type="password"
            autocomplete="current-password"
            [label]="s.login.password"
            [labelPlacement]="isWeb ? 'floating' : 'stacked'"
            fill="outline"
            [errorText]="s.login.passwordRequired"
            data-testid="password"
          />
          @if (failure(); as text) {
            <ion-note color="danger" role="alert" data-testid="failure">{{ text }}</ion-note>
          }
          <ion-button type="submit" expand="block" [disabled]="busy()" data-testid="submit">
            @if (busy()) {
              <ion-spinner name="crescent" />
            } @else {
              {{ s.login.submit }}
            }
          </ion-button>
        </form>
      </div>
    </ion-content>
  `,
  styles: `
    .login {
      --login-panel: var(--lb-panel, #ffffff);
      --login-field: #f4f5f7;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 420px;
      min-height: 100%;
      margin: 0 auto;
      background: var(--login-panel);
    }

    .hero {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 32px 24px 64px;
      background:
        linear-gradient(140deg, transparent 31%, rgba(var(--ion-color-tertiary-rgb), 0.11) 31% 53%, transparent 53%),
        linear-gradient(39deg, transparent 44%, rgba(var(--ion-color-tertiary-rgb), 0.12) 44% 69%, transparent 69%),
        linear-gradient(120deg, var(--ion-color-primary), #22697b);
    }
    .hero::before,
    .hero::after {
      content: '';
      position: absolute;
      inset: auto 0 -1px;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0 46 C19 5 30 9 51 43 S82 85 100 46 V100 H0Z' fill='white'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
      pointer-events: none;
    }
    .hero::before {
      height: 52px;
      background: var(--ion-color-secondary);
    }
    .hero::after {
      height: 34px;
      background: var(--login-panel);
    }
    .logo {
      width: 100%;
      max-width: 328px;
    }
    .logo img {
      display: block;
      width: 100%;
      height: auto;
      /* Apply the mood board colors to the existing transparent asset. */
      filter: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='palette' color-interpolation-filters='sRGB'%3E%3CfeColorMatrix type='matrix' values='.960784 0 .6 0 0 .65098 0 1.00625 0 0 .137255 0 .95625 0 0 0 0 0 1 0'/%3E%3C/filter%3E%3C/svg%3E#palette");
    }
    h1 {
      margin: 0 0 2px;
      font-size: 1.45rem;
      color: var(--ion-color-primary);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 12px 24px 32px;
    }
    ion-input {
      --background: var(--login-field);
      --border-radius: 5px;
      --border-color: var(--ion-color-light-shade);
      --padding-start: 12px;
      --padding-end: 12px;
      min-height: 54px;
      font-size: 0.875rem;
    }
    ion-note {
      font-size: 0.875rem;
      line-height: 1.5;
    }
    ion-button {
      --border-radius: 9px;
      min-height: 44px;
      margin: 10px 0 0;
      font-size: 0.95rem;
    }

    ion-content.web {
      --background: var(--lb-admin-canvas, #f2f3f6);
    }
    ion-content.web::part(scroll) {
      display: grid;
      place-items: safe center;
      max-width: none;
      padding: 24px;
    }
    .web .login {
      box-sizing: border-box;
      width: 100%;
      max-width: 360px;
      min-height: 0;
      margin: 0;
      padding: 25px;
      gap: 20px;
      border-radius: 7px;
    }
    .web .hero {
      box-sizing: border-box;
      width: 100%;
      max-width: 304px;
      height: 124px;
      padding: 0 18px 30px;
    }
    .web .hero::before {
      height: 44px;
    }
    .web .hero::after {
      height: 28px;
    }
    .web .logo {
      max-width: 239px;
    }
    .web form {
      gap: 8px;
      padding: 0;
    }
    .web h1 {
      margin: 0;
      color: var(--ion-color-dark);
      font-size: 1.25rem;
      line-height: 1.4;
    }
    .web ion-input {
      --border-radius: 4px;
      min-height: 44px;
      font-size: 0.8125rem;
    }
    .web ion-button {
      width: 100%;
      min-height: 36px;
      margin: 0;
    }
    .web ion-button::part(native) {
      background-image: var(--lb-amber-gradient, linear-gradient(160deg, #ffc65d, #f5a623 55%, #db7e09 96%));
      color: #ffffff;
    }
  `,
})
export class LoginPage {
  protected readonly s = STRINGS;
  protected readonly brand = BRAND;
  protected readonly isWeb = inject(PlatformService).platform === 'web';
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly busy = signal(false);
  readonly failure = signal<string | null>(null);

  emailError(): string {
    return this.form.controls.email.hasError('required') ? this.s.login.emailRequired : this.s.login.emailInvalid;
  }

  async submit(): Promise<void> {
    this.failure.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      const result = await this.auth.signIn(email, password);
      if (result.ok) {
        this.form.reset();
        await this.router.navigateByUrl(result.home, { replaceUrl: true });
      } else {
        this.failure.set(this.s.login.failure[result.reason]);
        this.form.controls.password.reset();
      }
    } finally {
      this.busy.set(false);
    }
  }
}
