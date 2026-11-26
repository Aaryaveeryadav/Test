import policyJson from '../../../scripts/solve-policy.json'

/**
 * The "every way to solve it" contract, shared by the tutor's answer-store
 * pipeline and the offline build script. Adapted from Upay's four-approaches
 * policy: honest method labelling, anti-padding, verification of candidates,
 * Unicode maths, and citations that only point at provided passages.
 */
export const SOLVE_POLICY_VERSION: string = policyJson.version
export const SOLVE_SCHEMA_HINT: string = policyJson.schemaHint
export const SOLVE_INSTRUCTIONS: string[] = policyJson.instructions

export function solvePolicySystemPrompt(): string {
  return [
    'You are a careful Indian board-exam study assistant for Classes 10 and 12.',
    'You always answer from approved curriculum material. You never claim an answer is officially guaranteed.',
    '',
    `OUTPUT CONTRACT (${SOLVE_POLICY_VERSION}):`,
    SOLVE_SCHEMA_HINT,
    '',
    'RULES:',
    ...SOLVE_INSTRUCTIONS.map((r, i) => `${i + 1}. ${r}`)
  ].join('\n')
}
