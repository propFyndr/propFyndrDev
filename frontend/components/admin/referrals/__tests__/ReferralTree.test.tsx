import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ReferralTree, { type ReferralTreeNode } from '../ReferralTree'

function node(overrides: Partial<ReferralTreeNode>): ReferralTreeNode {
  return {
    guestToken: 'g1',
    label: null,
    generation: 1,
    parentGuestToken: null,
    deviceClass: 'mobile',
    os: 'ios',
    appGuess: 'unknown',
    shareChannel: null,
    messageCount: 0,
    activated: false,
    firstSeenAt: '2026-01-01T00:00:00.000Z',
    funnelStage: 'arrived_no_chat',
    visitCount: 1,
    lastSeenAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ReferralTree', () => {
  it('renders collapsed to Gen 1 by default — a Gen-2 child is not visible until expanded', () => {
    const nodes = [
      node({ guestToken: 'root-child', generation: 1, parentGuestToken: null, label: 'Direct Recipient' }),
      node({ guestToken: 'grandchild', generation: 2, parentGuestToken: 'root-child', label: 'Second Gen' }),
    ]
    render(<ReferralTree nodes={nodes} onSelectNode={jest.fn()} />)

    expect(screen.getByText('Direct Recipient')).toBeDefined()
    expect(screen.queryByText('Second Gen')).toBeNull()
  })

  it('expands a branch on click, revealing its children nested under the correct parent', () => {
    const nodes = [
      node({ guestToken: 'root-child', generation: 1, parentGuestToken: null, label: 'Direct Recipient' }),
      node({ guestToken: 'grandchild', generation: 2, parentGuestToken: 'root-child', label: 'Second Gen' }),
    ]
    render(<ReferralTree nodes={nodes} onSelectNode={jest.fn()} />)

    const expandButton = screen.getByLabelText('Expand')
    fireEvent.click(expandButton)

    expect(screen.getByText('Second Gen')).toBeDefined()
  })

  it('nests children under the correct parent, not a flat generation grouping', () => {
    // Two Gen-1 roots, each with their own Gen-2 child — a flat grouping by
    // generation would put both Gen-2 nodes in the same bucket with no way
    // to tell which root they belong to; the real tree must keep them apart.
    const nodes = [
      node({ guestToken: 'rootA', generation: 1, parentGuestToken: null, label: 'Root A' }),
      node({ guestToken: 'rootB', generation: 1, parentGuestToken: null, label: 'Root B' }),
      node({ guestToken: 'childOfA', generation: 2, parentGuestToken: 'rootA', label: 'Child Of A' }),
    ]
    const { container } = render(<ReferralTree nodes={nodes} onSelectNode={jest.fn()} />)

    const expandButtons = screen.getAllByLabelText('Expand')
    // Only rootA has children, so only one expand control should exist.
    expect(expandButtons.length).toBe(1)
    fireEvent.click(expandButtons[0])

    expect(screen.getByText('Child Of A')).toBeDefined()
    const nodesRendered = container.querySelectorAll('[data-testid="tree-node"]')
    expect(nodesRendered.length).toBe(3)
  })

  it('calls onSelectNode with the guest token when a node row is clicked', () => {
    const onSelectNode = jest.fn()
    const nodes = [node({ guestToken: 'g-click', generation: 1, label: 'Clickable' })]
    render(<ReferralTree nodes={nodes} onSelectNode={onSelectNode} />)

    fireEvent.click(screen.getByText('Clickable'))
    expect(onSelectNode).toHaveBeenCalledWith('g-click')
  })

  it('shows a node whose parent is missing at the top level instead of dropping it', () => {
    const nodes = [
      node({ guestToken: 'root', generation: 1, label: 'Direct Recipient' }),
      node({ guestToken: 'orphan', generation: 2, parentGuestToken: 'purged-parent', label: 'Orphaned Gen 2' }),
    ]
    render(<ReferralTree nodes={nodes} onSelectNode={() => {}} />)
    expect(screen.getByText('Orphaned Gen 2')).toBeInTheDocument()
  })
})
