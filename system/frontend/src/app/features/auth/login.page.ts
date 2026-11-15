// Login page (FR-AUTH-01, FR-AUTH-03). Form errors show at the field (QR-IC-04).
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonInput, IonNote, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { PlatformService } from '../../core/platform.service';
import { STRINGS } from '../../shared/strings';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonContent, IonInput, IonButton, IonNote, IonSpinner],
  template: `
    <ion-content [class.web]="web">
      <div class="login">
        <div class="hero">
          <div class="logo">
            <img src="assets/log-bound-logo.png" [alt]="s.appName" />
          </div>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <h1>{{ s.login.title }}</h1>
          <ion-input
            formControlName="email"
            type="email"
            inputmode="email"
            autocomplete="username"
            [label]="s.login.email"
            [labelPlacement]="web ? 'floating' : 'stacked'"
            fill="outline"
            [errorText]="emailError()"
            data-testid="email"
          />
          <ion-input
            formControlName="password"
            type="password"
            autocomplete="current-password"
            [label]="s.login.password"
            [labelPlacement]="web ? 'floating' : 'stacked'"
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
      max-width: 420px;
      min-height: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--ion-background-color);
    }

    .hero {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 36px 28px 64px;
      background:
        linear-gradient(138deg, transparent 32%, rgba(var(--ion-color-tertiary-rgb), 0.13) 32% 53%, transparent 53%),
        linear-gradient(38deg, transparent 44%, rgba(var(--ion-color-tertiary-rgb), 0.12) 44% 69%, transparent 69%),
        var(--ion-color-primary);
    }
    .hero::before,
    .hero::after {
      content: '';
      position: absolute;
      left: -1%;
      width: 102%;
      bottom: -1px;
      pointer-events: none;
      mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E%3Cpath d='M0 42 C18 0 28 8 50 42 S82 88 100 45 V100 H0Z' fill='white'/%3E%3C/svg%3E");
      mask-size: 100% 100%;
      mask-repeat: no-repeat;
    }
    .hero::before {
      height: 56px;
      background: var(--ion-color-secondary);
    }
    .hero::after {
      height: 38px;
      background: var(--ion-background-color);
    }
    .logo {
      position: relative;
      width: 100%;
      max-width: 340px;
    }
    .logo img {
      display: block;
      width: 100%;
      height: auto;
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
      --background: var(--ion-color-light-tint);
      --border-radius: 6px;
      --border-color: var(--ion-color-light-shade);
      --padding-start: 12px;
      --padding-end: 12px;
      font-size: 0.875rem;
      min-height: 54px;
    }
    ion-note {
      font-size: 0.75rem;
      line-height: 1.5;
    }
    ion-button {
      --border-radius: 9px;
      min-height: 44px;
      margin: 10px 0 0;
      font-size: 0.95rem;
    }
    @media (min-width: 600px) {
      .login {
        margin-block: 40px;
        min-height: calc(100% - 80px);
        border: 1px solid var(--ion-color-light-shade);
        border-radius: 16px;
        overflow: hidden;
      }
    }

    ion-content.web {
      --background: var(--lb-admin-canvas, var(--ion-color-light-tint));
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
      border: 0;
      border-radius: 7px;
      background: var(--lb-panel);
    }
    .web .hero {
      width: 100%;
      max-width: 304px;
      height: 124px;
      padding: 0 18px;
    }
    .web .hero::before { height: 44px; }
    .web .hero::after {
      height: 28px;
      background: var(--lb-panel);
    }
    .web .logo {
      max-width: 245px;
      transform: translateY(-14px);
    }
    .web form {
      gap: 12px;
      padding: 0;
    }
    .web h1 {
      margin: 0;
      color: var(--ion-color-dark);
      font-size: 1.25rem;
      line-height: 1.4;
    }
    .web ion-input {
      --background: var(--lb-admin-canvas, var(--ion-color-light-tint));
      --border-radius: 4px;
      min-height: 44px;
      font-size: 0.8125rem;
    }
    .web ion-button {
      width: min(100%, 280px);
      min-height: 36px;
      margin: 0;
    }
    .web ion-button::part(native) {
      background: var(--lb-amber-gradient);
    }
  `,
})
export class LoginPage {
  protected readonly s = STRINGS;
  protected readonly web = inject(PlatformService).platform === 'web';
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
