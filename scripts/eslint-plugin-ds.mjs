// Design-system rules shared by eslint.config.mjs (lint) and scripts/ds-inventory.mjs (inventory).
// One definition of "what breaks the design system" so lint and the inventory never disagree.

const SIDES = "(?:[trblse]|tl|tr|bl|br|ss|se|es|ee)";

/** Height, padding, radius and font size: what a control primitive's size prop decides. Width is layout. */
const CONTROL_SHAPE = /^((min-|max-)?h-|size-|p[xytrblse]?-|rounded(-|$)|text-(xs|sm|base|lg|[2-9]?xl|caption|body|display|h[1-6]|\[[\d.]))/;
const NON_TOKEN_RADIUS = new RegExp(`^rounded(-${SIDES})?(-(xs|sm|md|lg|xl|[2-4]xl|full|\\[[^\\]]+\\]))?$`);
const NON_TOKEN_FONT_SIZE = /^text-(xs|base|lg|[2-9]?xl|\[[\d.]+[a-z%]*\])(\/\S+)?$/;
const ARBITRARY_LENGTH =
  /^-?((min-|max-)?[hw]|size|p[xytrblse]?|m[xytrblse]?|top|right|bottom|left|start|end|inset(-[xy])?|gap(-[xy])?|space-[xy]|translate-[xy]|basis|leading|tracking)-\[[^\]]+\]$/;
/** `-mt-3`, `-mx-2`. A bracket value (`-mt-[3px]`) is already an arbitrary length, so it is listed there once. */
const NEGATIVE_MARGIN = /^-m[xytrblse]?-[^[]/;

/** `hover:sm:!h-4` → `h-4`. Colons inside brackets (`[&:hover]:`, `text-[color:red]`) are not variant separators. */
function utilityOf(token) {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    if (token[i] === "[") depth++;
    else if (token[i] === "]") depth--;
    else if (token[i] === ":" && depth === 0) start = i + 1;
  }
  return token.slice(start).replace(/^!|!$/g, "");
}

const tokensOf = (strings) => [...new Set(strings.flatMap((s) => s.split(/\s+/)).filter(Boolean))];

/** A background (resting or hover) or a full border is what makes a link a pressable surface instead of text. */
const isButtonSkin = (token) => {
  const u = utilityOf(token);
  return (/^bg-/.test(u) && u !== "bg-transparent") || (u === token && /^border(-\d+)?$/.test(u));
};

function findVariable(scope, name) {
  for (let s = scope; s; s = s.upper) {
    const variable = s.set.get(name);
    if (variable) return variable;
  }
  return null;
}

/**
 * The class strings a className expression can produce, following same-file consts so
 * `const round = "h-11 rounded-pill"; <button className={round}>` is seen too.
 * Imported strings and props stay opaque: ui helpers like touchTarget44 are the design system's own.
 */
function classStrings(node, sourceCode) {
  const out = { strings: [], usesButtonClassName: false };
  const seen = new Set();
  const visit = (n) => {
    if (!n || seen.has(n)) return;
    seen.add(n);
    switch (n.type) {
      case "Literal":
        if (typeof n.value === "string") out.strings.push(n.value);
        break;
      case "TemplateLiteral":
        for (const q of n.quasis) out.strings.push(q.value.cooked ?? q.value.raw);
        n.expressions.forEach(visit);
        break;
      case "JSXExpressionContainer":
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
        visit(n.expression);
        break;
      case "ConditionalExpression":
        visit(n.consequent);
        visit(n.alternate);
        break;
      case "LogicalExpression":
        if (n.operator !== "&&") visit(n.left);
        visit(n.right);
        break;
      case "BinaryExpression":
        if (n.operator === "+") {
          visit(n.left);
          visit(n.right);
        }
        break;
      case "ArrayExpression":
        n.elements.forEach(visit);
        break;
      case "ObjectExpression":
        for (const p of n.properties) if (p.type === "Property") visit(p.value);
        break;
      case "MemberExpression":
        visit(n.object);
        break;
      case "CallExpression":
        if (n.callee.type === "Identifier" && n.callee.name === "buttonClassName") {
          out.usesButtonClassName = true;
          break;
        }
        if (n.callee.type === "MemberExpression") visit(n.callee.object);
        n.arguments.forEach(visit);
        break;
      case "Identifier": {
        const def = findVariable(sourceCode.getScope(n), n.name)?.defs[0];
        if (def?.type === "Variable" && def.parent.kind === "const") visit(def.node.init);
        break;
      }
    }
  };
  visit(node);
  return out;
}

