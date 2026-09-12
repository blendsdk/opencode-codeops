#!/usr/bin/env node
/**
 * Install the CodeOps skills into an OpenCode skills directory.
 *
 * OpenCode discovers skills only from the filesystem: `.opencode/skills/` in a
 * project, or `~/.config/opencode/skills/` globally. This package ships the
 * skills under `skills/`, but OpenCode never reads them from a node_modules
 * package. This script copies every skill directory (SKILL.md plus any
 * supporting Markdown files) into a directory OpenCode searches.
 *
 * Safety rules:
 * - A file is copied only when the destination does not exist or is identical.
 * - A destination file with different content is never overwritten unless
 *   `--force` is passed, so user-authored skills are protected.
 * - `--dry-run` prints every planned action without writing anything.
 *
 * Usage:
 *   npx opencode-codeops install-skills [--global | --project | --target DIR]
 *                                       [--dry-run] [--force]
 *
 * @example
 *   npx opencode-codeops install-skills --dry-run
 *   npx opencode-codeops install-skills --global
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// This file lives in <package root>/bin/, so the parent of its directory is
// the package root that contains skills/.
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** Print command usage. */
function printUsage() {
  console.log(`Install the CodeOps skills so OpenCode can discover them.

Usage:
  opencode-codeops install-skills [options]

Options:
  --global           Install into ~/.config/opencode/skills (default)
  --project          Install into ./.opencode/skills
  --target <dir>     Install into a custom skills directory
  --dry-run          Show what would happen without writing files
  --force            Overwrite existing files that differ
  -h, --help         Show this help`)
}

/** Parse command-line arguments; exits with an error on invalid input. */
function parseArgs(argv) {
  const args = argv[0] === "install-skills" ? argv.slice(1) : argv
  const options = { project: false, target: null, dryRun: false, force: false }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--global") options.project = false
    else if (arg === "--project") options.project = true
    else if (arg === "--target") {
      const value = args[i + 1]
      if (!value) {
        console.error("error: --target requires a directory argument")
        process.exit(2)
      }
      options.target = value
      i += 1
    } else if (arg === "--dry-run") options.dryRun = true
    else if (arg === "--force") options.force = true
    else if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else {
      console.error(`error: unknown argument '${arg}'`)
      printUsage()
      process.exit(2)
    }
  }
  return options
}

/** Resolve the directory that contains the shipped skills. */
function sourceDir() {
  const override = process.env.CODEOPS_PLUGIN_ROOT
  if (override && existsSync(join(override, "skills"))) {
    return join(override, "skills")
  }
  return join(PACKAGE_ROOT, "skills")
}

/**
 * List every file inside every skill directory, as paths relative to the
 * skills directory. A directory counts as a skill when it contains SKILL.md.
 */
function listSkillFiles(skillsDir) {
  const files = []
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const skillDir = join(skillsDir, entry.name)
    if (!existsSync(join(skillDir, "SKILL.md"))) continue
    collectFiles(skillDir, skillsDir, files)
  }
  return files
}

/** Recursively collect file paths under `dir`, relative to `base`. */
function collectFiles(dir, base, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(fullPath, base, out)
    else if (entry.isFile()) out.push(relative(base, fullPath))
  }
}

/**
 * Copy the skill files into the target directory.
 *
 * @returns {{installed: number, upToDate: number, conflicts: number, skills: number}}
 *   Counts for the final summary. A conflict is a file that exists with
 *   different content and was skipped because `--force` was not passed.
 */
function install(source, target, options) {
  const files = listSkillFiles(source)
  const skills = new Set(files.map((file) => file.split(/[\\/]/)[0])).size
  const counts = { skills, installed: 0, upToDate: 0, conflicts: 0 }
  const prefix = options.dryRun ? "[dry-run] would " : ""

  for (const file of files) {
    const from = join(source, file)
    const to = join(target, file)

    if (existsSync(to)) {
      const identical = readFileSync(from).equals(readFileSync(to))
      if (identical) {
        counts.upToDate += 1
        continue
      }
      if (!options.force) {
        console.log(`conflict, skipped (use --force to overwrite): ${to}`)
        counts.conflicts += 1
        continue
      }
      console.log(`${prefix}overwrite: ${to}`)
      if (!options.dryRun) cpSync(from, to)
      counts.installed += 1
      continue
    }

    console.log(`${prefix}install: ${to}`)
    if (!options.dryRun) {
      mkdirSync(dirname(to), { recursive: true })
      cpSync(from, to)
    }
    counts.installed += 1
  }
  return counts
}

/** Entry point: resolve paths, run the install, and print a summary. */
function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    printUsage()
    return
  }
  const options = parseArgs(args)

  const source = sourceDir()
  if (!existsSync(source)) {
    console.error(`error: skills directory not found: ${source}`)
    process.exit(1)
  }

  let target
  if (options.target) target = resolve(options.target)
  else if (options.project) target = resolve(".opencode", "skills")
  else target = join(homedir(), ".config", "opencode", "skills")

  console.log(`Source: ${source}`)
  console.log(`Target: ${target}`)

  const counts = install(source, target, options)
  const mode = options.dryRun ? " (dry-run, nothing written)" : ""
  console.log(
    `Done${mode}: ${counts.skills} skills | ` +
      `installed/updated ${counts.installed} files, ` +
      `${counts.upToDate} already up to date, ` +
      `${counts.conflicts} conflicts skipped`
  )
  if (counts.conflicts > 0) {
    console.log("Re-run with --force to overwrite conflicting files.")
  }
}

main()
