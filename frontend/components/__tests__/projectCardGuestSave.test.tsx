import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProjectCard from '../ProjectCard'
import type { ProjectCard as ProjectCardType } from '@/types/project'

jest.mock('@/lib/authedFetch', () => ({
  authHeaders: async (base: Record<string, string> = {}) => ({ ...base, 'X-Guest-Token': 'guest_test' }),
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn(), trackPropertyEvent: jest.fn(() => Promise.resolve()) }))

// A guest (no user id) is an identity: the save button must reach POST /saved.
// It used to return early on a null userId, so guest saves silently did nothing.
it('a guest save reaches POST /saved', async () => {
  const fetchMock = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }))
  global.fetch = fetchMock as unknown as typeof fetch
  const project = { id: 'p1', slug: 'p1', name: 'Fixture Heights', unit_types: [], images: [] } as unknown as ProjectCardType

  render(<ProjectCard project={project} userId={null} sessionId="s1" />)
  fireEvent.click(screen.getAllByLabelText('Save Fixture Heights')[0])

  await waitFor(() => expect(fetchMock).toHaveBeenCalled())
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toMatch(/\/saved$/)
  expect(init.method).toBe('POST')
})
