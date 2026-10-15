import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { asksPriceMovement } from '../priceMovement'

describe('asksPriceMovement: questions about how a price moved', () => {
  const asks = [
    // the question from the founder's session, and its close variants
    'Has the price of Ace Parkway changed over the last 12 months?',
    'How has the price of Ace Parkway changed over the last 12 months?',
    'Has Ace Parkway become more expensive this year?',
    'What was the price of Ace Parkway a year ago?',
    'What was the price per sqft of Ace Parkway in 2023?',
    'Price appreciation history of Ace Parkway from 2021 to 2026',
    'Ace Parkway price change last year',
    'price history of Ace Parkway',
    'price trend for Ace Parkway',
    'has the price gone up since I last checked?',
    'did the rates go up in Sector 150 recently',
    'Is Ace Parkway costlier than it was in 2022?',
    'how much has the price increased in 5 years',
    'how much has Ace Parkway gone up',
    'rate per sq ft three years ago',
    'what is the CAGR of Ace Parkway',
    'has the value of Ace Parkway risen',
    'did Ace Parkway prices drop after the metro opened',
    'price movement over the years',
    'prices have increased a lot in Ace Parkway, right?',
    'capital gains on Ace Parkway so far',
    // Hinglish
    'Ace Parkway ka price kitna badh gaya pichle saal?',
    'Ace Parkway ka rate pichle saal kitna tha',
    'daam kitna badha hai Ace Parkway ka',
    'Ace Parkway mehnga hua kya',
    'price badh gaya kya',
  ]
  for (const q of asks) it(`matches: ${q}`, () => assert.equal(asksPriceMovement(q), true))

  const doesNot = [
    'What is the price of Ace Parkway?',
    'Show me the cost sheet of Ace Parkway',
    'What is the total all inclusive price of Ace Parkway?',
    'Is the price negotiable?',
    'Can I change my budget to 2 crore?',
    'What are the payment plans for Ace Parkway?',
    'Show me 3 BHK under 1.5 crore in Sector 150',
    'What is the maintenance rate at Ace Parkway?',
    'How far is the metro from Ace Parkway?',
    'Who is the builder of Ace Parkway?',
    'What is the interest rate on a home loan?',
    'increase my budget to 2 cr',
    'what is the stamp duty rate in UP',
    '',
  ]
  for (const q of doesNot) it(`does not match: "${q}"`, () => assert.equal(asksPriceMovement(q), false))
})
