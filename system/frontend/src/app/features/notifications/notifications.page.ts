// Notifications list for OJT and facilitator (FR-NOTI-05).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonItem, IonLabel, IonList, IonNote, IonSegment, IonSegmentButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';
import { AuthService } from '../../core/auth/auth.service';
import { homePath } from '../../core/auth/access';
import { MockStore } from '../../data/mock/mock-store.service';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { STRINGS } from '../../shared/strings';
import { FAC_STRINGS } from '../../shared/strings-fac';
import { UI_STRINGS } from '../../shared/strings-ui';
import { dateLabel, timeOfDay } from '../../shared/utils/format';
import { localDate } from '../../shared/utils/hours';

type Filter = 'all' | 'unread';

addIcons({ notificationsOutline });

@Component({
  selector: 'app-notifications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IonContent, IonButton, IonIcon, IonList, IonItem, IonLabel, IonNote, IonSegment, IonSegmentButton],
  template: `
    <app-page-header [title]="strings.pages.notifications" [backHref]="home()" [compact]="true" />
    <ion-content class="ion-padding">
      @if (items().length === 0) {
        <p class="empty">{{ filter() === 'all' ? text.empty : text.emptyUnread }}</p>
      }
      <ion-list>
        @for (n of items(); track n.id) {
          <ion-item button [detail]="false" lines="none" (click)="open(n.id, n.link)">
            <ion-icon slot="start" name="notifications-outline" aria-hidden="true" />
            <ion-label class="ion-text-wrap">
              <h2 [class.unread]="!n.read">{{ n.title }}</h2>
              <p>{{ n.body }}<span aria-hidden="true"> · </span>{{ n.when }}</p>
            </ion-label>
            @if (!n.read) {
              <span slot="end" class="dot" [attr.aria-label]="text.unreadMark"></span>
            }
          </ion-item>
        }
      </ion-list>
      <div class="controls">
        <ion-segment [value]="filter()" (ionChange)="filter.set($any($event).detail.value)">
          <ion-segment-button value="all"><ion-label>{{ text.all }}</ion-label></ion-segment-button>
          <ion-segment-button value="unread"><ion-label>{{ text.unread }}</ion-label></ion-segment-button>
        </ion-segment>
        <ion-button fill="clear" [disabled]="store.unreadCount() === 0" (click)="store.markAllRead()">{{ text.markAll }}</ion-button>
      </div>
      <ion-note class="note">{{ ui.prototypeNote }}</ion-note>
    </ion-content>
  `,
  styles: `
    ion-content {
      --background: var(--lb-page);
      --padding-start: 16px;
      --padding-end: 16px;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
    }
    ion-segment {
      --background: var(--lb-panel);
      flex: 1 1 138px;
      width: auto;
    }
    ion-segment-button {
      --color: var(--ion-color-medium-shade);
      --color-checked: var(--ion-color-primary);
      --indicator-color: var(--ion-color-secondary);
      min-height: 36px;
    }
    .controls ion-button {
      margin: 0;
      --color: var(--ion-color-primary);
      --padding-start: 10px;
      --padding-end: 10px;
      font-size: 0.75rem;
    }
    ion-item {
      --background: var(--lb-mist);
      --min-height: 63px;
      --border-width: 0;
      --padding-start: 9px;
      margin: 0 0 8px;
      border-radius: 10px;
      box-shadow: 0 1px var(--lb-panel-border);
    }
    ion-item:first-child { --background: var(--lb-notification-soft); }
    ion-item:is(:nth-child(4n + 2), :nth-child(4n + 3)) {
      --background: var(--lb-cream);
    }
    ion-icon {
      font-size: 21px;
      color: var(--ion-color-medium-shade);
      margin-inline-end: 11px;
    }
    ion-label {
      margin: 9px 0;
    }
    ion-item h2 {
      font-weight: 500;
      font-family: var(--ion-font-family);
      font-size: 0.875rem;
      line-height: 1.35;
      margin-bottom: 2px;
      color: var(--ion-text-color);
    }
    ion-item p {
      font-size: 0.75rem;
      line-height: 1.45;
      color: var(--ion-color-medium-shade);
    }
    .dot {
      width: 9px;
      height: 9px;
      margin-inline: 7px 0;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--lb-unread);
    }
    ion-item h2.unread {
      font-weight: 700;
    }
    .note {
      display: block;
      margin-top: 12px;
      text-align: center;
      font-size: 0.6875rem;
      line-height: 1.5;
    }
    .empty { color: var(--ion-color-medium-shade); }
  `,
})
export class NotificationsPage {
  protected readonly strings = STRINGS;
  protected readonly text = FAC_STRINGS.notifications;
  protected readonly ui = UI_STRINGS;
  protected readonly store = inject(MockStore);
  protected readonly filter = signal<Filter>('all');
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly home = computed(() => (this.auth.role() ? homePath(this.auth.role()!) : '/'));

  protected readonly items = computed(() =>
    this.store
      .notifications()
      .filter((n) => this.filter() === 'all' || !n.read)
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        read: n.read,
        when: `${dateLabel(localDate(n.createdAt))} ${timeOfDay(n.createdAt)}`,
      })),
  );

  protected async open(id: string, link: string): Promise<void> {
    this.store.markRead(id);
    await this.router.navigateByUrl(link);
  }
}
