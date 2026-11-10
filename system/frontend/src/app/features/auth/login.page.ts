// Login page (FR-AUTH-01, FR-AUTH-03). Form errors show at the field (QR-IC-04).
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonInput, IonNote, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { BRAND } from '../../shared/brand';
import { STRINGS } from '../../shared/strings';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IonContent, IonInput, IonButton, IonNote, IonSpinner],
  template: `
    <ion-content>
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
            labelPlacement="stacked"
            fill="outline"
            [errorText]="emailError()"
            data-testid="email"
          />
          <ion-input
            formControlName="password"
            type="password"
            autocomplete="current-password"
            [label]="s.login.password"
            labelPlacement="stacked"
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
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-width: 420px;
      min-height: 100%;
      margin: 0 auto;
    }

    /* Top part in the primary color with soft bands, the logo, and a curved amber edge */
    .hero {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 36px 28px 48px;
      border-bottom: 8px solid var(--ion-color-secondary);
      border-radius: 0 0 50% 50% / 0 0 32px 32px;
      background:
        linear-gradient(138deg, transparent 32%, rgba(var(--ion-color-tertiary-rgb), 0.13) 32% 53%, transparent 53%),
        linear-gradient(38deg, transparent 44%, rgba(var(--ion-color-tertiary-rgb), 0.12) 44% 69%, transparent 69%),
        var(--ion-color-primary);
    }
    /* The logo image has a white background. A white panel keeps it clean on the primary color. */
    .logo {
      width: 100%;
      max-width: 340px;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-l);
      background: var(--ion-color-primary-contrast);
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
      padding: var(--space-3) var(--space-5) var(--space-6);
    }
    ion-note {
      font-size: 0.875rem;
      line-height: 1.5;
    }
    ion-button {
      margin: 10px 0 0;
      font-size: 0.95rem;
    }
    @media (min-width: 600px) {
      .login {
        min-height: calc(100% - 80px);
        margin-block: 40px;
        overflow: hidden;
        border: 1px solid var(--ion-color-light-shade);
        border-radius: var(--radius-l);
      }
    }
  `,
})
export class LoginPage {
  protected readonly s = STRINGS;
  protected readonly brand = BRAND;
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
