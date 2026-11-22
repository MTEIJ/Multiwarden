import { ScrollingModule } from "@angular/cdk/scrolling";
import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { combineLatest, firstValueFrom, from, map, of, startWith, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  getMultiAccountScope,
  MultiAccountScope,
  registerMultiAccountScope,
} from "@bitwarden/common/multiwarden/multi-account-scope";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AvatarModule,
  ButtonModule,
  IconButtonModule,
  IconModule,
  ItemModule,
  MenuModule,
  SearchModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

import { CurrentAccountComponent } from "../../auth/popup/account-switching/current-account.component";
import { AccountSwitcherService } from "../../auth/popup/account-switching/services/account-switcher.service";
import {
  CipherUse,
  FillCipherPolicy,
} from "../../autofill/services/abstractions/fill-cipher-policy";
import { BrowserApi } from "../../platform/browser/browser-api";
import { PopOutComponent } from "../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";
import { VaultPopupAutofillService } from "../../vault/popup/services/vault-popup-autofill.service";

/** One logged-in account, as shown in the account filter and on each item. */
export type OverviewAccount = {
  userId: UserId;
  email: string;
  name: string;
  avatarColor: string | null;
  unlocked: boolean;
  active: boolean;
};

/** One vault item together with the account it belongs to. */
export type OverviewRow = {
  cipher: CipherView;
  account: OverviewAccount;
  /** The item matches the website in the current tab. */
  suggested: boolean;
};

const ALL = "all";

/**
 * Multiwarden: one list of every item in every unlocked account. Each item carries its
 * account's avatar, and can be filled, copied or opened without switching accounts first.
 */
@Component({
  templateUrl: "all-accounts.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    JslibModule,
    FormsModule,
    RouterModule,
    ScrollingModule,
    AppVaultIconComponent,
    AvatarModule,
    ButtonModule,
    IconButtonModule,
    IconModule,
    ItemModule,
    MenuModule,
    SearchModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
  ],
})
export class AllAccountsComponent {
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly avatarService = inject(AvatarService);
  private readonly cipherService = inject(CipherService);
  private readonly fillCipherPolicy = inject(FillCipherPolicy);
  private readonly totpService = inject(TotpService);
  private readonly autofillService = inject(VaultPopupAutofillService);
  private readonly accountSwitcherService = inject(AccountSwitcherService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);

  private readonly scope: MultiAccountScope;

  protected readonly searchText = signal("");
  protected readonly selectedAccount = signal<string>(ALL);
  protected readonly ALL = ALL;

  private readonly accounts$ = combineLatest([
    this.accountService.accounts$,
    this.authService.authStatuses$,
    this.accountService.activeAccount$,
  ]).pipe(
    switchMap(async ([accounts, statuses, active]) => {
      const entries = Object.entries(accounts ?? {}).filter(
        ([id]) => statuses?.[id as UserId] !== AuthenticationStatus.LoggedOut,
      );
      const result = await Promise.all(
        entries.map(async ([id, info]): Promise<OverviewAccount> => {
          const userId = id as UserId;
          return {
            userId,
            email: info?.email ?? "",
            name: info?.name || info?.email || "",
            avatarColor: await firstValueFrom(this.avatarService.getUserAvatarColor$(userId)),
            unlocked: statuses?.[userId] === AuthenticationStatus.Unlocked,
            active: active?.id === userId,
          };
        }),
      );
      return result.sort((a, b) => Number(b.active) - Number(a.active));
    }),
  );

  protected readonly accounts = toSignal(this.accounts$, { initialValue: [] });

  private readonly tabUrl$ = from(BrowserApi.getTabFromCurrentWindow()).pipe(
    map((tab) => (tab?.url?.startsWith("http") ? tab.url : null)),
  );

  private readonly rows$ = combineLatest([this.accounts$, this.tabUrl$]).pipe(
    switchMap(([accounts, tabUrl]) => {
      const unlocked = accounts.filter((a) => a.unlocked);
      if (unlocked.length === 0) {
        return of<OverviewRow[]>([]);
      }
      return combineLatest(
        unlocked.map((account) =>
          this.cipherService.cipherViews$(account.userId).pipe(
            startWith<CipherView[] | null>(null),
            switchMap(async (ciphers) => this.rowsFor(account, ciphers ?? [], tabUrl)),
          ),
        ),
      ).pipe(map((perAccount) => perAccount.flat()));
    }),
  );

  private readonly rows = toSignal(this.rows$, { initialValue: undefined });

  protected readonly loading = computed(() => this.rows() === undefined);

  private readonly visibleRows = computed(() => {
    const rows = this.rows() ?? [];
    const account = this.selectedAccount();
    const search = this.searchText().trim().toLowerCase();
    return rows.filter(
      (row) =>
        (account === ALL || row.account.userId === account) &&
        (search === "" || matchesSearch(row.cipher, search)),
    );
  });

