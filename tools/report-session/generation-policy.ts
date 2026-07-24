import type {
  CompileReportInput,
} from '../../src/capabilities/work-session-reporting/index.ts';

type GenerationReportPolicy = Pick<CompileReportInput, 'outcome' | 'nextActions'>;

export function reportGenerationPolicy(final: boolean): GenerationReportPolicy {
  return {
    outcome: {
      status: final ? 'complete' : 'partial',
      headline: final
        ? 'One session now becomes one accepted visual report.'
        : 'The visual reporting proof of concept is taking shape.',
      summary: final
        ? 'A completed Codex session and executed repository proof now produce one immutable local report revision.'
        : 'This local preview is intentionally not a verified completion report.',
    },
    nextActions: final
      ? []
      : [{
          id: 'run-final-generation',
          label: 'Generate with an explicit session, completion confirmation, and executed proof',
          status: 'next',
          dependsOn: [],
        }],
  };
}
