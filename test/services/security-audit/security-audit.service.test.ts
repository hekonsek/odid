import { access, mkdtemp, mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../../../src/services/audit/audit-service.js";
import {
  SkillSecurityAuditService,
  SubjectValidationError,
} from "../../../src/services/security-audit/security-audit.service.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("SkillSecurityAuditService", () => {
  it("includes source-location guidance from the security audit prompt", async () => {
    const cwd = await temporaryDirectory();
    const skillPath = join(cwd, "skill");
    await mkdir(skillPath);
    const audit = vi.fn<AuditService["audit"]>().mockResolvedValue({ score: 100, risks: [] });
    const service = new SkillSecurityAuditService({ audit });

    await service.auditSkill("skill", { cwd });

    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      subjectPath: expect.stringMatching(/odid-skill-audit-.+\/skill$/),
      prompt: expect.stringContaining("include path and filename causing the risk"),
    }));
    expect(audit.mock.calls[0]?.[0].prompt).toContain("line or line ranges");
    expect(audit.mock.calls[0]?.[0].prompt).toContain("Do not inspect its parent directory");
  });

  it("resolves a skill and adds configured suppressions to the prompt", async () => {
    const cwd = await temporaryDirectory();
    const skillPath = join(cwd, "skills", "example");
    await mkdir(skillPath, { recursive: true });
    await mkdir(join(cwd, ".odid"));
    await writeFile(join(cwd, ".odid", "supressions.md"), "> Accepted risk\n\nBecause we accept it.\n");
    const promptPath = join(cwd, "prompt.md");
    await writeFile(promptPath, "Audit ${SKILL_DIR_PATH} now.");
    const audit = vi.fn<AuditService["audit"]>().mockResolvedValue({ score: 100, risks: [] });
    const service = new SkillSecurityAuditService({ audit }, { promptPath });

    await service.auditSkill("skills/example", { cwd });

    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      subjectPath: expect.stringMatching(/odid-skill-audit-.+\/skill$/),
      prompt: expect.stringContaining("Audit . now."),
    }));
    expect(audit.mock.calls[0]?.[0].prompt).toContain("<supressions>");
    expect(audit.mock.calls[0]?.[0].prompt).toContain("Accepted risk");
  });

  it("does not create .odid when suppressions are absent", async () => {
    const cwd = await temporaryDirectory();
    const skillPath = join(cwd, "skill");
    await mkdir(skillPath);
    const promptPath = join(cwd, "prompt.md");
    await writeFile(promptPath, "Audit ${SKILL_DIR_PATH}.");
    const audit = vi.fn<AuditService["audit"]>().mockResolvedValue({ score: 100, risks: [] });
    const service = new SkillSecurityAuditService({ audit }, { promptPath });

    await service.auditSkill("skill", { cwd });

    await expect(access(join(cwd, ".odid"))).rejects.toThrow();
    expect(audit.mock.calls[0]?.[0].prompt).not.toContain("<supressions>");
  });

  it("audits a snapshot containing only the requested skill", async () => {
    const cwd = await temporaryDirectory();
    const skillPath = join(cwd, ".agents", "skills", "skill-adr");
    const siblingPath = join(cwd, ".agents", "skills", "other-skill");
    await mkdir(skillPath, { recursive: true });
    await mkdir(siblingPath, { recursive: true });
    await writeFile(join(skillPath, "SKILL.md"), "requested skill");
    await writeFile(join(siblingPath, "SKILL.md"), "must not be audited");
    let snapshotPath: string | undefined;
    const audit = vi.fn<AuditService["audit"]>().mockImplementation(async ({ subjectPath }) => {
      snapshotPath = subjectPath;
      expect(await readdir(subjectPath)).toEqual(["SKILL.md"]);
      expect(await readFile(join(subjectPath, "SKILL.md"), "utf8")).toBe("requested skill");
      await expect(access(join(subjectPath, "..", "other-skill"))).rejects.toThrow();
      return { score: 100, risks: [] };
    });
    const service = new SkillSecurityAuditService({ audit });

    await service.auditSkill(".agents/skills/skill-adr", { cwd });

    expect(audit).toHaveBeenCalledOnce();
    expect(snapshotPath).toBeDefined();
    await expect(access(snapshotPath!)).rejects.toThrow();
  });

  it("rejects a symlink as the skill root", async () => {
    const cwd = await temporaryDirectory();
    await mkdir(join(cwd, "actual"));
    await symlink(join(cwd, "actual"), join(cwd, "linked"));
    const service = new SkillSecurityAuditService({ audit: vi.fn() }, { promptPath: join(cwd, "unused") });

    await expect(service.auditSkill("linked", { cwd })).rejects.toThrow(SubjectValidationError);
  });
});

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "odid-test-"));
  temporaryDirectories.push(path);
  return path;
}
