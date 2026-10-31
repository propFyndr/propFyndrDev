import type { ChatTopicHandler } from '../handlerContext'

/**
 * Jokes, IPOs, bitcoin, weather, match results, code and poems, "which model are
 * you": one short reply and one property question back, no model call.
 *
 * Without this they reached the open lane, where a model answered at length (or
 * a canned trust essay did). Each reply says what we cannot do in one sentence
 * and returns to a question we can answer. The model question names no vendor:
 * more than one provider can serve a turn, so no single name is true.
 *
 * Matchers are narrow on purpose. "cricket pitch", "football turf", "AQI near
 * Sector 150" and "is there a pool" are property questions and must stay out.
 */
const CASES: Array<{ id: string; re: RegExp; reply: string }> = [
  {
    id: 'model',
    re: /\b(?:which|what|kaun\s+sa|konsa)\s+(?:ai\s+)?(?:model|llm|gpt)\s+(?:are\s+you|is\s+this|hai|ho)\b|\bare\s+you\s+(?:chatgpt|gpt|gemini|claude|openai|an?\s+ai)\b/i,
    reply: "I'm RealtyAsk's property advisor. More than one language model can answer behind the scenes, so I can't give you a single name; every project figure comes from our own records. Which project or sector would you like me to check?",
  },
  {
    id: 'joke',
    re: /\b(?:tell|crack|say|sunao|suna)\b[^.?!]{0,20}\b(?:jokes?|chutkula)\b|\bjoke\s+sunao\b|\bmake\s+me\s+laugh\b/i,
    reply: "I'm not a good source of jokes. I only cover homes in Noida and Greater Noida. Are you looking to buy, and roughly what budget do you have in mind?",
  },
  {
    id: 'markets',
    re: /\b(?:ipos?|share\s+market|stock\s+market|mutual\s+funds?|nifty|sensex|intraday|demat)\b/i,
    reply: "I can't advise on IPOs, shares or mutual funds. I only cover homes in Noida and Greater Noida. Do you have a budget in mind for a flat?",
  },
  {
    id: 'crypto-gold',
    re: /\b(?:bitcoin|btc|crypto(?:currency)?|ethereum|dogecoin)\b|\bgold\s+(?:vs|or|instead)\b|\b(?:vs|or|instead\s+of)\s+gold\b/i,
    reply: "I can't advise on bitcoin or gold. I can show what a flat costs in Noida and Greater Noida and what we hold on it. What budget are you weighing?",
  },
  {
    id: 'weather',
    re: /\b(?:weather|mausam)\b/i,
    reply: "I don't have weather data; I only cover Noida and Greater Noida property. Which sector are you thinking about?",
  },
  {
    id: 'sports',
    re: /\b(?:who\s+will\s+win|match\s+tonight|ipl\b|world\s+cup|live\s+score|score\s+today|kaun\s+jeetega)\b/i,
    reply: "I can't predict match results; I only cover Noida and Greater Noida property. Which sector or budget should I look at?",
  },
  {
    id: 'write-something',
    re: /\b(?:write|likh(?:o|na)?)\b[^.?!]{0,30}\b(?:python|javascript|code|program|poem|poetry|essay|song|story|kavita)\b/i,
    reply: "I can't help with that; I only cover Noida and Greater Noida property. What kind of home are you looking for?",
  },
]

export function offTopicReply(message: string): string | null {
  return CASES.find(c => c.re.test(message))?.reply ?? null
}

export const offTopicHandler: ChatTopicHandler = {
  id: 'off_topic',
  description: 'Jokes, markets, weather, sports, code, "which model": one short reply and a property question',

  matches: ctx => offTopicReply(ctx.message) !== null,

  handle: async ctx => {
    ctx.send('token', { token: offTopicReply(ctx.message) as string })
    ctx.emitUiState({
      stage: 'GATHERING',
      thinking: 'Outside what I cover:',
      chips: [
        { id: `chip_off_noida_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Show me what Noida has', icon: 'building', analyticsId: 'chip_off_browse', priority: 1, payload: { text: 'What do you have available in Noida?' } },
      ],
      missingFields: [],
      confidence: 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: ctx.intentState, intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}
