import { describe, expect, it } from "vitest";
import { courseSchema, grantSchema, lessonSchema, publishProblems, questionSchema, suggestCourseSlug, voucherSchema } from "../learning/editor";

const course = {
  title: "Preparação para o Trabalho",
  slug: "preparacao-para-o-trabalho",
  summary: "",
  categoryId: "1",
  status: "draft",
  audience: "all_students",
  sequential: true,
  passMark: "80",
  badgeName: "",
  priceMzn: "0",
  sortOrder: "0",
};

describe("course", () => {
  it("accepts a valid course and normalises empty fields", () => {
    const r = courseSchema.parse(course);
    expect(r).toMatchObject({ categoryId: 1, passMark: 80, priceMzn: 0, summary: null, badgeName: null });
  });

  it("rejects a bad address, pass mark and negative price", () => {
    expect(courseSchema.safeParse({ ...course, slug: "Não Válido" }).success).toBe(false);
    expect(courseSchema.safeParse({ ...course, passMark: "120" }).success).toBe(false);
    expect(courseSchema.safeParse({ ...course, priceMzn: "-5" }).success).toBe(false);
  });

  it("suggests an address from a Portuguese title", () => {
    expect(suggestCourseSlug("Preparação para o Trabalho (piloto)")).toBe("preparacao-para-o-trabalho-piloto");
  });
});

describe("lesson", () => {
  const base = { title: "Lição", type: "text", videoUrl: "", body: "Texto", linkUrl: "", durationMinutes: "5", isPreview: false };

  it("requires the content its type needs", () => {
    expect(lessonSchema.safeParse({ ...base, type: "video" }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...base, type: "video", videoUrl: "https://youtu.be/dQw4w9WgXcQ" }).success).toBe(true);
    expect(lessonSchema.safeParse({ ...base, body: "" }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...base, type: "link", linkUrl: "http://insecure.example" }).success).toBe(false);
  });

  it("only accepts YouTube video links", () => {
    expect(lessonSchema.safeParse({ ...base, type: "video", videoUrl: "https://vimeo.com/1" }).success).toBe(false);
  });

  it("allows a quiz lesson with no text", () => {
    expect(lessonSchema.safeParse({ ...base, type: "quiz", body: "" }).success).toBe(true);
  });
});

describe("quiz question", () => {
  it("drops empty options and checks the correct answer is one of them", () => {
    const r = questionSchema.parse({ prompt: "Pergunta?", options: ["a", "", "b", "  "], correctIndex: 1, explanation: "" });
    expect(r.options).toEqual(["a", "b"]);
    expect(questionSchema.safeParse({ prompt: "Pergunta?", options: ["a", "b"], correctIndex: 2, explanation: "" }).success).toBe(false);
    expect(questionSchema.safeParse({ prompt: "Pergunta?", options: ["a"], correctIndex: 0, explanation: "" }).success).toBe(false);
  });
});

describe("access", () => {
  it("normalises voucher codes and validates limits", () => {
    expect(voucherSchema.parse({ code: " uem-2026 ", maxUses: "", expiresOn: "", sponsorName: "" })).toMatchObject({ code: "UEM-2026", maxUses: null });
    expect(voucherSchema.safeParse({ code: "UEM 2026", maxUses: "", expiresOn: "", sponsorName: "" }).success).toBe(false);
    expect(voucherSchema.safeParse({ code: "UEM-2026", maxUses: "0", expiresOn: "", sponsorName: "" }).success).toBe(false);
  });

  it("validates a grant by email", () => {
    expect(grantSchema.parse({ email: "Aluno@Example.com", source: "purchase", amountMzn: "500", sponsorName: "", note: "M-Pesa" })).toMatchObject({
      email: "aluno@example.com",
      amountMzn: 500,
    });
    expect(grantSchema.safeParse({ email: "nao-e-email", source: "purchase", amountMzn: "", sponsorName: "", note: "" }).success).toBe(false);
  });
});

describe("publishing", () => {
  it("lists what blocks publishing", () => {
    expect(publishProblems({ modules: [] })).toEqual(["Add at least one lesson."]);
    expect(
      publishProblems({
        modules: [
          { title: "M1", lessons: [{ title: "Quiz", type: "quiz", questions: 0 }] },
          { title: "M2", lessons: [] },
        ],
      }),
    ).toEqual(["Module “M2” has no lessons.", "Quiz “Quiz” has no questions."]);
    expect(publishProblems({ modules: [{ title: "M1", lessons: [{ title: "L", type: "text", questions: 0 }] }] })).toEqual([]);
  });
});
