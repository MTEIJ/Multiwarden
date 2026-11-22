#!/usr/bin/env node
/**
 * Multiwarden branding, applied to a finished extension build.
 *
 * Branding is done after the build, not in Bitwarden's source files, so that upstream
 * changes to locales, manifests and images never conflict with Multiwarden's.
 *
 * Usage: node multiwarden/scripts/brand-build.mjs [buildDir]
 *   buildDir defaults to apps/browser/build
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const buildDir = resolve(process.argv[2] ?? join(root, "apps/browser/build"));
const iconsDir = join(root, "multiwarden/branding/icons");

const NAME = "Multiwarden";
// Chrome limits: name <= 45 chars, description <= 132 chars.
const EXT_NAME = "Multiwarden: multi-account vaults";
const EXT_DESC =
  "Unofficial fork of the Bitwarden extension: use several Bitwarden accounts at once for autofill, saving and passkeys.";
const HOMEPAGE = "https://github.com/mteij/multiwarden";

if (!existsSync(join(buildDir, "manifest.json"))) {
  console.error(`No manifest.json in ${buildDir}. Build the extension first.`);
  process.exit(1);
}

// 1. Manifest
const manifestPath = join(buildDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.short_name = NAME;
manifest.author = "Multiwarden contributors";
manifest.homepage_url = HOMEPAGE;
if (manifest.action) {
  manifest.action.default_title = NAME;
}
if (manifest.browser_action) {
  manifest.browser_action.default_title = NAME;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// 2. Extension name and description, in every locale
const localesDir = join(buildDir, "_locales");
let locales = 0;
for (const locale of readdirSync(localesDir)) {
  const file = join(localesDir, locale, "messages.json");
  if (!existsSync(file)) {
    continue;
  }
  const messages = JSON.parse(readFileSync(file, "utf8"));
  messages.extName = { message: EXT_NAME };
  messages.extDesc = { message: EXT_DESC };
  writeFileSync(file, JSON.stringify(messages));
  locales++;
}

// 3. Icons: replace every icon variant with Multiwarden's original artwork
const imagesDir = join(buildDir, "images");
let icons = 0;
for (const target of readdirSync(imagesDir)) {
  const match = target.match(/^icon(\d+)(_gray|_locked)?(_beta)?\.png$/);
  if (!match) {
    continue;
  }
  const [, size, variant = ""] = match;
  const source = join(iconsDir, `icon${size}${variant}.png`);
  const fallback = join(iconsDir, `icon${size}.png`);
  const from = existsSync(source) ? source : fallback;
  if (existsSync(from)) {
    copyFileSync(from, join(imagesDir, target));
    icons++;
  }
}

console.log(`Branded ${buildDir}: manifest, ${locales} locales, ${icons} icons.`);
