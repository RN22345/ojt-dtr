// TC-ST-ADM-02 at page level: offline, the admin pages show a message, disable the save buttons,
// and keep the form values. When the network returns, the save buttons are enabled again.
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminApi } from '../../data/admin/admin-api.service';
import { NETWORK } from '../../plugins/network.plugin';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { AdminPageComponent } from './admin-page.component';
import { AdminBatchesPage } from './batches.page';
import { AdminCompaniesPage } from './companies.page';

@Component({ selector: 'app-page-header', template: '' })
class HeaderStubComponent {
  readonly title = input('');
}

describe('admin pages offline (D-13, FR-ADM-02, FR-ADM-03, TC-ST-ADM-02)', () => {
  let listener: (online: boolean) => void;
  const api = {
    listBatches: vi.fn(async () => []),
    listCompanies: vi.fn(async () => []),
    saveBatch: vi.fn(async () => undefined),
    saveCompany: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminApi, useValue: api },
        {
          provide: NETWORK,
          useValue: {
            isOnline: async () => false,
            onChange: async (l: (online: boolean) => void) => ((listener = l), () => undefined),
          },
        },
      ],
    });
    TestBed.overrideComponent(AdminPageComponent, {
      remove: { imports: [PageHeaderComponent] },
      add: { imports: [HeaderStubComponent] },
    });
  });

  async function settle(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const q = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement & { disabled?: boolean };

  it('shows the offline message, disables Save, and keeps the batch form values', async () => {
    const fixture = TestBed.createComponent(AdminBatchesPage);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(q(el, 'offline')).not.toBeNull();
    });

    q(el, 'new').click();
    await settle(fixture);
    const page = fixture.componentInstance as unknown as { patch(c: object): void; save(): Promise<void>; form(): { name: string } };
    page.patch({ name: 'Batch 9', startDate: '2026-11-02', endDate: '2027-02-27', requiredHours: '486' });
    await settle(fixture);

    expect(q(el, 'save').disabled).toBe(true);
    await page.save();
    expect(api.saveBatch).not.toHaveBeenCalled();
    expect(page.form().name).toBe('Batch 9');
    expect(q(el, 'form')).not.toBeNull();

    listener(true);
    await settle(fixture);
    expect(q(el, 'offline')).toBeNull();
    expect(q(el, 'save').disabled).toBe(false);
    await page.save();
    expect(api.saveBatch).toHaveBeenCalledOnce();
  });

  it('disables Save of the company form while offline', async () => {
    const fixture = TestBed.createComponent(AdminCompaniesPage);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    q(el, 'new').click();
    await settle(fixture);
    await vi.waitFor(async () => {
      await settle(fixture);
      expect(q(el, 'save').disabled).toBe(true);
    });
    expect(api.saveCompany).not.toHaveBeenCalled();
  });
});