const noRawControl = {
  meta: {
    type: "problem",
    docs: { description: "Controls outside src/components/ui are drawn by the ui primitives, not by hand." },
    messages: {
      rawButton:
        '<button className="{{classes}}"> 처럼 높이·여백·모서리·글자 크기를 직접 정하지 않는다. src/components/ui 의 Button·IconButton·Chip·' +
        "ListRowButton·RoundButton 으로 그린다. 둥근 아이콘 버튼은 RoundButton 이다. 누르는 영역만 필요한 감싸개라면 배치 클래스(flex·w-full·absolute)만 둔다.",
      rawLink:
        '바탕·테두리와 크기를 직접 칠한 <{{tag}} className="{{classes}}"> 는 src/components/ui 로 그린다. 버튼 모양은 ' +
        "buttonClassName({ variant, size }), 둥근 아이콘은 RoundLink, 줄은 ListRowLink, 카드는 Card 안에 바탕 없는 링크(block)를 둔다. 글자 링크라면 바탕과 테두리를 뺀다.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const tag = node.name.name;
        if (tag !== "button" && tag !== "a" && tag !== "Link") return;
        const attr = node.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === "className");
        if (!attr?.value) return;

        const { strings, usesButtonClassName } = classStrings(attr.value, context.sourceCode);
        const tokens = tokensOf(strings);
        const shape = tokens.filter((t) => CONTROL_SHAPE.test(utilityOf(t)));
        if (!shape.length) return;

        if (tag === "button") {
          context.report({ node, messageId: "rawButton", data: { classes: shape.join(" ") } });
        } else if (!usesButtonClassName && tokens.some(isButtonSkin)) {
          context.report({ node, messageId: "rawLink", data: { tag, classes: [...tokens.filter(isButtonSkin), ...shape].join(" ") } });
        }
      },
    };
  },
};

/**
 * What draws each <input> type outside ui. "native" stays a plain <input>. A type missing here, and a missing or
 * unresolved type, may take typed text, which ui Input draws.
 */
const INPUT_KIND = {
  checkbox: "native",
  radio: "native",
  range: "native",
  hidden: "native",
  file: "native",
  submit: "button",
  reset: "button",
  button: "button",
  image: "button",
  color: "noPrimitive",
};
const KEEP_NATIVE = "<input> 을 그대로 두는 것은 type 이 checkbox·radio·range·hidden·file 일 때뿐이다.";

const noRawInput = {
  meta: {
    type: "problem",
    docs: { description: "Inputs and textareas outside src/components/ui are drawn by the ui primitives." },
    messages: {
      text:
        "<{{tag}}{{type}}> 를 직접 그리지 않는다. 글자를 받는 칸은 src/components/ui 의 Input·Textarea 로 그리고, 라벨·도움말·오류는 Field 로 잇는다. " +
        KEEP_NATIVE,
      button: `<{{tag}}{{type}}> 를 직접 그리지 않는다. 누르는 버튼은 src/components/ui 의 Button 으로 그린다(폼 제출은 type="submit"). ${KEEP_NATIVE}`,
      noPrimitive: `<{{tag}}{{type}}> 를 직접 그리지 않는다. 이 칸을 그리는 부품은 src/components/ui 에 아직 없으니 부품을 먼저 만들고 /design 에 더한다. ${KEEP_NATIVE}`,
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;
        const tag = node.name.name;
        if (tag === "textarea") {
          context.report({ node, messageId: "text", data: { tag, type: "" } });
          return;
        }
        if (tag !== "input") return;
        const attr = node.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === "type");
        // A type this file cannot pin down (a prop) may be text, so it is reported too.
        const types = attr?.value ? classStrings(attr.value, context.sourceCode).strings.map((t) => t.trim().toLowerCase()) : [];
        const kinds = new Set(types.map((t) => (Object.hasOwn(INPUT_KIND, t) ? INPUT_KIND[t] : "text")));
        kinds.delete("native");
        if (types.length && kinds.size === 0) return;
        // One kind names its own fix; a mix of kinds, or no known type, may still take text.
        const messageId = kinds.size === 1 ? [...kinds][0] : "text";
        context.report({ node, messageId, data: { tag, type: attr ? ` type="${types.join("|") || "…"}"` : "" } });
      },
    };
  },
};