  protected readonly suggestions = computed(() =>
    this.searchText().trim() === "" ? this.visibleRows().filter((row) => row.suggested) : [],
  );

  protected readonly allRows = computed(() =>
    [...this.visibleRows()].sort((a, b) =>
      (a.cipher.name ?? "").localeCompare(b.cipher.name ?? "", undefined, {
        sensitivity: "base",
      }),
    ),
  );

  protected readonly lockedAccounts = computed(() => this.accounts().filter((a) => !a.unlocked));

  protected readonly countFor = computed(() => {
    const counts = new Map<string, number>();
    for (const row of this.rows() ?? []) {
      counts.set(row.account.userId, (counts.get(row.account.userId) ?? 0) + 1);
    }
    return counts;
  });

  constructor() {
    // The popup has its own copy of the autofill services; give it a scope too, so that filling
    // an item from another account records it against that account.
    this.scope =
      getMultiAccountScope() ?? new MultiAccountScope(this.accountService, this.authService);
    registerMultiAccountScope(this.scope);
  }

  private async rowsFor(
    account: OverviewAccount,
    ciphers: CipherView[],
    tabUrl: string | null,
  ): Promise<OverviewRow[]> {
    let suggestedIds = new Set<string>();
    if (tabUrl) {
      try {
        const forUrl = await this.fillCipherPolicy.ciphersForUrl(
          tabUrl,
          account.userId,
          CipherUse.UserFill,
        );
        suggestedIds = new Set(forUrl.map((c) => c.id));
      } catch {
        // No suggestions for this account; the full list still shows.
      }
    }
    return ciphers
      .filter((cipher) => !cipher.isDeleted && !cipher.isArchived)
      .map((cipher) => {
        this.scope.remember(cipher.id, account.userId);
        return { cipher, account, suggested: suggestedIds.has(cipher.id) };
      });
  }

  protected selectAccountFilter(userId: string) {
    this.selectedAccount.set(this.selectedAccount() === userId ? ALL : userId);
  }

  protected subtitle(cipher: CipherView): string {
    return cipher.subTitle ?? "";
  }

  protected canFill(row: OverviewRow): boolean {
    return row.suggested && row.cipher.type === CipherType.Login;
  }

  /** Items that need the master password, from an account that isn't active, open in that account. */
  private needsOwnAccount(row: OverviewRow): boolean {
    return row.cipher.reprompt !== CipherRepromptType.None && !row.account.active;
  }

  protected async primaryAction(row: OverviewRow) {
    if (this.canFill(row)) {
      await this.fill(row);
      return;
    }
    await this.open(row);
  }

  protected async fill(row: OverviewRow) {
    if (this.needsOwnAccount(row)) {
      await this.open(row);
      return;
    }
    this.scope.remember(row.cipher.id, row.account.userId);
    await this.autofillService.doAutofill(row.cipher);
  }

  protected async open(row: OverviewRow) {
    if (!row.account.active) {
      await this.accountSwitcherService.selectAccount(row.account.userId);
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: row.cipher.id, type: row.cipher.type },
    });
  }

  protected async unlock(account: OverviewAccount) {
    await this.accountSwitcherService.selectAccount(account.userId);
    await this.router.navigate(["/"]);
  }

  protected hasUsername(row: OverviewRow) {
    return row.cipher.type === CipherType.Login && !!row.cipher.login?.username;
  }

  protected hasPassword(row: OverviewRow) {
    return row.cipher.type === CipherType.Login && !!row.cipher.login?.password;
  }

  protected hasTotp(row: OverviewRow) {
    return row.cipher.type === CipherType.Login && !!row.cipher.login?.totp;
  }

  protected async copy(row: OverviewRow, field: "username" | "password" | "totp") {
    if (field !== "username" && this.needsOwnAccount(row)) {
      await this.open(row);
      return;
    }
    let value: string | undefined;
    let labelKey: string;
    switch (field) {
      case "username":
        value = row.cipher.login?.username ?? undefined;
        labelKey = "username";
        break;
      case "password":
        value = row.cipher.login?.password ?? undefined;
        labelKey = "password";
        break;
      case "totp": {
        const totp = row.cipher.login?.totp;
        value = totp ? (await firstValueFrom(this.totpService.getCode$(totp)))?.code : undefined;
        labelKey = "verificationCodeTotp";
        break;
      }
    }
    if (!value) {
      return;
    }
    this.platformUtilsService.copyToClipboard(value);
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("valueCopied", this.i18nService.t(labelKey)),
    });
  }

  protected trackRow(_index: number, row: OverviewRow) {
    return `${row.account.userId}:${row.cipher.id}`;
  }
}

function matchesSearch(cipher: CipherView, search: string): boolean {
  if (cipher.name?.toLowerCase().includes(search)) {
    return true;
  }
  if (cipher.subTitle?.toLowerCase().includes(search)) {
    return true;
  }
  return (cipher.login?.uris ?? []).some((u) => u.uri?.toLowerCase().includes(search));
}
