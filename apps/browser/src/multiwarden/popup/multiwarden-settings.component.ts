import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MultiwardenAccount, MultiwardenCombinedService } from "@bitwarden/angular/multiwarden";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AvatarModule,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  IconModule,
  ItemModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

import { PopOutComponent } from "../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../platform/popup/layout/popup-page.component";
import {
  DEFAULT_MULTIWARDEN_SETTINGS,
  MultiwardenSettings,
  multiwardenSettings$,
  updateMultiwardenSettings,
} from "../multiwarden-settings";

/** Written into the build by multiwarden/scripts/brand-build.mjs. */
type MultiwardenBuildInfo = {
  version: string;
  bitwardenVersion: string;
  upstreamCommit: string;
  repository: string;
};

const REPOSITORY = "https://github.com/mteij/multiwarden";

/** Avatar colours offered per account: Bitwarden's five defaults plus three more. */
const AVATAR_COLORS = [
  "#175ddc",
  "#007c95",
  "#008236",
  "#8200db",
  "#c71800",
  "#c2255c",
  "#e67700",
  "#495057",
] as const;

/** Multiwarden: the extension's own settings page (Settings → Multiwarden). */
@Component({
  templateUrl: "multiwarden-settings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    AvatarModule,
    ButtonModule,
    ItemModule,
    IconModule,
    LinkModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    CheckboxModule,
    TypographyModule,
    FormFieldModule,
  ],
})
export class MultiwardenSettingsComponent {
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly combined = inject(MultiwardenCombinedService);
  private readonly accountService = inject(AccountService);
  private readonly avatarService = inject(AvatarService);
  private readonly logService = inject(LogService);

  protected readonly settings = toSignal(multiwardenSettings$, {
    initialValue: DEFAULT_MULTIWARDEN_SETTINGS,
  });
  protected readonly accounts = toSignal(this.combined.accounts$, { initialValue: [] });
  protected readonly colors = AVATAR_COLORS;
  protected readonly savingColorFor = signal<string | null>(null);
  protected readonly buildInfo = signal<MultiwardenBuildInfo | null>(null);
  protected readonly appVersion = signal<string>("");

  constructor() {
    void this.loadVersion();
  }

  private async loadVersion() {
    this.appVersion.set(await this.platformUtilsService.getApplicationVersion());
    try {
      const response = await fetch("/multiwarden.json");
      if (response.ok) {
        this.buildInfo.set((await response.json()) as MultiwardenBuildInfo);
      }
    } catch {
      // Development builds have no version file; the manifest version still shows.
    }
  }

  protected shortCommit(commit: string | undefined): string {
    return (commit ?? "").slice(0, 9);
  }

  protected async toggle(key: keyof MultiwardenSettings, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await updateMultiwardenSettings({ [key]: checked });
  }

  protected open(path: "" | "releases" | "issues" | "upstream") {
    const repository = this.buildInfo()?.repository ?? REPOSITORY;
    const commit = this.buildInfo()?.upstreamCommit;
    const url =
      path === "upstream"
        ? `https://github.com/bitwarden/clients/commit/${commit}`
        : path === ""
          ? repository
          : `${repository}/${path}`;
    this.platformUtilsService.launchUri(url);
  }

  /**
   * Bitwarden saves the avatar colour of the active account on the server. To change another
   * unlocked account's colour, make it active for a moment and then switch back.
   */
  protected async setColor(account: MultiwardenAccount, color: string) {
    if (!account.unlocked || this.savingColorFor()) {
      return;
    }
    this.savingColorFor.set(account.userId);
    const previous = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    try {
      await this.combined.activate(account.userId);
      await this.avatarService.setAvatarColor(color);
    } catch (e) {
      this.logService.error("Multiwarden: could not change the avatar colour", e);
    } finally {
      if (previous && previous !== account.userId) {
        await this.combined.activate(previous);
      }
      this.savingColorFor.set(null);
    }
  }
}
