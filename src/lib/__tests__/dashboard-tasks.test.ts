import { describe, expect, it } from "vitest";
import type { Completion } from "../data/student";
import { changesHref, openTasks } from "../dashboard/tasks";

const section = (missing: string[] = []) => ({ weight: 15, score: missing.length ? 0 : 15, missing });

function completion(missing: Partial<Record<string, string[]>>): Completion {
  return {
    total: 0,
    sections: {
      personal: section(missing.personal),
      education: section(missing.education),
      skills: section(missing.skills),
      interests: section(missing.interests),
      experience: section(missing.experience),
      documents: section(missing.documents),
    },
  } as Completion;
}

describe("dashboard next step", () => {
  it("orders open tasks so the most useful one comes first", () => {
    const tasks = openTasks(
      { headline: null },
      completion({ education: ["education_record"], skills: ["skills_min_3"], documents: ["transcript"], interests: ["availability", "industries"] }),
    );
    expect(tasks.map((t) => t.key)).toEqual(["headline", "education", "skills", "interests", "transcript"]);
  });

  it("asks for the headline even though it is not scored", () => {
    expect(openTasks({ headline: null }, completion({})).map((t) => t.key)).toEqual(["headline"]);
    expect(openTasks({ headline: "Finalista de Gestão" }, completion({}))).toEqual([]);
  });

  it("groups several missing fields of a section into one task", () => {
    const tasks = openTasks({ headline: "x" }, completion({ personal: ["phone", "nationality", "province"] }));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ key: "personal", href: "/dashboard/profile" });
  });

  it("copes with a missing completion result", () => {
    expect(openTasks({ headline: "x" }, null)).toEqual([]);
  });
});

describe("where to review changes", () => {
  it("points to the first item Handson could not verify", () => {
    expect(changesHref([{ verification_status: "rejected" }], [])).toBe("/dashboard/education");
    expect(changesHref([{ verification_status: "verified" }], [{ verification_status: "rejected" }])).toBe("/dashboard/documents");
    expect(changesHref([], [])).toBe("/dashboard/profile");
  });
});
