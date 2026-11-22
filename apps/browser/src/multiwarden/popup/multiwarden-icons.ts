import { svg } from "@bitwarden/assets/svg";

/** Multiwarden: bottom-navigation icons for the "All accounts" tab (two stacked vaults). */
export const AllAccountsInactive = svg`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path fill-rule="evenodd" clip-rule="evenodd" class="tw-fill-fg-body" d="M8 2h11a3 3 0 0 1 3 3v11a1 1 0 1 1-2 0V5a1 1 0 0 0-1-1H8a1 1 0 0 1 0-2Z"/>
    <path fill-rule="evenodd" clip-rule="evenodd" class="tw-fill-fg-body" d="M5 6h11a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5Z"/>
    <path fill-rule="evenodd" clip-rule="evenodd" class="tw-fill-fg-body" d="M10.5 11a2 2 0 0 1 1 3.73V17a1 1 0 1 1-2 0v-2.27a2 2 0 0 1 1-3.73Z"/>
  </svg>
`;

export const AllAccountsActive = svg`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path fill-rule="evenodd" clip-rule="evenodd" class="tw-fill-fg-brand" d="M8 2h11a3 3 0 0 1 3 3v11a1 1 0 1 1-2 0V5a1 1 0 0 0-1-1H8a1 1 0 0 1 0-2Z"/>
    <path fill-rule="evenodd" clip-rule="evenodd" class="tw-fill-fg-brand" d="M5 6h11a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Zm5.5 5a2 2 0 0 0-1 3.73V17a1 1 0 1 0 2 0v-2.27a2 2 0 0 0-1-3.73Z"/>
  </svg>
`;
