import { Observable, distinctUntilChanged, map, shareReplay, startWith, switchMap } from "rxjs";

import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import { BrowserApi } from "../platform/browser/browser-api";
import BrowserLocalStorageService from "../platform/services/browser-local-storage.service";

/**
 * Multiwarden: settings that only exist in Multiwarden. Stored in the extension's local storage,
 * shared by the background and the popup, and the same for every account.
 */
export type MultiwardenSettings = {
  /** Show the "All accounts" tab in the popup's bottom navigation. */
  showAllAccountsTab: boolean;
  /** Hide Premium upgrade callouts, spotlights and badges. */
  hidePremiumNotices: boolean;
  /** Pre-select the account last used on a site in the save-password prompt. */
  rememberSaveAccountPerSite: boolean;
};

export const DEFAULT_MULTIWARDEN_SETTINGS: MultiwardenSettings = Object.freeze({
  showAllAccountsTab: true,
  hidePremiumNotices: false,
  rememberSaveAccountPerSite: true,
});

const STORAGE_KEY = "multiwarden_settings";

let storage: BrowserLocalStorageService | undefined;
function localStore(): BrowserLocalStorageService {
  storage ??= new BrowserLocalStorageService(new ConsoleLogService(false));
  return storage;
}

export async function getMultiwardenSettings(): Promise<MultiwardenSettings> {
  try {
    const stored = await localStore().get<Partial<MultiwardenSettings>>(STORAGE_KEY);
    return { ...DEFAULT_MULTIWARDEN_SETTINGS, ...(stored ?? {}) };
  } catch {
    return { ...DEFAULT_MULTIWARDEN_SETTINGS };
  }
}

export async function updateMultiwardenSettings(
  changes: Partial<MultiwardenSettings>,
): Promise<MultiwardenSettings> {
  const next = { ...(await getMultiwardenSettings()), ...changes };
  await localStore().save(STORAGE_KEY, next);
  return next;
}

/** Emits the current settings, and again whenever they change in any extension context. */
export const multiwardenSettings$: Observable<MultiwardenSettings> = new Observable<void>(
  (subscriber) => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "local" && STORAGE_KEY in changes) {
        subscriber.next();
      }
    };
    BrowserApi.storageChangeListener(listener);
    return () => BrowserApi.removeListener(chrome.storage.onChanged, listener);
  },
).pipe(
  startWith(undefined),
  switchMap(() => getMultiwardenSettings()),
  shareReplay({ bufferSize: 1, refCount: true }),
);

export function multiwardenSetting$<K extends keyof MultiwardenSettings>(
  key: K,
): Observable<MultiwardenSettings[K]> {
  return multiwardenSettings$.pipe(
    map((settings) => settings[key]),
    distinctUntilChanged(),
  );
}
