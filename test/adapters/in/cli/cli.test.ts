import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createProgram, type CliDependencies } from "../../../../src/adapters/in/cli/cli.js";

describe("CLI", () => {
  it("prints machine-readable JSON", async () => {
    const stdout = captureStream();
    const stderr = captureStream();
    const auditSkill = vi.fn().mockResolvedValue({
      score: 80,
      risks: [{ id: "risk-1", level: "medium", description: "A finding" }],
    });
    const dependencies: CliDependencies = {
      createSecurityAuditService: () => ({ auditSkill }),
      io: { stdout: stdout.stream, stderr: stderr.stream, isTTY: false },
      cwd: "/project",
    };

    await createProgram(dependencies).parseAsync(["node", "odid", "audit", "security", "skill", "my-skill", "--json"]);

    expect(auditSkill).toHaveBeenCalledWith("my-skill", { cwd: "/project" });
    expect(stdout.read()).toBe('{"score":80,"risks":[{"id":"risk-1","level":"medium","description":"A finding"}]}\n');
    expect(stderr.read()).toBe("");
  });

  it("prints a readable report", async () => {
    const stdout = captureStream();
    const dependencies: CliDependencies = {
      createSecurityAuditService: () => ({
        auditSkill: vi.fn().mockResolvedValue({ score: 100, risks: [] }),
      }),
      io: { stdout: stdout.stream, stderr: captureStream().stream, isTTY: false },
      cwd: "/project",
    };

    await createProgram(dependencies).parseAsync(["node", "odid", "audit", "security", "skill", "my-skill"]);

    expect(stdout.read()).toContain("Security score: 100/100");
    expect(stdout.read()).toContain("No risks found");
  });
});

function captureStream(): { stream: Writable; read(): string } {
  let output = "";
  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        output += String(chunk);
        callback();
      },
    }),
    read: () => output,
  };
}
