import { describe, expect, it } from "vitest";
import { parseBlocks } from "../../components/learning/lesson-body";
import { nextLesson, suggestedCourse, type CatalogueCourse, type CourseOutline } from "../learning/model";
import { quizLayout } from "../learning/shuffle";
import { youtubeEmbedUrl, youtubeId } from "../learning/youtube";

describe("youtube links", () => {
  it("accepts watch, short, embed and shorts links", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects other hosts, plain http and malformed ids", () => {
    expect(youtubeId("https://vimeo.com/12345")).toBeNull();
    expect(youtubeId("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeId("https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("not a url")).toBeNull();
  });

  it("embeds through the privacy-enhanced domain", () => {
    expect(youtubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1");
  });
});

describe("lesson text", () => {
  it("splits paragraphs, headings and lists", () => {
    const blocks = parseBlocks("Primeiro parágrafo\ncontinua.\n\n### Resumo\n- um\n- dois\n\n1. passo\n2. passo");
    expect(blocks.map((b) => b.kind)).toEqual(["p", "h", "ul", "ol"]);
    expect(blocks[0].lines).toEqual(["Primeiro parágrafo", "continua."]);
    expect(blocks[2].lines).toEqual(["um", "dois"]);
  });

  it("keeps HTML as plain text", () => {
    const [b] = parseBlocks("<script>alert(1)</script>");
    expect(b).toEqual({ kind: "p", lines: ["<script>alert(1)</script>"] });
  });
});

const course = (over: Partial<CatalogueCourse>): CatalogueCourse => ({
  id: "c", slug: "c", title: "C", summary: null, category_slug: null, category_name: null, category_name_pt: null,
  price_mzn: 0, badge_name: null, sequential: false, can_enter: true, has_access: true, lessons_total: 5,
  lessons_completed: 0, completed_at: null, ...over,
});

describe("suggested course", () => {
  it("prefers a course in progress, then the first open course", () => {
    expect(suggestedCourse([course({ slug: "a" }), course({ slug: "b", lessons_completed: 2 })])?.slug).toBe("b");
    expect(suggestedCourse([course({ slug: "a" }), course({ slug: "b" })])?.slug).toBe("a");
  });

  it("skips completed, locked and empty courses", () => {
    expect(
      suggestedCourse([
        course({ slug: "done", completed_at: "2026-11-01" }),
        course({ slug: "paid", can_enter: false }),
        course({ slug: "empty", lessons_total: 0 }),
      ]),
    ).toBeNull();
  });
});

describe("next lesson", () => {
  const lesson = (id: string, completed: boolean) => ({ id, position: 1, title: id, type: "text" as const, duration_minutes: null, is_preview: false, completed, best_score: null });
  const outline = (modules: CourseOutline["modules"]): CourseOutline => ({
    id: "c", slug: "c", title: "C", summary: null, price_mzn: 0, badge_name: null, sequential: true, pass_mark: 75,
    can_enter: true, prerequisites: [], completed_at: null, modules,
  });

  it("is the first incomplete lesson in an open module", () => {
    const o = outline([
      { id: "m1", position: 1, title: "M1", objective: null, open: true, lessons: [lesson("a", true), lesson("b", false)] },
      { id: "m2", position: 2, title: "M2", objective: null, open: false, lessons: [lesson("c", false)] },
    ]);
    expect(nextLesson(o)?.id).toBe("b");
  });

  it("is null when every open lesson is done", () => {
    const o = outline([{ id: "m1", position: 1, title: "M1", objective: null, open: true, lessons: [lesson("a", true)] }]);
    expect(nextLesson(o)).toBeNull();
  });
});

describe("quiz shuffling", () => {
  it("is a valid permutation and the same for the same seed and attempt", () => {
    const a = quizLayout([4, 4, 3, 4], 12345, 0);
    expect([...a.questions].sort()).toEqual([0, 1, 2, 3]);
    expect([...a.options[2]].sort()).toEqual([0, 1, 2]);
    expect(quizLayout([4, 4, 3, 4], 12345, 0)).toEqual(a);
  });

  it("changes the order on a new attempt", () => {
    const counts = [4, 4, 4, 4, 4, 4, 4, 4];
    const first = quizLayout(counts, 999, 0);
    const second = quizLayout(counts, 999, 1);
    expect(JSON.stringify(second)).not.toBe(JSON.stringify(first));
  });
});
