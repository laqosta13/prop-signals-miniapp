const KEY = "prop_disclaimer_v2";

export function hasAcceptedDisclaimer(userId: number): boolean {
  try {
    return localStorage.getItem(`${KEY}:${userId}`) === "1";
  } catch {
    return false;
  }
}

export function markDisclaimerAccepted(userId: number): void {
  try {
    localStorage.setItem(`${KEY}:${userId}`, "1");
  } catch {
    /* private mode / quota */
  }
}
