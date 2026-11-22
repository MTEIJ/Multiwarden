import { ChangeDetectionStrategy, Component } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  CardComponent,
  CheckboxModule,
  FormFieldModule,
  ItemModule,
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
    ItemModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    CheckboxModule,
    TypographyModule,
    FormFieldModule,
  ],
})
export class MultiwardenSettingsComponent {
  protected readonly settings = toSignal(multiwardenSettings$, {
    initialValue: DEFAULT_MULTIWARDEN_SETTINGS,
  });

  protected async toggle(key: keyof MultiwardenSettings, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    await updateMultiwardenSettings({ [key]: checked });
  }
}
