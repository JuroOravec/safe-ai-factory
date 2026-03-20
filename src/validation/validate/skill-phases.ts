/**
 * Validates that all `.cursor/skills/../SKILL.md` use `### Phase N: Title` format
 * for workflow steps. Catches:
 * - Non-Phase step headings (e.g. ### 1. Step, ### Some step)
 * - Duplicate phase numbers within a skill
 *
 * Regex for valid phase: ^### Phase (\d+)([ab])?: (.+)$
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { consola } from '../../logger.js';

const SKILLS_DIR = '.cursor/skills';

/** Derive skill name from path: act/dev -> act-dev, project/polish-docs -> project-polish-docs */
function pathToSkillName(relativePath: string): string {
  return relativePath.replace(/\//g, '-');
}

// matches `## Workflow` section heading
const WORKFLOW_SECTION_REGEX = /^##\s+Workflow\s*$/;
// Valid: ### Phase 1: Design, ### Phase 2a: Soft switch
const PHASE_REGEX = /^### Phase (\d+)([ab])?: (.+)$/;

export interface PhaseInfo {
  key: string;
  num: number;
  suffix: string;
  title: string;
}

/**
 * Extracts the content from the start of the `## Workflow` section until the next `##` heading.
 * Returns the section content as a string, or null if none. Stops scanning once the section ends.
 */
function extractWorkflowSection(content: string): string | null {
  const lines = content.split('\n');
  let current = '';
  let inWorkflow = false;

  for (const line of lines) {
    if (!inWorkflow && WORKFLOW_SECTION_REGEX.test(line)) {
      inWorkflow = true;
      continue;
    }
    if (inWorkflow) {
      // End of Workflow: next ## heading (### is still inside)
      if (/^##\s+/.test(line) && !/^###/.test(line)) {
        return current.trim() || null;
      }
      current += line + '\n';
    }
  }
  return current.trim() || null;
}

/**
 * Validates a single Workflow section's content for phase format.
 * Returns a list of violation messages (empty if valid).
 */
function validateWorkflowContent(workflowContent: string, _skillName: string): string[] {
  const violations: string[] = [];
  const seenPhases = new Set<string>();
  const lines = workflowContent.split('\n');

  for (const line of lines) {
    // Only check ###-level headings
    if (!line.startsWith('### ')) continue;

    // Valid Phase format: extract number and optional a/b suffix
    const phaseMatch = line.match(PHASE_REGEX);
    if (phaseMatch) {
      const [, num, suffix = ''] = phaseMatch;
      const phaseKey = `${num}${suffix}`;
      if (seenPhases.has(phaseKey)) {
        violations.push(`  - Duplicate phase: Phase ${phaseKey}`);
      } else {
        seenPhases.add(phaseKey);
      }
      continue;
    } else {
      violations.push(`  - Non-Phase format: '${line.trim()}' (use ### Phase N: Title)`);
      continue;
    }
  }

  return violations;
}

/**
 * Extracts the list of phases from a Workflow section's content.
 * Returns phases in the order they appear in the Workflow section.
 */
function extractPhasesFromWorkflow(workflowContent: string): PhaseInfo[] {
  const phases: PhaseInfo[] = [];
  const lines = workflowContent.split('\n');

  // Extract phases from the Workflow section
  for (const line of lines) {
    if (!line.startsWith('### ')) continue;

    // If we got here, we've got a `### Phase N: Title` line
    const phaseMatch = line.match(PHASE_REGEX);
    if (phaseMatch) {
      const [, numStr, suffix = ''] = phaseMatch;
      phases.push({
        key: `${numStr}${suffix}`,
        num: parseInt(numStr!, 10),
        suffix,
        title: phaseMatch[3]!.trim(),
      });
    }
  }

  return phases;
}

/**
 * Recursively finds all SKILL.md files under skillsDir.
 * Returns { relativePath, absolutePath } pairs.
 */
async function findSkillFiles(opts: {
  dir: string;
  baseDir: string;
  acc?: { relativePath: string; absolutePath: string }[];
}): Promise<{ relativePath: string; absolutePath: string }[]> {
  const { dir, baseDir, acc: rawAcc } = opts;
  const acc = rawAcc ?? [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
  if (entries === null) return acc; // dir not found — skip
  for (const e of entries) {
    const fullPath = path.join(dir, e.name);
    const relativePath = path.relative(baseDir, fullPath);
    if (e.isDirectory() && !e.name.startsWith('.')) {
      await findSkillFiles({ dir: fullPath, baseDir, acc });
    } else if (e.isFile() && e.name === 'SKILL.md') {
      acc.push({ relativePath: path.dirname(relativePath), absolutePath: fullPath });
    }
  }
  return acc;
}

/**
 * Loads the ordered phase list for each skill that has a Workflow section.
 * Returns Map<skillName, PhaseInfo[]>.
 * Skill names are derived from path (act/dev -> act-dev).
 */
export async function getSkillPhasesMap(
  skillsDir: string = SKILLS_DIR,
): Promise<Map<string, PhaseInfo[]>> {
  const skillFiles = await findSkillFiles({ dir: skillsDir, baseDir: skillsDir });
  const result = new Map<string, PhaseInfo[]>();

  for (const { relativePath, absolutePath } of skillFiles.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  )) {
    const skillName = pathToSkillName(relativePath);
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      continue;
    }

    const workflowSection = extractWorkflowSection(content);
    if (workflowSection === null) continue;

    const phases = extractPhasesFromWorkflow(workflowSection);
    if (phases.length > 0) {
      result.set(skillName, phases);
    }
  }

  return result;
}

/**
 * Main entry: discover all skills recursively, extract Workflow sections, validate each.
 * Throws on any violation so the runner exits with code 1.
 */
export default async function validateSkillPhases(): Promise<void> {
  const skillFiles = await findSkillFiles({ dir: SKILLS_DIR, baseDir: SKILLS_DIR });
  const failures: { skillName: string; violations: string[] }[] = [];

  for (const { relativePath, absolutePath } of skillFiles.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  )) {
    const skillName = pathToSkillName(relativePath);
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      continue; // No SKILL.md or unreadable — skip
    }

    const workflowSection = extractWorkflowSection(content);
    if (workflowSection === null) continue; // No Workflow section — skip (e.g. meta-skill-create has placeholders)

    const violations = validateWorkflowContent(workflowSection, skillName);

    if (violations.length > 0) {
      failures.push({ skillName, violations });
    }
  }

  if (failures.length > 0) {
    for (const { skillName, violations } of failures) {
      consola.error(`FAIL: ${skillName}`);
      consola.error(violations.join('\n'));
    }
    throw new Error(
      'Validation failed. Fix the violations above.\nFormat required: ### Phase N: Title or ### Phase Na: Title',
    );
  }

  consola.log('All skills pass phase format validation.');
}
