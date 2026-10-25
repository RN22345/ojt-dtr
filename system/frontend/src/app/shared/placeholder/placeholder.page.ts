// A wireframe page for each screen that is not built yet (D-31). The route data gives the title key.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { PageKey, STRINGS } from '../strings';
import { PlaceholderComponent } from './placeholder.component';

@Component({
  selector: 'app-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, PlaceholderComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title() }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="logout()">{{ strings.logout }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <app-placeholder [label]="title().toUpperCase()" />
      <p>{{ strings.placeholderNote }}</p>
      @if (auth.profile(); as p) {
        <p>{{ p.fullName }} ({{ p.role }})</p>
      }
    </ion-content>
  `,
})
export class PlaceholderPage {
  /** Bound from the route data (withComponentInputBinding). */
  readonly pageKey = input.required<PageKey>();
  readonly title = computed(() => STRINGS.pages[this.pageKey()]);
  protected readonly strings = STRINGS;
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
