import { execFile, type ExecFileOptions } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Logger } from "pino";
import type { AuditRequest, AuditResult, AuditService } from "../../audit-service.js";
import { parseAuditResult } from "../../audit-result.js";

const defaultModel = "gpt-5.6-luna";
const defaultReasoning = "medium";
const defaultSchemaPath = fileURLToPath(
  new URL("../../../../../docs/spec/schemas/audit-result.json", import.meta.url),
);

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: readonly string[], options: ExecFileOptions, input: string): Promise<CommandResult>;
}

export class CodexExecutionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CodexExecutionError";
  }
}

export interface CliCodexAuditServiceOptions {
  runner?: CommandRunner;
  schemaPath?: string;
  executable?: string;
}

export class CliCodexAuditService implements AuditService {
  private readonly runner: CommandRunner;
  private readonly schemaPath: string;
  private readonly executable: string;

  constructor(
    private readonly logger: Logger,
    options: CliCodexAuditServiceOptions = {},
  ) {
    this.runner = options.runner ?? new ExecFileCommandRunner();
    this.schemaPath = options.schemaPath ?? defaultSchemaPath;
    this.executable = options.executable ?? "codex";
  }

  async audit(request: AuditRequest): Promise<AuditResult> {
    const model = request.options?.model ?? defaultModel;
    const reasoning = request.options?.reasoning ?? defaultReasoning;
    const args = [
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "--model",
      model,
      "-c",
      `model_reasoning_effort=${reasoning}`,
      "--output-schema",
      this.schemaPath,
      "--cd",
      request.subjectPath,
      "-",
    ];

    this.logger.debug({ model, reasoning, subjectPath: request.subjectPath }, "starting Codex audit");

    let output: CommandResult;
    try {
      output = await this.runner.run(
        this.executable,
        args,
        { cwd: request.subjectPath, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
        request.prompt,
      );
    } catch (error) {
      throw new CodexExecutionError("Codex audit execution failed", { cause: error });
    }

    this.logger.debug({ stderr: output.stderr || undefined }, "Codex audit completed");
    return parseAuditResult(output.stdout.trim());
  }
}

class ExecFileCommandRunner implements CommandRunner {
  run(command: string, args: readonly string[], options: ExecFileOptions, input: string): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = execFile(command, [...args], options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      });

      child.stdin?.on("error", reject);
      child.stdin?.end(input);
    });
  }
}
