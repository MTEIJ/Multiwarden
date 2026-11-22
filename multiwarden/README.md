# Multiwarden maintainer notes

Multiwarden is a fork of [bitwarden/clients](https://github.com/bitwarden/clients) that makes the
browser extension work with **several unlocked Bitwarden accounts at the same time**. This file
records exactly where Multiwarden differs from upstream, so that upstream syncs stay easy.

## Design rule: hooks, not rewrites

All new logic lives in Multiwarden-only files. Upstream files get small, commented hooks that
call into them. Every hook is marked with a `Multiwarden:` comment, so
`git grep -n "Multiwarden:"` lists them all.

### Multiwarden-only files

| File                                                                                | What it does                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/common/src/multiwarden/multi-account-scope.ts`                                | Lists unlocked accounts (active account first), loads data from all of them, and remembers which account owns each cipher. Also holds the per-context registry (`registerMultiAccountScope` / `getMultiAccountScope`).          |
| `apps/browser/src/autofill/multiwarden/last-account.ts`                             | Remembers which account you last saved to for each site (hashed site keys).                                                                                                                                                     |
| `apps/browser/src/autofill/content/components/signals/selected-account.ts`          | State for the account selector in the save-password bar.                                                                                                                                                                        |
| `apps/browser/src/multiwarden/multiwarden-settings.ts`                              | Multiwarden's own settings, including `combinedMode` (extension local storage, shared by background and popup).                                                                                                                 |
| `apps/browser/src/multiwarden/popup/multiwarden-combined.service.ts`                | **Combined mode** in the popup: which accounts the vault shows, merging per-account lists, item owners, and quietly activating an item's account (`multiwardenActivateAccount` message) before Bitwarden's own code acts on it. |
| `apps/browser/src/multiwarden/popup/multiwarden-account-menu.component.*`           | Dropdown on the header avatar: Combined, each account, Manage accounts.                                                                                                                                                         |
| `apps/browser/src/multiwarden/popup/multiwarden-combined-item.component.ts`         | "Combined" entry on the account switcher page.                                                                                                                                                                                  |
| `apps/browser/src/multiwarden/popup/multiwarden-account-badge.component.ts`         | Account avatar on each vault row in combined mode. Its `data-multiwarden-cipher` attribute lets the combined service find the item behind any click in a row.                                                                   |
| `apps/browser/src/multiwarden/popup/multiwarden-vault-banner.component.ts`          | "Vault: account" banner on item and edit pages in combined mode.                                                                                                                                                                |
| `apps/browser/src/multiwarden/popup/multiwarden-choose-account-dialog.component.ts` | "Save to which vault?" dialog for new items in combined mode.                                                                                                                                                                   |
| `apps/browser/src/multiwarden/popup/multiwarden-guards.ts`                          | Route guards: activate an item's account before item pages open; ask for the vault before the new-item form.                                                                                                                    |
| `apps/browser/src/multiwarden/popup/multiwarden-settings.component.*`               | Settings → Multiwarden page.                                                                                                                                                                                                    |
| `apps/browser/src/multiwarden/popup/multiwarden-popup-settings.ts`                  | Applies settings page-wide in the popup (CSS that hides Premium notices).                                                                                                                                                       |
| `apps/browser/src/multiwarden/popup/multiwarden-logo.ts`                            | Header logo. Generated by `multiwarden/branding/generate-logo.py` (Open Sans, OFL).                                                                                                                                             |
| `multiwarden/`                                                                      | Branding (icons, logo, build script), translations, store material, sync bookkeeping.                                                                                                                                           |
| `.github/workflows/multiwarden-*.yml`                                               | Nightly upstream sync and the Multiwarden build/release.                                                                                                                                                                        |
| `.github/README.md`                                                                 | The repository front page (GitHub shows it instead of upstream's README).                                                                                                                                                       |

### Upstream files with hooks

| File                                                                                                                   | Hook                                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/browser/src/background/main.background.ts`                                                                       | Creates and registers the `MultiAccountScope`; passes it to the passkey authenticator.                                                           |
| `apps/browser/src/background/runtime.background.ts`                                                                    | `multiwardenActivateAccount` message: makes an unlocked account active without a full switch.                                                    |
| `apps/browser/src/autofill/background/overlay.background.ts`                                                           | Inline menu loads ciphers from every unlocked account and labels them; works while any account is unlocked.                                      |
| `apps/browser/src/autofill/services/autofill.service.ts`                                                               | Fill uses the owning account for premium (TOTP) checks and the last-used date.                                                                   |
| `apps/browser/src/autofill/background/autofill-orchestrator.ts`                                                        | Keyboard shortcut falls back to other unlocked accounts.                                                                                         |
| `apps/browser/src/autofill/background/notification.background.ts`                                                      | Save/update prompt across accounts; account picker; honours the "remember save account" setting.                                                 |
| `apps/browser/src/autofill/background/abstractions/notification.background.ts`                                         | Types for the new bar messages.                                                                                                                  |
| `apps/browser/src/autofill/notification/bar.ts`, `.../content/components/notification/button-row.ts`                   | Account selector in the save-password bar.                                                                                                       |
| `libs/common/src/platform/services/fido2/fido2-authenticator.service.ts`, `fido2-client.service.ts`                    | Passkeys across all unlocked accounts.                                                                                                           |
| `apps/browser/src/autofill/fido2/services/browser-fido2-user-interface.service.ts`                                     | Passkey prompts accept any unlocked account.                                                                                                     |
| `apps/browser/src/autofill/popup/fido2/fido2.component.{ts,html}`, `fido2-cipher-row.component.{ts,html}`              | Passkey popup: account labels and "Save to account" picker.                                                                                      |
| `apps/browser/src/vault/popup/services/vault-popup-items.service.ts`                                                   | Vault list ciphers, organizations and collections come from `MultiwardenCombinedService.mergeForUsers` (all unlocked accounts in combined mode). |
| `apps/browser/src/vault/popup/components/vault/vault-list-items-container/*`, `vault-popup-list-table/*`               | Account badge on each row.                                                                                                                       |
| `apps/browser/src/vault/popup/components/vault/view/*`, `add-edit/*`                                                   | Vault banner.                                                                                                                                    |
| `apps/browser/src/auth/popup/account-switching/current-account.component.*`                                            | Header avatar is the Multiwarden account dropdown.                                                                                               |
| `apps/browser/src/auth/popup/account-switching/account-switcher.component.*`, `account.component.ts`                   | "Combined" entry; choosing a single account leaves combined mode.                                                                                |
| `apps/browser/src/popup/app-routing.module.ts`                                                                         | `/multiwarden-settings` route; Multiwarden guards on item and add routes.                                                                        |
| `apps/browser/src/popup/app.component.ts`                                                                              | Calls `applyMultiwardenPopupSettings()` on start-up.                                                                                             |
| `apps/browser/src/platform/popup/layout/popup-header.component.ts`, `popup/components/extension-anon-layout-wrapper/*` | Multiwarden logo instead of the Bitwarden logo.                                                                                                  |
| `apps/browser/src/tools/popup/settings/settings-v2.component.html`                                                     | "Multiwarden" entry in Settings; `data-multiwarden-premium` on the Premium callout.                                                              |
| `apps/browser/src/vault/popup/components/vault/vault.component.html`                                                   | `data-multiwarden-premium` on the Premium spotlight.                                                                                             |
| `apps/browser/src/_locales/en/messages.json`                                                                           | `multiwarden*` strings (appended at the end). Translations live in `multiwarden/locales/` and are merged in at build time.                       |

Branding is **not** done in upstream files: `multiwarden/scripts/brand-build.mjs` rewrites the
built extension's name, description, manifest fields and icons after the build.

## Staying in sync with upstream

- `multiwarden/upstream-commit` holds the last upstream commit Multiwarden includes.
- `.github/workflows/multiwarden-upstream-sync.yml` runs nightly (or on demand from the Actions
  tab). It applies upstream's changes since that commit with a 3-way merge and opens a PR.
  - Clean: CI builds and tests it; merge it.
  - `[conflicts]` PR: conflict markers are committed on the branch. Fix them with the hook table
    above as a guide, push, and merge.
- Manual sync, if you prefer:

  ```bash
  git remote add upstream https://github.com/bitwarden/clients.git   # once
  git fetch upstream main
  git diff --binary "$(cat multiwarden/upstream-commit)" upstream/main | git apply --3way --index
  git rev-parse upstream/main > multiwarden/upstream-commit
  ```

## Building

```bash
npm ci || npm install
cd apps/browser
NODE_ENV=production BROWSER=chrome MANIFEST_VERSION=3 npx webpack   # open-source build only
cd ../..
node multiwarden/scripts/brand-build.mjs
(cd apps/browser/build && zip -qr ../../../multiwarden-chrome.zip .)
```

Only build the open-source target (`webpack`), never `build:bit:*`: those include code under
`bitwarden_license/`, which is not GPL and may not be redistributed.

Pushing a tag like `v2026.11.0-mw1` makes the CI workflow publish a GitHub release with the zip.

## Combined mode

Choose **Combined** in the header avatar's dropdown (or on the account page) to see every
unlocked account's vault at once. Bitwarden's own pages and menus act on "the active account",
so Multiwarden keeps them working by quietly making an item's account active (no sync, no
navigation) whenever you press or focus its row, open one of its pages, or pick a vault for a
new item. Combined mode stays on until you choose a single account.

