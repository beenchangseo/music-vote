#!/usr/bin/env node
// docs/analytics/gtm-container.json 을 src/lib/analytics.ts 의 EventMap 으로 다시 쓴다. EventMap 을 바꾸면 돌린다.
//
//   node scripts/gtm-container.mjs
//
// 파일은 GTM 의 관리 > 컨테이너 가져오기(병합)로 넣는 내보내기 형식(exportFormatVersion 2)이다. 쓰는 법은
// docs/analytics/README.md. GA4 태그는 GoogleTagManager 가 dataLayer 에 넣는 가린 값만 읽고, GTM 의 기본 제공 변수
// (Page URL·Page Title·Referrer)는 읽지 않는다. 그 변수들은 공유 코드가 든 진짜 주소와 플레이리스트 제목이다.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(root, "src", "lib", "analytics.ts");
const OUTPUT = join(root, "docs", "analytics", "gtm-container.json");

/** EventMap's events and their property names, in source order. Throws on a shape it cannot read. */
export function readEventMap(source) {
  const file = ts.createSourceFile("analytics.ts", source, ts.ScriptTarget.Latest, true);
  const alias = file.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === "EventMap");
  // type EventMap = GaSafe<{ … }>
  const literal = alias?.type && ts.isTypeReferenceNode(alias.type) ? alias.type.typeArguments?.[0] : undefined;
  if (!literal || !ts.isTypeLiteralNode(literal)) throw new Error("type EventMap = GaSafe<{ … }> 를 찾지 못했다");
  return Object.fromEntries(
    literal.members.map((member) => {
      const name = member.name?.getText(file);
      if (!ts.isPropertySignature(member) || !member.type) throw new Error(`EventMap 의 ${name} 을 읽지 못했다`);
      return [name, propertyNames(member.type, file, name)];
    }),
  );
}

function propertyNames(type, file, event) {
  if (ts.isTypeLiteralNode(type)) return type.members.map((m) => m.name.getText(file));
  // Record<string, never>: an event without properties.
  if (ts.isTypeReferenceNode(type) && type.getText(file).replace(/\s/g, "") === "Record<string,never>") return [];
  throw new Error(`EventMap 의 ${event} 속성 모양(${type.getText(file)})을 읽지 못했다. 객체 리터럴로 적거나 이 스크립트를 고친다`);
}

const PAGE_KEYS = ["page_location", "page_title", "page_referrer"];
// GaCampaign in src/domain/google-analytics.ts.
const CAMPAIGN_KEYS = ["campaign_source", "campaign_medium", "campaign_content"];
// GTM's built-in Initialization - All Pages trigger.
const INITIALIZATION_TRIGGER_ID = "2147479573";
const MEASUREMENT_ID = "GA4 측정 ID";

// The ids GTM writes in an export. Import keeps none of them and matches entities by name.
const ids = { accountId: "0", containerId: "0" };
const template = (key, value) => ({ type: "TEMPLATE", key, value });
const settings = (key, rows) => ({
  type: "LIST",
  key,
  list: rows.map(([name, value]) => ({
    type: "MAP",
    map: [template("parameter", name), template("parameterValue", value)],
  })),
});
const dlvName = (key) => `DLV - ${key}`;
const ref = (name) => `{{${name}}}`;
const fromDataLayer = (keys, prefix = "") => keys.map((key) => [key, ref(dlvName(prefix + key))]);

function dataLayerVariable(key, variableId) {
  return {
    ...ids,
    variableId,
    name: dlvName(key),
    type: "v",
    parameter: [
      { type: "INTEGER", key: "dataLayerVersion", value: "2" },
      { type: "BOOLEAN", key: "setDefaultValue", value: "false" },
      template("name", key),
    ],
    fingerprint: "0",
    formatValue: {},
  };
}

function customEvent(triggerId, name, type, value) {
  return {
    ...ids,
    triggerId,
    name,
    type: "CUSTOM_EVENT",
    customEventFilter: [{ type, parameter: [template("arg0", "{{_event}}"), template("arg1", value)] }],
    fingerprint: "0",
  };
}

