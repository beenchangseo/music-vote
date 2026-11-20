import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gaCampaign } from "@/domain/google-analytics";
import { gtmContainer, readEventMap } from "../gtm-container.mjs";

const ROOT = join(__dirname, "..", "..");
const ANALYTICS = readFileSync(join(ROOT, "src", "lib", "analytics.ts"), "utf8");
const CONTAINER_FILE = join(ROOT, "docs", "analytics", "gtm-container.json");

type Parameter = { type: string; key?: string; value?: string; list?: Parameter[]; map?: Parameter[] };
type Entity = {
  name: string;
  type: string;
  parameter?: Parameter[];
  firingTriggerId?: string[];
  setupTag?: { tagName: string; stopOnSetupFailure: boolean }[];
};
type Container = {
  exportFormatVersion: number;
  containerVersion: {
    tag: (Entity & { tagId: string })[];
    trigger: (Entity & { triggerId: string; customEventFilter: { type: string; parameter: Parameter[] }[] })[];
    variable: (Entity & { variableId: string })[];
    builtInVariable: { type: string; name: string }[];
  };
};

const container: Container = JSON.parse(readFileSync(CONTAINER_FILE, "utf8"));
const { tag: tags, trigger: triggers, variable: variables } = container.containerVersion;

function param(entity: { parameter?: Parameter[] }, key: string) {
  return entity.parameter?.find((p) => p.key === key);
}

/** A GA4 settings table as [parameter, value] pairs. */
function table(entity: Entity, key: string): [string, string][] {
  return (param(entity, key)?.list ?? []).map((row) => {
    const cell = (name: string) => row.map?.find((p) => p.key === name)?.value ?? "";
    return [cell("parameter"), cell("parameterValue")];
  });
}

/** The data layer key a `{{variable}}` reference reads, or null when it is no Data Layer Variable. */
function dataLayerKey(reference: string) {
  const variable = variables.find((v) => `{{${v.name}}}` === reference);
  return variable?.type === "v" ? (param(variable, "name")?.value ?? null) : null;
}

function triggerOf(entity: Entity) {
  return triggers.filter((t) => entity.firingTriggerId?.includes(t.triggerId));
}

const eventMap = readEventMap(ANALYTICS);
const INITIALIZATION = "2147479573";
const googleTag = tags.find((t) => t.type === "googtag" && t.firingTriggerId?.includes(INITIALIZATION))!;
const updateTag = tags.find((t) => t.type === "googtag" && !t.firingTriggerId)!;
const pageViewTag = tags.find((t) => t.type === "gaawe" && param(t, "eventName")?.value === "page_view")!;
const appEventTag = tags.find((t) => t.type === "gaawe" && param(t, "eventName")?.value === "{{Event}}")!;

describe("readEventMap", () => {
  it("reads each event and its property names, comments and empty events included", () => {
    const source = `
      type EventMap = GaSafe<{
        /** A doc comment. */
        vote_cast: {
          vote_type: 1 | -1;
        };
        // A line comment.
        kakao_shared: { variant: ShareVariant; from: "a" | "b" };
        auth_logout: Record<string, never>;
      }>;
    `;

    expect(readEventMap(source)).toEqual({ vote_cast: ["vote_type"], kakao_shared: ["variant", "from"], auth_logout: [] });
  });

  it("refuses a shape it cannot read rather than drop an event", () => {
    expect(() => readEventMap("type EventMap = GaSafe<{ odd: SomeAlias }>;")).toThrow(/odd/);
    expect(() => readEventMap("type Other = {};")).toThrow(/EventMap/);
  });
});

