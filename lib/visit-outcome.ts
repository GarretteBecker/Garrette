import type { ChecklistItem, Finding } from '@/lib/types/database';

/**
 * What a visit actually concluded — including when the answer is "nothing".
 *
 * A quarter where nothing is wrong is the product working, and it was the
 * one outcome the report handled worst: the "What we found" section simply
 * vanished, so a perfect visit read as though the page had failed to load.
 *
 * The fix is not a cheerful placeholder. It is evidence: we checked
 * forty-seven things and every one passed. That is worth more to a careful
 * homeowner than a list of problems, and it is the sentence that renews a
 * membership.
 */

export interface VisitOutcome {
  /** No ACTION and no PLAN findings — nothing to repair, nothing to budget. */
  noRepairs: boolean;
  /** Nothing open at all beyond GOOD notes. */
  allClear: boolean;

  /** Checklist items with a real answer (not skipped, not N/A). */
  checked: number;
  passed: number;
  attention: number;
  failed: number;
  notApplicable: number;

  action: number;
  plan: number;
  monitor: number;
  improvement: number;
  good: number;
}

export function visitOutcome(
  findings: Finding[],
  checklist: ChecklistItem[] = [],
): VisitOutcome {
  const open = findings.filter((f) => !f.resolved_at);
  const count = (s: Finding['status']) => open.filter((f) => f.status === s).length;

  const action = count('ACTION');
  const plan = count('PLAN');
  const monitor = count('MONITOR');
  const improvement = count('IMPROVEMENT');
  const good = count('GOOD');

  const passed = checklist.filter((i) => i.result === 'PASS').length;
  const attention = checklist.filter((i) => i.result === 'ATTENTION').length;
  const failed = checklist.filter((i) => i.result === 'FAIL').length;
  const notApplicable = checklist.filter((i) => i.result === 'NOT_APPLICABLE').length;

  return {
    noRepairs: action === 0 && plan === 0,
    allClear: action === 0 && plan === 0 && monitor === 0 && improvement === 0,
    checked: passed + attention + failed,
    passed,
    attention,
    failed,
    notApplicable,
    action,
    plan,
    monitor,
    improvement,
    good,
  };
}

/** The headline on a clean quarter. Stated as a result, not an apology. */
export const CLEAN_HEADLINE = 'No repairs recommended this quarter';

/**
 * The paragraph under it.
 *
 * Never claims a checklist count we do not have, never says "nothing to
 * report" while three MONITOR items sit further down the page, and never
 * says "nothing to budget for" over a Home Plan that still has items on it.
 * A report that contradicts itself two sections later is worse than one
 * that says less.
 */
export function cleanQuarterDetail(o: VisitOutcome, openPlanItems = 0): string {
  const evidence =
    o.checked > 0
      ? `We went through ${o.checked} ${o.checked === 1 ? 'check' : 'checks'} on this visit and ${
          o.passed === o.checked
            ? o.checked === 1 ? 'it passed' : 'every one passed'
            : `${o.passed} passed`
        }.`
      : 'We went through your home and found nothing that needs repairing.';

  if (o.allClear) {
    // "Nothing to budget for" is only true if the Home Plan further down the
    // same report is empty. A report that contradicts itself two sections
    // later is worse than one that says less.
    return openPlanItems > 0
      ? `${evidence} Nothing new to plan for — your Home Plan below is unchanged.`
      : `${evidence} There is nothing for you to do and nothing to budget for.`;
  }

  const watching: string[] = [];
  if (o.monitor > 0) {
    watching.push(
      o.monitor === 1
        ? 'one thing we are keeping an eye on'
        : `${o.monitor} things we are keeping an eye on`,
    );
  }
  if (o.improvement > 0) {
    watching.push(
      o.improvement === 1
        ? 'one optional improvement worth considering'
        : `${o.improvement} optional improvements worth considering`,
    );
  }

  if (watching.length === 0) return evidence;

  const list =
    watching.length === 1 ? watching[0] : `${watching[0]} and ${watching[1]}`;
  return `${evidence} Nothing new to plan for. Further down you will find ${list} — none of it needs doing now.`;
}

/** The short line where the findings section would otherwise be empty. */
export function nothingFoundLine(o: VisitOutcome): string {
  if (o.checked > 0 && o.passed === o.checked) {
    return o.checked === 1
      ? 'Nothing. The one check we made passed.'
      : `Nothing. All ${o.checked} checks passed.`;
  }
  if (o.checked > 0) {
    return `Nothing needing repair. ${o.passed} of ${o.checked} checks passed outright.`;
  }
  return 'Nothing needing repair this quarter.';
}
