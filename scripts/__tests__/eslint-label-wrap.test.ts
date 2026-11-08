import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const eslint = new ESLint({ cwd });

async function syntaxErrors(code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${cwd}/src/components/LintFixture.tsx` });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax").map((m) => m.message);
}

// #79: "＋ 새 플레이리스트" wrapped to two lines inside a 52px button on a 390px iPhone. The primitives keep labels on one
// line; these are the two ways a call site could take that back.
describe("eslint label-wrap rules", () => {
  it.each([
    '<Button className="whitespace-normal" />',
    '<Button className="mt-2 text-balance" />',
    '<Button className="sm:text-wrap" />',
    '<Chip className="whitespace-pre-line" />',
    '<Badge className="text-pretty" />',
    '<Link href="/" className={buttonClassName({ variant: "tonal", className: "whitespace-normal" })} />',
  ])("flags a utility that lets the label wrap in %s", async (code) => {
    const errors = await syntaxErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("한 줄");
  });

  it.each([
    '<div className="flex gap-2 *:min-w-0 *:flex-1"><Button>취소</Button><Button>삭제</Button></div>',
    '<div className="flex [&>*]:min-w-0"><Button>취소</Button></div>',
    '<div className="grid *:max-w-32"><ToolbarButton label="편집" /></div>',
    '<div className="flex *:min-w-0"><Link href="/" className={buttonClassName({ variant: "tonal" })}>홈으로</Link></div>',
    '<div className="flex [&>button]:min-w-0"><Button>취소</Button></div>',
    '<div className="flex *:min-w-0">{open && <Button>취소</Button>}</div>',
    '<div className="flex *:min-w-0">{bands.map((band) => <Button key={band.id}>{band.name}</Button>)}</div>',
    // ** and [&_*] reach every descendant, so a button any depth down shrinks.
    '<div className="**:min-w-0"><section><Button>취소</Button></section></div>',
    '<div className="[&_*]:max-w-40"><p><span><Button>취소</Button></span></p></div>',
  ])("flags a row that lets its buttons shrink under their labels in %s", async (code) => {
    const errors = await syntaxErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ButtonGroup");
  });

  // A link's label has no shrinking cell like Button's, so in a ButtonGroup its min-width is the whole band name and it
  // runs past the screen (measured in Chromium and WebKit). A Button with the same label truncates at the row.
  it.each([
    '<ButtonGroup><Link href="/" className={buttonClassName({ variant: "tonal" })}><span className="truncate">{band.name}</span>에 넣기</Link><Button>취소</Button></ButtonGroup>',
    '<ButtonGroup>{open && <Link href="/" className={buttonClassName()}><span className="block truncate">{band.name}</span></Link>}</ButtonGroup>',
  ])("flags a truncating link in a ButtonGroup in %s", async (code) => {
    const errors = await syntaxErrors(code);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("ButtonGroup");
    expect(errors[0]).toContain("truncate");
  });

  it("keeps ButtonGroup's own sizing out of its className", async () => {
    const errors = await syntaxErrors('<ButtonGroup className="*:min-w-0"><Button>취소</Button></ButtonGroup>');
    expect(errors.some((message) => message.includes("size·variant prop"))).toBe(true);
  });

  it.each([
    '<Button className="mt-3 shrink-0" />',
    '<Badge className="max-w-18 truncate" />',
    '<ButtonGroup className="mt-5"><Button>취소</Button><Button>삭제</Button></ButtonGroup>',
    '<ButtonGroup><Button variant="tonal"><span className="flex min-w-0"><span className="truncate">{band.name}</span>에 넣기</span></Button><Button>취소</Button></ButtonGroup>',
    '<div className="mt-2"><Link href="/" className={buttonClassName({ variant: "tonal" })}><span className="truncate">{band.name}</span>에 넣기</Link></div>',
    '<div className="flex *:min-w-0"><span className="truncate">긴 제목</span></div>',
    // * and [&>…] reach only the direct children; a button further down keeps its width.
    '<main className="grid *:min-w-0"><section><div><Button>취소</Button></div></section></main>',
    '<div className="flex [&>*]:min-w-0"><div className="flex gap-2"><Button>취소</Button></div></div>',
    '<p className="whitespace-pre-line text-sm">줄바꿈이 있는 안내</p>',
  ])("allows %s", async (code) => {
    expect(await syntaxErrors(code)).toEqual([]);
  });
});