describe("docs/analytics/gtm-container.json", () => {
  it("is what scripts/gtm-container.mjs writes from today's EventMap (rerun it after changing EventMap)", () => {
    expect(container).toEqual(gtmContainer(eventMap));
  });

  it("is a GTM container export GTM can import", () => {
    expect(container.exportFormatVersion).toBe(2);
    expect(container.containerVersion.builtInVariable).toEqual([expect.objectContaining({ type: "EVENT", name: "Event" })]);
    // Every {{reference}} resolves to a variable in the file or the built-in Event variable.
    const names = new Set([...variables.map((v) => v.name), "Event", "_event"]);
    for (const [, name] of JSON.stringify(container).matchAll(/\{\{([^}]+)\}\}/g)) expect(names, name).toContain(name);
    for (const kind of [tags.map((t) => t.tagId), triggers.map((t) => t.triggerId), variables.map((v) => v.variableId)]) {
      expect(new Set(kind).size).toBe(kind.length);
    }
    for (const v of variables.filter((v) => v.type === "v")) expect(param(v, "dataLayerVersion")?.value, v.name).toBe("2");
  });

  it("fires the app event tag on exactly the EventMap names, with every EventMap param mapped", () => {
    const [trigger] = triggerOf(appEventTag);
    expect(trigger.type).toBe("CUSTOM_EVENT");
    const [filter] = trigger.customEventFilter;
    expect(filter.type).toBe("MATCH_REGEX");
    const pattern = filter.parameter.find((p) => p.key === "arg1")!.value!;
    expect(pattern).toMatch(/^\^\(.*\)\$$/);
    expect(pattern.slice(2, -2).split("|")).toEqual(Object.keys(eventMap));
    expect(new RegExp(pattern).test("plypick_page_view")).toBe(false);

    const params = new Set(Object.values(eventMap).flat());
    const mapped = table(appEventTag, "eventSettingsTable");
    expect(mapped.map(([name]) => name)).toEqual([...params]);
    for (const [name, value] of mapped) expect(dataLayerKey(value), name).toBe(`event_params.${name}`);
  });

  it("sends GA only the masked page fields GoogleTagManager pushes, never GTM's own Page URL, Title or Referrer", () => {
    const campaign = Object.keys(gaCampaign("?utm_source=kakao&utm_medium=share&variant=playlist"));
    const page = ["page_location", "page_title", "page_referrer"];

    expect(triggerOf(pageViewTag).map((t) => t.customEventFilter[0].parameter.map((p) => p.value))).toEqual([
      ["{{_event}}", "plypick_page_view"],
    ]);
    expect(table(pageViewTag, "eventSettingsTable").map(([name, value]) => [name, dataLayerKey(value)])).toEqual(
      [...page, ...campaign].map((key) => [key, key]),
    );
    // GA4's own hits (user_engagement) read the Google tag's config, which the update tag moves to each new page first.
    expect(pageViewTag.setupTag).toEqual([{ tagName: updateTag.name, stopOnSetupFailure: false }]);
    const update = Object.fromEntries(table(updateTag, "configSettingsTable"));
    expect(update.update).toBe("true");
    expect(page.map((key) => dataLayerKey(update[key]))).toEqual(page);
    expect(param(updateTag, "tagId")?.value).toBe(param(googleTag, "tagId")?.value);
    expect(JSON.stringify(container)).not.toMatch(/\{\{(Page URL|Page Path|Page Hostname|Page Title|Referrer|Click URL)\}\}/);
  });

  it("configures the Google tag on Initialization with no automatic page view and no ads signals", () => {
    expect(googleTag.firingTriggerId).toEqual([INITIALIZATION]);
    expect(param(googleTag, "tagId")?.value).toBe("{{GA4 측정 ID}}");
    const config = Object.fromEntries(table(googleTag, "configSettingsTable"));
    expect(config).toMatchObject({ send_page_view: "false", allow_google_signals: "false", allow_ad_personalization_signals: "false" });
    expect(["page_location", "page_title", "page_referrer"].map((key) => dataLayerKey(config[key]))).toEqual([
      "page_location",
      "page_title",
      "page_referrer",
    ]);
    for (const tag of [pageViewTag, appEventTag]) expect(param(tag, "measurementIdOverride")?.value).toBe("{{GA4 측정 ID}}");
    const measurementId = variables.find((v) => v.name === "GA4 측정 ID")!;
    expect([measurementId.type, param(measurementId, "value")?.value]).toEqual(["c", "G-XXXXXXXXXX"]);
  });
});