## Settings (Settings → Multiwarden)

| Setting                            | Default | Effect                                                                                                                                                       |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Combined view                      | off     | Same as choosing "Combined" in the account dropdown.                                                                                                         |
| Remember the save account per site | on      | The save-password prompt pre-selects the account last used on that site.                                                                                     |
| Hide Premium notices               | off     | Hides `app-premium-badge`, `billing-premium-upgrade-nudge` and anything marked `data-multiwarden-premium`. To hide another upsell, add that attribute to it. |

## Translations

Every `multiwarden*` string is added to all of the extension's languages at build time
(`multiwarden/scripts/brand-build.mjs`): the English text first, then `multiwarden/locales/<locale>.json`
if it exists. Edit the English text in `apps/browser/src/_locales/en/messages.json` and the
translations in `multiwarden/locales/`.

## Known limits

- Autofill on page load stays tied to the active account, so a page never gets filled from an
  account you didn't pick.
- "New item" pages, the vault list and settings in the popup still show the active account, as in
  upstream. When Multiwarden needs one of those pages for another account (for example "Edit"
  from the save bar), it switches the active account first.
- The context menu and the toolbar badge count still use the active account only.
- In combined mode the folder, collection and organization filters show the active account's
  folders, collections and organizations. Pick a single account in the dropdown to filter by
  another account's folders.
- Generator, Send and Settings work on the account that is active underneath combined mode.
