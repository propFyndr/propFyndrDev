import { test } from 'node:test'
import assert from 'node:assert/strict'
import { realPeopleSessions, realLeads, realSaves, realPeopleQueryMetrics, realPeoplePropertyEvents } from '../cohort'
import { WEBSITE_GUEST_TOKEN } from '../../botDetection'

const flat = (s: { sql: string }) => s.sql.replace(/\s+/g, ' ')
const TEAM = /NOT EXISTS \(SELECT 1 FROM team_identities t WHERE t\.key IN \(\w+\.person, \w+\.user_id, \w+\.guest_token\)\)/

test('a real person session: not a bot, an account or a website guest token, team excluded', () => {
  const s = realPeopleSessions()
  const sql = flat(s)
  assert.match(sql, /cs\.is_bot = false/)
  assert.match(sql, /cs\.user_id IS NOT NULL OR cs\.guest_token ~ \?/)
  assert.ok(s.values.includes(WEBSITE_GUEST_TOKEN), 'guest-token pattern is a bound value')
  assert.match(sql, /referral_visits rv WHERE rv\.guest_token = cs\.guest_token/, 'guest→account link')
  assert.match(sql, TEAM)
  // NOT IN against a NULL person would drop rows silently.
  assert.doesNotMatch(sql, /NOT IN \(SELECT key FROM team_identities\)/)
})

test('the People list can include team', () => {
  assert.doesNotMatch(flat(realPeopleSessions({ includeTeam: true })), /team_identities/)
})

test('a real lead: callbacks not marked test plus site visits, team excluded', () => {
  const sql = flat(realLeads())
  assert.match(sql, /FROM callback_requests cr WHERE cr\.is_test = false/)
  assert.match(sql, /FROM site_visit_requests sv/)
  assert.doesNotMatch(sql, /sv\.is_test/)
  assert.match(sql, TEAM)
})

test('saves split the guest_ prefix before the person and team checks', () => {
  const sql = flat(realSaves())
  assert.match(sql, /left\(sp\.user_id, 6\) = 'guest_'/)
  assert.match(sql, /substr\(sp\.user_id, 7\)/)
  assert.match(sql, TEAM)
})

test('query metrics and property events join the cohort on session id', () => {
  assert.match(flat(realPeopleQueryMetrics()), /FROM query_metrics q JOIN \(.*\) rqs ON rqs\.id = q\.session_id/)
  assert.match(flat(realPeoplePropertyEvents()), /FROM property_events pe JOIN \(.*\) rpe ON rpe\.id = pe\.session_id/)
})
