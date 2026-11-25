/**
 * Every English text shown to students must have a Portuguese translation.
 * Scans the student-facing source for texts passed to t()/msg(), wrapped in
 * <T>, given as labels, titles and hints, and validation or action messages.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import pt from "../messages/pt.json";
import { translate } from "../translate";

const ROOT = path.join(__dirname, "..", "..");
const out = new Map<string, string>();

/** Not words to translate: brand names, file formats, CSS classes, addresses. */
const NOT_TEXT = new Set(["LinkedIn", "GitHub", "PDF", "PNG", "JPG", "WebP", "Word (.doc)", "Word (.docx)", "hello@handson.cloud", "bg-success-soft text-success"]);

const SKIP = [/\.test\.tsx?$/, /\/admin\//, /\/employer\//, /design-system/, /__tests__/, /\/i18n\//, /\/components\/admin\//, /\/lib\/data\/admin/, /\/lib\/cv\/data/, /\/lib\/cv\/model/, /\/lib\/cv\/pdf/, /\/supabase\//, /proxy\.ts$/, /\/lib\/env/, /\/lib\/site/, /\/lib\/countries/, /oauth/, /\/lib\/invitations\//, /\/lib\/companies\//, /\/lib\/learning\/editor\.ts$/, /\/lib\/csv/, /\/lib\/cn/];
const PROPS = new Set(["label", "title", "lead", "hint", "legend", "continueLabel", "createLabel", "note", "detail", "message", "error", "success", "placeholder"]);
const MESSAGE_FILES = [/validation\//, /actions\.ts$/, /lib\/files\.ts$/, /use-upload\.ts$/, /labels\.ts$/, /data\/student\.ts$/, /auth\/destination\.ts$/, /lib\/legal\.ts$/, /onboarding\/steps\.ts$/, /app\/\(auth\)\/login\/page\.tsx$/];

const add = (s: string, file: string) => {
  s = s.replace(/\s+/g, " ").trim();
  if (!/[A-Za-z]{2,}/.test(s)) return;
  if (/^(https?:|\/|#|[a-z_]+$|[a-z0-9-]+\.[a-z]+)/.test(s) && !/ /.test(s)) return;
  if (!out.has(s)) out.set(s, file);
};
function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|ts)$/.test(f) && !SKIP.some((r) => r.test(p))) scan(p);
  }
}
function lit(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}
function scan(file: string) {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const messageFile = MESSAGE_FILES.some((r) => r.test(file));
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ["t", "msg"].includes(n.expression.text) && n.arguments[0]) {
      const a = n.arguments[0];
      const v = lit(a);
      if (v) add(v, file);
      if (ts.isConditionalExpression(a)) for (const b of [a.whenTrue, a.whenFalse]) { const x = lit(b); if (x) add(x, file); }
    }
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "T") {
      for (const c of n.children) {
        if (ts.isJsxText(c)) add(c.text, file);
        if (ts.isJsxExpression(c) && c.expression) {
          const v = lit(c.expression);
          if (v) add(v, file);
          if (ts.isConditionalExpression(c.expression)) for (const b of [c.expression.whenTrue, c.expression.whenFalse]) { const x = lit(b); if (x) add(x, file); }
        }
      }
    }
    if (ts.isJsxAttribute(n) && PROPS.has(n.name.getText(sf)) && n.initializer) {
      const init = n.initializer;
      const expr = ts.isJsxExpression(init) ? init.expression : undefined;
      const v = ts.isStringLiteral(init) ? init.text : expr ? lit(expr) : null;
      if (v && n.name.getText(sf) !== "placeholder") add(v, file);
      if (expr && ts.isConditionalExpression(expr)) {
        const e = expr;
        for (const b of [e.whenTrue, e.whenFalse]) { const x = lit(b); if (x) add(x, file); }
        if (ts.isConditionalExpression(e.whenFalse)) for (const b of [e.whenFalse.whenTrue, e.whenFalse.whenFalse]) { const x = lit(b); if (x) add(x, file); }
      }
    }
    if (ts.isPropertyAssignment(n) && n.name && PROPS.has(n.name.getText(sf).replace(/"/g, ""))) {
      const v = lit(n.initializer);
      if (v && n.name.getText(sf) !== "placeholder") add(v, file);
    }
    if (messageFile && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) {
      const v = n.text;
      if (/^[A-Z“(•←+]/.test(v) && / /.test(v) || /^[A-Z][a-z]+$/.test(v) && ts.isPropertyAssignment(n.parent)) add(v, file);
    }
    if (messageFile && ts.isTemplateExpression(n)) {
      // Template: turn ${expr} into {expr}
      let s = n.head.text;
      for (const span of n.templateSpans) s += `{${span.expression.getText(sf).replace(/\W+/g, "_").replace(/^_|_$/g, "")}}` + span.literal.text;
      if (/^[A-Z]/.test(s) && / /.test(s)) add(s, file);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

walk(ROOT);

const catalogue = pt as Record<string, string>;
/** A text is covered if it is in the catalogue or matches one of its {placeholder} templates. */
const covered = (text: string) => text in catalogue || translate("pt", text) !== text;
/** Extracted templates name their placeholders after the code (e.g. {MAX_DOCUMENTS}); compare by shape. */
const shape = (text: string) => text.replace(/\{\w+\}/g, "{}");
const templateShapes = new Set(Object.keys(catalogue).map(shape));

describe("Portuguese catalogue", () => {
  it("translates every student-facing text", () => {
    const missing = [...out.keys()].filter((text) => !NOT_TEXT.has(text) && !covered(text) && !templateShapes.has(shape(text)));
    expect(missing).toEqual([]);
  });

  it("keeps placeholders in translations", () => {
    for (const [key, value] of Object.entries(catalogue)) {
      const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(names(value), key).toEqual(names(key));
    }
  });
});

describe("translate", () => {
  it("returns Portuguese, fills placeholders and falls back to English", () => {
    expect(translate("pt", "Save changes")).toBe("Guardar alterações");
    expect(translate("en", "Save changes")).toBe("Save changes");
    expect(translate("pt", "Step {step} of 7", { step: 2 })).toBe("Passo 2 de 7");
    expect(translate("pt", "A text nobody translated")).toBe("A text nobody translated");
  });

  it("translates messages that were filled in before translation", () => {
    expect(translate("pt", "You can store up to 30 documents.")).toBe("Pode guardar até 30 documentos.");
    expect(translate("pt", "Enter a valid LinkedIn profile link (linkedin.com/in/…).")).toBe(
      "Introduza um link do perfil LinkedIn (linkedin.com/in/…) válido.",
    );
  });
});
