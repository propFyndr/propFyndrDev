import { matchesResaleDealQuestion } from './resaleDeal'
import { matchesInvestmentScenario, matchesPriceMultiple } from './investmentScenario'
import { matchesPressureQuestion, matchesSiteVisitQuestion, matchesCompromiseQuestion, matchesFirstStepsQuestion } from './buyerSupport'
import { matchesSavedProfileQuestion } from './savedProfile'
import { matchesAirportProximity } from './airportProximity'
import { asksBudgetPlan } from '../../ai/affordability'
import { matchesRoadmapQuestion, roadmapStepFor, matchesCapabilitiesQuestion, matchesTrustQuestion } from './buyerGuide'
import { matchesAmenitySearch } from './amenitySearch'
import { matchesLoanBanks, matchesDeveloperOfEach } from './shortlistFacts'
import { asksProjectPriceHistory } from './priceTrend'
import { matchesBareYes } from './bareYes'
import { offTopicReply } from './offTopic'

/**
 * Topics whose handler is decided by the message alone, with no project, flag or
 * catalogue row. The router has to know about them before its OPEN lane and before
 * its handler gate, or a question with no named project is answered by the model:
 * the replay measured exactly that for every one of these.
 *
 * `priorUserMessages` (oldest first) lets a roadmap follow-up ("next", "step 6")
 * be recognised; without it only the opening question is.
 */
export function matchesMessageOnlyTopic(message: string, priorUserMessages: readonly string[] = []): boolean {
  return matchesResaleDealQuestion(message) || matchesInvestmentScenario(message) || matchesPriceMultiple(message) || matchesAirportProximity(message) || asksBudgetPlan(message) ||
    matchesPressureQuestion(message) || matchesSiteVisitQuestion(message) ||
    matchesCompromiseQuestion(message) || matchesSavedProfileQuestion(message) ||
    matchesFirstStepsQuestion(message) ||
    matchesRoadmapQuestion(message) || roadmapStepFor(message, priorUserMessages) !== null ||
    matchesCapabilitiesQuestion(message) || matchesTrustQuestion(message) ||
    offTopicReply(message) !== null || matchesAmenitySearch(message) || matchesLoanBanks(message) || matchesDeveloperOfEach(message) || asksProjectPriceHistory(message) || matchesBareYes(message)
}
