// Aggregated app-area translation dicts.
// Each feature file exports { pt, en } objects with flat keys.
// Add new feature files here so they get merged into the main resources.

import { dict as chat } from "./chat";
import { dict as status } from "./status";
import { dict as callProfile } from "./call-profile";
import { dict as appShell } from "./app-shell";

type Dict = Record<string, string>;

function merge(...parts: Array<Dict>): Dict {
  return Object.assign({}, ...parts);
}

export const APP_PT: Dict = merge(chat.pt, status.pt, callProfile.pt, appShell.pt);
export const APP_EN: Dict = merge(chat.en, status.en, callProfile.en, appShell.en);