/** A tag that fires on `triggerId`, or only as another tag's setup tag when it has none. */
function tag(tagId, name, type, parameter, triggerId, extra = {}) {
  return {
    ...ids,
    tagId,
    name,
    type,
    parameter,
    fingerprint: "0",
    ...(triggerId && { firingTriggerId: [triggerId] }),
    tagFiringOption: "ONCE_PER_EVENT",
    monitoringMetadata: { type: "MAP" },
    consentSettings: { consentStatus: "NOT_SET" },
    ...extra,
  };
}

function ga4Event(tagId, name, eventName, rows, triggerId, extra) {
  return tag(
    tagId,
    name,
    "gaawe",
    [
      { type: "BOOLEAN", key: "sendEcommerceData", value: "false" },
      { type: "BOOLEAN", key: "enhancedUserId", value: "false" },
      template("eventName", eventName),
      template("measurementIdOverride", ref(MEASUREMENT_ID)),
      settings("eventSettingsTable", rows),
    ],
    triggerId,
    extra,
  );
}

const googleTag = (tagId, name, rows, triggerId) =>
  tag(tagId, name, "googtag", [template("tagId", ref(MEASUREMENT_ID)), settings("configSettingsTable", rows)], triggerId);

/** The container export for an EventMap read by readEventMap. */
export function gtmContainer(eventMap) {
  const events = Object.keys(eventMap);
  const params = [...new Set(Object.values(eventMap).flat())];
  const dataLayerKeys = [...PAGE_KEYS, ...CAMPAIGN_KEYS, ...params.map((key) => `event_params.${key}`)];

  const variable = [
    { ...ids, variableId: "1", name: MEASUREMENT_ID, type: "c", parameter: [template("value", "G-XXXXXXXXXX")], fingerprint: "0", formatValue: {} },
    ...dataLayerKeys.map((key, i) => dataLayerVariable(key, String(i + 2))),
  ];
  const trigger = [
    customEvent("1", "CE - plypick_page_view", "EQUALS", "plypick_page_view"),
    // Anchored: GTM's regex match finds the pattern anywhere in the event name.
    customEvent("2", "CE - 앱 이벤트 (EventMap)", "MATCH_REGEX", `^(${events.join("|")})$`),
  ];
  // The page fields sit in the Google tag's config because GA4 sends hits of its own (user_engagement and the like)
  // that no event tag sets them on, and would fill them from the real URL and title. GoogleTagManager pushes them
  // before gtm.js, so the Initialization tag reads this page's.
  const UPDATE_TAG = "Google 태그 - 페이지 바뀜 (update)";
  const tags = [
    googleTag(
      "1",
      "Google 태그 - GA4",
      [
        ["send_page_view", "false"],
        ["allow_google_signals", "false"],
        ["allow_ad_personalization_signals", "false"],
        ...fromDataLayer(PAGE_KEYS),
      ],
      INITIALIZATION_TRIGGER_ID,
    ),
    // Google's single-page app setup: update moves the config to the new page without a page_view of its own. No
    // trigger; the page_view tag fires it first.
    googleTag("2", UPDATE_TAG, [["update", "true"], ...fromDataLayer(PAGE_KEYS)]),
    ga4Event("3", "GA4 - page_view", "page_view", fromDataLayer([...PAGE_KEYS, ...CAMPAIGN_KEYS]), "1", {
      setupTag: [{ tagName: UPDATE_TAG, stopOnSetupFailure: false }],
    }),
    ga4Event("4", "GA4 - 앱 이벤트", "{{Event}}", fromDataLayer(params, "event_params."), "2"),
  ];

  return {
    exportFormatVersion: 2,
    containerVersion: {
      path: "accounts/0/containers/0/versions/0",
      ...ids,
      containerVersionId: "0",
      container: {
        path: "accounts/0/containers/0",
        ...ids,
        name: "Plypick",
        publicId: "GTM-XXXXXXX",
        usageContext: ["WEB"],
      },
      tag: tags,
      trigger,
      variable,
      builtInVariable: [{ ...ids, type: "EVENT", name: "Event" }],
      fingerprint: "0",
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const container = gtmContainer(readEventMap(readFileSync(SOURCE, "utf8")));
  writeFileSync(OUTPUT, `${JSON.stringify(container, null, 2)}\n`);
  const { tag, trigger, variable } = container.containerVersion;
  console.log(`${OUTPUT}: 태그 ${tag.length} · 트리거 ${trigger.length} · 변수 ${variable.length}`);
}
