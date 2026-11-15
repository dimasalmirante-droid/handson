import { describe, expect, it } from "vitest";
import type { Workspace } from "@/lib/auth/destination";
import { workspacesView } from "@/lib/auth/workspaces-view";

const companyWorkspace: Workspace = {
  key: "company:00000000-0000-4000-8000-000000000001",
  kind: "company",
  label: "Sabor Doce",
  detail: "Company administrator",
  href: "/employer/00000000-0000-4000-8000-000000000001",
};

const studentWorkspace: Workspace = {
  key: "student",
  kind: "student",
  label: "Student profile",
  detail: "Finish setting up your profile",
  href: "/onboarding",
};

describe("workspacesView", () => {
  it("prioritises a pending employer invitation over student profile creation", () => {
    const view = workspacesView({
      workspaces: [],
      hasStudentProfile: false,
      pendingInvitations: 1,
    });

    expect(view.showInvitations).toBe(true);
    expect(view.showCreateStudentProfile).toBe(false);
  });

  it("does not prompt company members to create a student profile after accepting", () => {
    const view = workspacesView({
      workspaces: [companyWorkspace],
      hasStudentProfile: false,
      pendingInvitations: 0,
    });

    expect(view.showCreateStudentProfile).toBe(false);
  });

  it("keeps the student profile option for a person with no employer invitation or company workspace", () => {
    const view = workspacesView({
      workspaces: [],
      hasStudentProfile: false,
      pendingInvitations: 0,
    });

    expect(view.showCreateStudentProfile).toBe(true);
  });

  it("does not offer a second student profile to someone who already has one", () => {
    const view = workspacesView({
      workspaces: [studentWorkspace],
      hasStudentProfile: true,
      pendingInvitations: 0,
    });

    expect(view.showCreateStudentProfile).toBe(false);
  });

  it("keeps pending invitations visible to existing students without duplicating the profile prompt", () => {
    const view = workspacesView({
      workspaces: [studentWorkspace],
      hasStudentProfile: true,
      pendingInvitations: 1,
    });

    expect(view.showInvitations).toBe(true);
    expect(view.showCreateStudentProfile).toBe(false);
  });
});
