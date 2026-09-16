import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import {
  CliCodexAuditService,
  CodexExecutionError,
  type CommandRunner,
} from "../../../src/services/audit/adapters/out/cli-codex-audit.service.js";

describe("CliCodexAuditService", () => {
  it("runs Codex with an isolated read-only configuration and prompt on stdin", async () => {
    const run = vi.fn<CommandRunner["run"]>().mockResolvedValue({
      stdout: '{"score":100,"risks":[]}',
      stderr: "",
    });
    const service = new CliCodexAuditService(pino({ level: "silent" }), {
      runner: { run },
      schemaPath: "/schema.json",
      executable: "/usr/bin/codex",
    });

    await expect(service.audit({
      subjectPath: "/subject",
      prompt: "audit this",
      options: { model: "test-model", reasoning: "high" },
    })).resolves.toEqual({ score: 100, risks: [] });

    expect(run).toHaveBeenCalledOnce();
    const [command, args, options, input] = run.mock.calls[0]!;
    expect(command).toBe("/usr/bin/codex");
    expect(args).toEqual(expect.arrayContaining([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "read-only",
      "test-model",
      "model_reasoning_effort=high",
      "/schema.json",
      "/subject",
      "-",
    ]));
    expect(options.cwd).toBe("/subject");
    expect(input).toBe("audit this");
  });

  it("uses the specified model and reasoning defaults", async () => {
    const run = vi.fn<CommandRunner["run"]>().mockResolvedValue({
      stdout: '{"score":100,"risks":[]}',
      stderr: "",
    });
    const service = new CliCodexAuditService(pino({ level: "silent" }), {
      runner: { run },
      schemaPath: "/schema.json",
    });

    await service.audit({ subjectPath: "/subject", prompt: "audit" });

    expect(run.mock.calls[0]?.[1]).toEqual(expect.arrayContaining([
      "gpt-5.6-luna",
      "model_reasoning_effort=medium",
    ]));
  });

  it("wraps command failures", async () => {
    const runner: CommandRunner = {
      run: vi.fn().mockRejectedValue(new Error("missing executable")),
    };
    const service = new CliCodexAuditService(pino({ level: "silent" }), { runner });

    await expect(service.audit({ subjectPath: "/subject", prompt: "audit" }))
      .rejects.toThrow(CodexExecutionError);
  });
});
