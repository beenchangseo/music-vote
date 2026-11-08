import { isUuidFormat } from "./uuid";

export function parseLabUserIds(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim().toLowerCase())
      .filter(isUuidFormat),
  );
}

export function canOpenLab(userId: string | null, allowed: ReadonlySet<string>): boolean {
  return userId !== null && allowed.has(userId.toLowerCase());
}
