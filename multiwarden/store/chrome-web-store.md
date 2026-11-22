# Publishing to the Chrome Web Store

Every Multiwarden release is uploaded to the Chrome Web Store and submitted for review by the
"Chrome Web Store" job in `.github/workflows/multiwarden-ci.yml`. The job does nothing until
the five secrets below are set, so releases on GitHub work without them.

## 1. First upload, by hand (once)

The Chrome Web Store API can't create a new listing, so the first version goes through the
Developer Dashboard:

1. Download `store-chrome-<version>.zip` from the artifacts of the latest Multiwarden CI run
   on `main` (Actions → Multiwarden CI → the run → Artifacts → `store-chrome`). Use this zip,
   not `multiwarden-chrome-<version>.zip` from the release: the release zip contains a
   manifest `key`, which the store refuses.
2. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), choose
   **New item** and upload the zip.
3. Fill in the **Store listing** and **Privacy** tabs from `listing.md` and
   `privacy-policy.md` in this folder, then submit it for review.
4. Note the item ID (32 letters, shown on the item's page) and your publisher ID (in the
   dashboard's **Account** section).

## 2. API credentials

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or use
   an existing one) and enable the **Chrome Web Store API**.
2. Under **APIs & Services → OAuth consent screen**, set up an External app and add your own
   Google account as a test user.
3. Under **APIs & Services → Credentials**, create an **OAuth client ID** of type
   **Desktop app**. Note the client ID and client secret.
4. Get a refresh token, for example in the
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground): open the settings
   cog, tick **Use your own OAuth credentials** and enter the client ID and secret, authorize
   the scope `https://www.googleapis.com/auth/chromewebstore` with the Google account that
   owns the listing, then choose **Exchange authorization code for tokens** and copy the
   refresh token.

Refresh tokens of an OAuth app in "Testing" status expire after 7 days. Publish the consent
screen ("In production") so the token keeps working; Google does not need to verify an app
that only you use.

## 3. GitHub secrets

In the repository, open **Settings → Secrets and variables → Actions** and add:

| Secret              | Value                           |
| ------------------- | ------------------------------- |
| `CWS_CLIENT_ID`     | OAuth client ID                 |
| `CWS_CLIENT_SECRET` | OAuth client secret             |
| `CWS_REFRESH_TOKEN` | Refresh token from step 2       |
| `CWS_PUBLISHER_ID`  | Publisher ID from the dashboard |
| `CWS_EXTENSION_ID`  | The store item's 32-letter ID   |

From then on, each release is uploaded and submitted for review automatically. The run's
summary says when a submission went in; Google's review usually takes a few days.

## Extension IDs

The GitHub builds (zips on the releases page, loaded unpacked) always have the ID
`geefkjbbjaipgadampajlkghfamlljll`, set by the public key in
`multiwarden/branding/extension-key.txt`. The store listing gets its own ID from Google.

To give GitHub builds the store's ID instead, so both kinds of install are the same extension,
copy the public key from the dashboard (the item → **Package** → **View public key**, without
the `BEGIN`/`END` lines and line breaks) into `extension-key.txt`. Unpacked installs then get a
new ID and start with empty storage, so do this before many people use the GitHub builds.
