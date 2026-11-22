# Multiwarden maintainer notes

Multiwarden is a fork of [bitwarden/clients](https://github.com/bitwarden/clients) that makes the
browser extension work with **several unlocked Bitwarden accounts at the same time**. This file
records exactly where Multiwarden differs from upstream, so that upstream syncs stay easy.

## Design rule: hooks, not rewrites

All new logic lives in Multiwarden-only files. Upstream files get small, commented hooks that
call into them. Every hook is marked with a `Multiwarden:` comment, so
`git grep -n "Multiwarden:"` lists them all.

### Multiwarden-only files

| File                                                                       | What it does                                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/common/src/multiwarden/multi-account-scope.ts`                       | Lists unlocked accounts (active account first), loads data from all of them, and remembers which account owns each cipher. Also holds the per-context registry (`registerMultiAccountScope` / `getMultiAccountScope`). |
| `libs/common/src/multiwarden/multi-account-scope.spec.ts`                  | Tests for the above.                                                                                                                                                                                                   |
| `apps/browser/src/autofill/multiwarden/last-account.ts`                    | Remembers which account you last saved to for each site (hashed site keys), used as the default in account pickers.                                                                                                    |
| `apps/browser/src/autofill/content/components/signals/selected-account.ts` | State for the account selector in the save-password bar.                                                                                                                                                               |
| `multiwarden/`                                                             | Branding (icons, build script), Chrome Web Store material, sync bookkeeping.                                                                                                                                           |
| `.github/workflows/multiwarden-*.yml`                                      | Nightly upstream sync and the Multiwarden build/release.                                                                                                                                                               |
| `.github/README.md`                                                        | The repository front page (GitHub shows it instead of upstream's README).                                                                                                                                              |

### Upstream files with hooks

| File                                                                               | Hook                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/browser/src/background/main.background.ts`                                   | Creates and registers the `MultiAccountScope`; passes it to the passkey authenticator.                                                                                           |
| `apps/browser/src/autofill/background/overlay.background.ts`                       | Inline menu loads ciphers from every unlocked account and labels them with the account email; menu works while any account is unlocked.                                          |
| `apps/browser/src/autofill/services/autofill.service.ts`                           | Fill uses the owning account for premium (TOTP) checks and the last-used date.                                                                                                   |
| `apps/browser/src/autofill/background/autofill-orchestrator.ts`                    | Keyboard shortcut falls back to other unlocked accounts when the active one has no match.                                                                                        |
| `apps/browser/src/autofill/background/notification.background.ts`                  | Save/update prompt: matches logins across all accounts, updates go to the owning account, new logins go to the account picked in the bar; opens edit pages in the right account. |
| `apps/browser/src/autofill/background/abstractions/notification.background.ts`     | Types for the two new bar messages.                                                                                                                                              |
| `apps/browser/src/autofill/notification/bar.ts`                                    | Asks for unlocked accounts, renders the account selector, reloads folders/vaults when the account changes, sends the chosen account with save.                                   |
| `apps/browser/src/autofill/content/components/notification/button-row.ts`          | Account selector next to the vault/folder selectors.                                                                                                                             |
| `libs/common/src/platform/services/fido2/fido2-authenticator.service.ts`           | Passkey lookup, creation and counter updates span all unlocked accounts (optional constructor argument; upstream behaviour without it).                                          |
| `libs/common/src/platform/services/fido2/fido2-client.service.ts`                  | Conditional (autofill-style) passkey requests work while any account is unlocked.                                                                                                |
| `apps/browser/src/autofill/fido2/services/browser-fido2-user-interface.service.ts` | Passkey prompts don't ask to unlock when another account is already unlocked.                                                                                                    |
| `apps/browser/src/autofill/popup/fido2/fido2.component.{ts,html}`                  | Passkey popup lists items from every account with account labels, and has a "Save to account" picker for new passkeys.                                                           |
| `apps/browser/src/autofill/popup/fido2/fido2-cipher-row.component.{ts,html}`       | Optional account label under each item.                                                                                                                                          |
| `apps/browser/src/_locales/en/messages.json`                                       | Three `multiwarden*` strings (appended at the end).                                                                                                                              |

Branding is **not** done in upstream files: `multiwarden/scripts/brand-build.mjs` rewrites the
built extension's name, description, manifest fields and icons after the build.

## Staying in sync with upstream

- `multiwarden/UPSTREAM_COMMIT` holds the last upstream commit Multiwarden includes.
- `.github/workflows/multiwarden-upstream-sync.yml` runs nightly (or on demand from the Actions
  tab). It applies upstream's changes since that commit with a 3-way merge and opens a PR.
  - Clean: CI builds and tests it; merge it.
  - `[conflicts]` PR: conflict markers are committed on the branch. Fix them with the hook table
    above as a guide, push, and merge.
- Manual sync, if you prefer:

  ```bash
  git remote add upstream https://github.com/bitwarden/clients.git   # once
  git fetch upstream main
  git diff --binary "$(cat multiwarden/UPSTREAM_COMMIT)" upstream/main | git apply --3way --index
  git rev-parse upstream/main > multiwarden/UPSTREAM_COMMIT
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

## Settings (Settings → Multiwarden)

| Setting                            | Default | Effect                                                                                                                                                       |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Show the "All accounts" tab        | on      | Bottom-navigation tab with every unlocked account's items.                                                                                                   |
| Remember the save account per site | on      | The save-password prompt pre-selects the account last used on that site.                                                                                     |
| Hide Premium notices               | off     | Hides `app-premium-badge`, `billing-premium-upgrade-nudge` and anything marked `data-multiwarden-premium`. To hide another upsell, add that attribute to it. |

## Known limits

- Autofill on page load stays tied to the active account, so a page never gets filled from an
  account you didn't pick.
- "New item" pages, the vault list and settings in the popup still show the active account, as in
  upstream. When Multiwarden needs one of those pages for another account (for example "Edit"
  from the save bar), it switches the active account first.
- The context menu and the toolbar badge count still use the active account only.
- In the "All accounts" tab, items that need the master password and belong to another account
  open in that account (the re-prompt checks the active account's master password).
