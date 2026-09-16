import type { WriteStream } from "node:tty";
import { createRequire } from "node:module";
import chalk from "chalk";
import { Command, Option } from "commander";
import ora from "ora";
import pino, { type LevelWithSilent, type Logger } from "pino";
import type { AuditResult, AuditRiskLevel } from "../../../services/audit/audit-service.js";
import { CliCodexAuditService } from "../../../services/audit/adapters/out/cli-codex-audit.service.js";
import {
  SkillSecurityAuditService,
  type SecurityAuditService,
} from "../../../services/security-audit/security-audit.service.js";

const loggerLevels = ["silent", "fatal", "error", "warn", "info", "debug", "trace"] as const;
const require = createRequire(import.meta.url);
const packageJson = require("../../../../package.json") as { version: string };

export interface CliIo {
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  isTTY: boolean;
}

export interface CliDependencies {
  createSecurityAuditService(logger: Logger): SecurityAuditService;
  io: CliIo;
  cwd: string;
}

const defaultDependencies: CliDependencies = {
  createSecurityAuditService(logger) {
    return new SkillSecurityAuditService(new CliCodexAuditService(logger));
  },
  io: {
    stdout: process.stdout,
    stderr: process.stderr,
    isTTY: Boolean((process.stderr as WriteStream).isTTY),
  },
  cwd: process.cwd(),
};

export function createProgram(dependencies: CliDependencies = defaultDependencies): Command {
  const program = new Command()
    .name("odid")
    .description("AI-assisted audits for software and infrastructure")
    .version(packageJson.version, "-V, --version")
    .addOption(
      new Option("--logger <level>", "set diagnostic logging level")
        .choices([...loggerLevels])
        .default("silent"),
    )
    .configureOutput({
      writeOut: (value) => dependencies.io.stdout.write(value),
      writeErr: (value) => dependencies.io.stderr.write(value),
    });

  const audit = program.command("audit").description("run an audit");
  const security = audit.command("security").description("run a security audit");

  security
    .command("skill <skillPath>")
    .description("audit an AI skill directory")
    .option("--json", "print raw audit JSON")
    .action(async (skillPath: string, commandOptions: { json?: boolean }) => {
      const globalOptions = program.opts<{ logger: LevelWithSilent }>();
      const logger = createLogger(globalOptions.logger, dependencies.io.stderr);
      const service = dependencies.createSecurityAuditService(logger);
      const spinner = ora({
        text: "Auditing skill security",
        stream: dependencies.io.stderr as WriteStream,
        isEnabled: dependencies.io.isTTY && !commandOptions.json,
      });

      if (!commandOptions.json) {
        spinner.start();
      }
      try {
        const result = await service.auditSkill(skillPath, { cwd: dependencies.cwd });
        if (!commandOptions.json) {
          spinner.stop();
        }
        dependencies.io.stdout.write(commandOptions.json ? `${JSON.stringify(result)}\n` : formatResult(result));
      } catch (error) {
        if (!commandOptions.json) {
          spinner.stop();
        }
        throw error;
      }
    });

  return program;
}

export async function runCli(argv: readonly string[] = process.argv): Promise<void> {
  const program = createProgram();
  program.exitOverride();
  try {
    await program.parseAsync([...argv]);
  } catch (error) {
    if (error instanceof Error && error.name === "CommanderError") {
      process.exitCode = (error as Error & { exitCode?: number }).exitCode ?? 1;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${chalk.red("ERROR")} ${message}\n`);
    process.exitCode = 1;
  }
}

function createLogger(level: LevelWithSilent, stderr: NodeJS.WritableStream): Logger {
  return pino({ level }, stderr);
}

function formatResult(result: AuditResult): string {
  const heading = `Security score: ${colorScore(result.score)}/100`;
  if (result.risks.length === 0) {
    return `${heading}\n${chalk.green("OK")} No risks found.\n`;
  }

  const risks = result.risks.map((risk) => {
    const level = colorLevel(risk.level, risk.level.toUpperCase());
    return `${level} ${risk.id}\n  ${risk.description}`;
  });
  return `${heading}\nRisks (${result.risks.length}):\n${risks.join("\n")}\n`;
}

function colorScore(score: number): string {
  if (score >= 90) return chalk.green(String(score));
  if (score >= 70) return chalk.yellow(String(score));
  return chalk.red(String(score));
}

function colorLevel(level: AuditRiskLevel, value: string): string {
  if (level === "critical" || level === "high") return chalk.red(value);
  if (level === "medium") return chalk.yellow(value);
  return chalk.blue(value);
}
