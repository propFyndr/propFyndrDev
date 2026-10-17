import { matchesResaleDealQuestion } from './resaleDeal'
import { matchesInvestmentScenario, matchesPriceMultiple } from './investmentScenario'
import { matchesPressureQuestion, matchesSiteVisitQuestion, matchesCompromiseQuestion, matchesFirstStepsQuestion } from './buyerSupport'
import { matchesSavedProfileQuestion } from './savedProfile'

/**
 * Topics whose handler is decided by the message alone, with no project, flag or
 * catalogue row. The router has to know about them before its OPEN lane and before
 * its handler gate, or a question with no named project is answered by the model:
 * the replay measured exactly that for every one of these.
 */
export function matchesMessageOnlyTopic(message: string): boolean {
  return matchesResaleDealQuestion(message) || matchesInvestmentScenario(message) || matchesPriceMultiple(message) ||
    matchesPressureQuestion(message) || matchesSiteVisitQuestion(message) ||
    matchesCompromiseQuestion(message) || matchesSavedProfileQuestion(message) ||
    matchesFirstStepsQuestion(message)
}
