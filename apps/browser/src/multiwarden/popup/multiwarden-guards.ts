import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { CenterPositionStrategy, DialogService } from "@bitwarden/components";

import { MultiwardenChooseAccountDialogComponent } from "./multiwarden-choose-account-dialog.component";
import { MultiwardenCombinedService } from "./multiwarden-combined.service";

/**
 * Multiwarden: before an item page (view, edit, clone, attachments, ...) opens in combined mode,
 * make the item's account active, so the page loads the item and its folders from that account.
 */
export const multiwardenCipherOwnerGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const cipherId = route.queryParamMap.get("cipherId");
  if (cipherId) {
    await inject(MultiwardenCombinedService).prepareFor(cipherId);
  }
  return true;
};

/**
 * Multiwarden: in combined mode, a new item first asks which account's vault it goes into, then
 * opens Bitwarden's normal form with that account active.
 */
export const multiwardenNewItemTargetGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
) => {
  const combined = inject(MultiwardenCombinedService);
  const dialogService = inject(DialogService);

  // Passkey and clone flows already know their account.
  if (route.queryParamMap.has("sessionId") || route.queryParamMap.has("cipherId")) {
    return true;
  }
  if (!(await firstValueFrom(combined.enabled$))) {
    return true;
  }
  const accounts = (await firstValueFrom(combined.accounts$)).filter((a) => a.unlocked);
  if (accounts.length < 2) {
    return true;
  }

  const dialogRef = dialogService.open<UserId | undefined>(
    MultiwardenChooseAccountDialogComponent,
    {
      positionStrategy: new CenterPositionStrategy(),
      data: { accounts },
    },
  );
  const userId = await firstValueFrom(dialogRef.closed);
  if (!userId) {
    return false;
  }
  await combined.activate(userId);
  return true;
};
