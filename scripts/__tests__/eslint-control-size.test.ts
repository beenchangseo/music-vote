import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

async function controlSizeErrors(code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/src/components/LintFixture.tsx` });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax").map((m) => m.message);
}

describe("eslint control-size rule", () => {
  it.each([
    '<Button size="sm" className="min-h-11 min-w-11" />',
    '<Button className="shrink-0 h-9" />',
    '<Button className="w-full" />',
    '<Button className="max-sm:px-0" />',
    '<Button className="rounded-pill" />',
    '<Button className="text-caption" />',
    '<IconButton aria-label="x" className="p-2" />',
    '<IconButton aria-label="x" className="size-9" />',
    '<Chip className="rounded" />',
    '<Chip className="py-1 text-xs" />',
    "<Button className={`${extra} !px-2`} />",
    '<Button className={wide ? "max-w-40" : undefined} />',
    '<Link href="/" className={buttonClassName({ variant: "tonal", className: "h-9" })} />',
    '<ListRowButton onClick={f} className="px-2" />',
    '<ListRowButton className="min-w-0 flex-1" />',
    '<ListRowLink href="/" className="px-1" />',
  ])("flags %s", async (code) => {
    const errors = await controlSizeErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("size·variant prop");
  });

  it.each([
    '<Button className="mt-3 shrink-0 flex-1" />',
    '<Button className="hidden sm:inline-flex self-end order-last" />',
    '<IconButton aria-label="x" className="-mr-2 absolute right-2 top-2" />',
    '<Chip className="text-text-muted" />',
    "<Button className={`${extra} mx-auto`} />",
    '<button className="h-11 px-3 rounded-control text-sm" />',
    '<Badge className="max-w-18 truncate" />',
    '<Link href="/" className={buttonClassName({ variant: "tonal", className: "mt-4" })} />',
    '<ListRowButton className="mt-2 flex-1" />',
  ])("allows %s", async (code) => {
    expect(await controlSizeErrors(code)).toEqual([]);
  });
});

async function rawControlErrors(code: string, file = "src/components/LintFixture.tsx") {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/${file}` });
  return result.messages.filter((m) => m.ruleId === "ds/no-raw-control").map((m) => m.message);
}

describe("eslint ds/no-raw-control rule", () => {
  it.each([
    ['<button className="h-11 px-3 rounded-control text-sm" />', "h-11 px-3 rounded-control text-sm"],
    ['<button className="text-[10px] text-text-subtle hover:text-text-muted" />', "text-[10px]"],
    ['<button className="max-sm:px-0 inline-flex" />', "max-sm:px-0"],
    ['<button className={`inline-flex ${open ? "h-12" : "h-11"} rounded-pill`} />', "rounded-pill h-12 h-11"],
    ['const round = "inline-flex h-11 w-11 rounded-pill";\nconst X = () => <button className={round} />;', "h-11 rounded-pill"],
    ['<button className={`${buttonClassName({ variant: "tonal" })} h-9`} />', "h-9"],
  ])("flags the hand-drawn <button> in %s", async (code, classes) => {
    const errors = await rawControlErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(`<button className="${classes}">`);
  });

  it.each([
    '<Link href="/" className="inline-flex items-center h-11 px-6 rounded-xl bg-primary text-white" />',
    '<a href="/x" aria-label="홈" className="inline-flex h-11 w-11 items-center rounded-pill hover:bg-surface-hover" />',
    '<a href="/x" className="p-2 rounded-xl bg-surface border border-border" />',
    '<Link href="/" className="block rounded-card bg-surface p-4" />',
    '<Link href="/" className="flex min-h-row items-center gap-3 bg-surface hover:bg-surface-hover" />',
  ])("flags the hand-drawn link in %s and names the ui shape for buttons, rows and cards", async (code) => {
    const errors = await rawControlErrors(code);
    expect(errors).toHaveLength(1);
    for (const shape of ["buttonClassName({ variant, size })", "ListRowLink", "Card"]) expect(errors[0]).toContain(shape);
  });

  it.each([
    '<button type="button" onClick={f} />',
    '<button type="button" className="group absolute inset-0" />',
    '<button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" />',
    '<button type="button" className="group block w-full text-left" />',
    '<button className={buttonClassName({ variant: "ghost", size: "sm" })} />',
    "<button className={className} />",
    '<Button size="sm" className="mt-3" />',
    '<Link href="/" className={buttonClassName({ variant: "tonal", size: "md" })} />',
    '<a href="/x" className={buttonClassName({ variant: "kakao", size: "lg", fullWidth: true })} />',
    '<a href="/guide" className="inline-flex min-h-11 items-center text-sm text-text-subtle hover:text-text-muted" />',
    '<Link href="/" className="block rounded-card p-4" />',
  ])("allows %s", async (code) => {
    expect(await rawControlErrors(code)).toEqual([]);
  });

  it.each(["src/components/ui/LintFixture.tsx", "src/components/playlist/__tests__/LintFixture.test.tsx"])(
    "leaves raw controls in %s alone",
    async (file) => {
      expect(await rawControlErrors('<button className="h-11 px-3 rounded-control text-sm" />', file)).toEqual([]);
    },
  );
});

describe("eslint RoundButton rules", () => {
  const round = (attrs: string, children = "") => `<RoundButton size="md" tone="plain" aria-label="x"${attrs}>${children}</RoundButton>`;

  it.each([
    [round(' className="size-12"'), "size·variant prop"],
    ['<RoundLink href="/" size="md" tone="ghost" aria-label="x" className="h-12" />', "size·variant prop"],
    ['<RoundRow className="px-2" />', "size·variant prop"],
    [round(' className="text-primary-fg"'), "tone"],
    [round(' className="shadow-lg"'), "tone"],
    [round(' className="-ml-2.5"'), "edge"],
    [round(' className="ml-[3px]"'), "edge"],
    [round(' className="font-normal"'), "tone"],
    ['<RoundLink href="/" size="lg" tone="tonal" aria-label="x" className="hover:bg-surface-elevated" />', "tone"],
    [round("", '<ChevronIcon direction="up" className="h-5 w-5" />'), "글리프의 크기와 자리"],
    [round("", '<PlayPauseIcon playing={false} className="ml-1" />'), "PlayPauseIcon"],
    [round("", '{on ? <ShuffleIcon className="size-5" /> : <span>-</span>}'), "글리프의 크기와 자리"],
    [round("", '<SkipIcon direction="next" className="scale-125" />'), "글리프의 크기와 자리"],
    [round("", '<MoreIcon className="p-1" />'), "글리프의 크기와 자리"],
    [round("", '<span><CloseIcon className="size-4" /></span>'), "글리프의 크기와 자리"],
    ['<RoundLink href="/" size="md" tone="ghost" aria-label="x"><ChevronIcon direction="left" className="-ml-1" /></RoundLink>', "글리프의 크기와 자리"],
  ])("flags %s", async (code, says) => {
    const errors = await controlSizeErrors(code);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toContain(says);
  });

  it.each([
    round(' className="mt-3 shrink-0"'),
    round("", '<NoticeIcon className="text-primary-fg" />'),
    round("", '<ShuffleIcon /><span className="absolute right-0.5 top-0.5 size-3 rounded-pill bg-primary" />'),
    '<RoundRow className="mt-5" />',
    '<ChevronIcon direction="up" className="h-5 w-5 ml-1" />',
  ])("allows %s", async (code) => {
    expect(await controlSizeErrors(code)).toEqual([]);
  });
});
