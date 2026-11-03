// Design-system rules shared by eslint.config.mjs (lint) and scripts/ds-inventory.mjs (inventory).
// One definition of "what breaks the design system" so the ratchet and the inventory never disagree.

const SIDES = "(?:[trblse]|tl|tr|bl|br|ss|se|es|ee)";

/** Height, padding, radius and font size: what a control primitive's size prop decides. Width is layout. */
const CONTROL_SHAPE = /^((min-|max-)?h-|size-|p[xytrblse]?-|rounded(-|$)|text-(xs|sm|base|lg|[2-9]?xl|caption|body|display|h[1-6]|\[[\d.]))/;
const NON_TOKEN_RADIUS = new RegExp(`^rounded(-${SIDES})?(-(xs|sm|md|lg|xl|[2-4]xl|full|\\[[^\\]]+\\]))?$`);
const NON_TOKEN_FONT_SIZE = /^text-(xs|base|lg|[2-9]?xl|\[[\d.]+[a-z%]*\])(\/\S+)?$/;
const ARBITRARY_LENGTH =
  /^-?((min-|max-)?[hw]|size|p[xytrblse]?|m[xytrblse]?|top|right|bottom|left|start|end|inset(-[xy])?|gap(-[xy])?|space-[xy]|translate-[xy]|basis|leading|tracking)-\[[^\]]+\]$/;

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
        "ListRowButton·ToolbarButton 으로 그린다. 누르는 영역만 필요한 감싸개라면 배치 클래스(flex·w-full·absolute)만 둔다.",
      rawLink:
        '바탕·테두리로 버튼처럼 칠한 <{{tag}} className="{{classes}}"> 는 src/components/ui 의 모양을 쓴다(버튼은 buttonClassName({ variant, size })). ' +
        "글자 링크라면 바탕과 테두리를 뺀다.",
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
    "non-token": classTokenRule(
      "Radius and font size outside the tokens (rounded-badge·control·card·sheet·pill, text-display·h1–h4·body·sm·caption).",
      (u) => NON_TOKEN_RADIUS.test(u) || NON_TOKEN_FONT_SIZE.test(u),
    ),
    arbitrary: classTokenRule("Arbitrary [..] lengths on size, spacing and position utilities.", (u) => ARBITRARY_LENGTH.test(u)),
  },
};

export default plugin;