/** Utilities that take away the keyboard focus outline globals.css draws in @layer base. */
const OUTLINE_REMOVED = /^outline-(none|hidden|0)$/;
/** A nonzero ring width under a focus variant (`focus-visible:ring-2`, `has-focus-visible:ring-2`): the focus style that replaces the outline. */
const isFocusRing = (token) =>
  /^ring(-[1-9]\d*|-\[(?!0(?:px|rem|em)?\])[^\]]+\])?$/.test(utilityOf(token)) && /focus[\w-]*:/.test(token);

const focusRing = {
  meta: {
    type: "problem",
    docs: { description: "A class list that removes the focus outline draws a focus ring, or keyboard focus disappears." },
    messages: {
      missing:
        "{{token}} 은 globals.css 의 키보드 포커스 outline 을 지운다. 같은 문자열에 focus-visible:ring-2 focus-visible:ring-focus-ring 처럼 포커스 ring 을 같이 둔다. " +
        "없으면 Tab 으로 옮겨도 포커스가 보이지 않는다.",
    },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      const tokens = tokensOf([text]);
      if (tokens.some(isFocusRing)) return;
      for (const token of tokens) {
        if (OUTLINE_REMOVED.test(utilityOf(token))) context.report({ node, messageId: "missing", data: { token } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

/** Letter case and wide tracking: on a Korean label they only spread the syllables apart. */
const TRACKED_CAPS = /^(uppercase|tracking-(wide|wider|widest))$/;

const trackedCaps = {
  meta: {
    type: "problem",
    docs: { description: "Labels outside src/components/ui are not set in uppercase or wide tracking." },
    messages: {
      found:
        "{{token}} 은 한글 라벨에서 대소문자 없이 자간만 벌려 영문 템플릿처럼 보인다. 작은 라벨은 text-caption font-semibold 에 " +
        "text-text-subtle·text-text-muted 로 둔다(방 설정 시트의 섹션 라벨).",
    },
    schema: [],
  },
  create(context) {
    const check = (node, text) => {
      for (const token of tokensOf([text])) {
        if (TRACKED_CAPS.test(utilityOf(token))) context.report({ node, messageId: "found", data: { token } });
      }
    };
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

/** Reports every class token in any string literal that `match` accepts. Inventory only: not enabled in eslint.config.mjs. */
function classTokenRule(description, match) {
  return {
    meta: { type: "suggestion", docs: { description }, messages: { found: "{{token}}" }, schema: [] },
    create(context) {
      const check = (node, text) => {
        for (const token of tokensOf([text])) {
          if (match(utilityOf(token))) context.report({ node, messageId: "found", data: { token } });
        }
      };
      return {
        Literal(node) {
          if (typeof node.value === "string") check(node, node.value);
        },
        TemplateElement(node) {
          check(node, node.value.cooked ?? node.value.raw);
        },
      };
    },
  };
}

/** @type {import("eslint").ESLint.Plugin} */
const plugin = {
  meta: { name: "ds" },
  rules: {
    "no-raw-control": noRawControl,
    "no-raw-input": noRawInput,
    "focus-ring": focusRing,
    "tracked-caps": trackedCaps,
    "non-token": classTokenRule(
      "Radius and font size outside the tokens (rounded-badge·control·card·sheet·pill, text-display·h1–h4·body·sm·caption).",
      (u) => NON_TOKEN_RADIUS.test(u) || NON_TOKEN_FONT_SIZE.test(u),
    ),
    arbitrary: classTokenRule("Arbitrary [..] lengths on size, spacing and position utilities.", (u) => ARBITRARY_LENGTH.test(u)),
    "negative-margin": classTokenRule("Negative margins: a hand offset that pulls a box out of the layout it sits in.", (u) => NEGATIVE_MARGIN.test(u)),
  },
};

export default plugin;
