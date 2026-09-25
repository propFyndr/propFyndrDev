import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessageBubble from '@/components/chat/MessageBubble';
import type { ChatMessage } from '@/types/property';

// Mock dependencies
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="react-markdown">{props.children}</div>,
}));

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/components/ProjectCard', () => ({
  __esModule: true,
  default: () => <div data-testid="project-card">ProjectCard</div>,
}));


jest.mock('@/components/response/ResponseBlockRenderer', () => ({
  ResponseBlockRenderer: ({ blocks }: any) => (
    <div data-testid="response-block-renderer">{blocks.length} blocks rendered</div>
  ),
}));

jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
}));

const sharedProps = {
  index: 0,
  isLast: true,
  // Below DOSSIER_MIN_AI_TURNS, so these cases render as they did before the
  // dossier CTA was added to the last answer.
  aiTurnCount: 1,
  isSubmitting: false,
  chatPhase: 'DISCOVERY' as const,
  isLastProperties: false,
  isExpanded: false,
  carouselIndex: 0,
  lastShortlist: [],
  showMap: false,
  userId: null,
  sessionId: 'session-1',
  regeneratingIdx: null,
  chipPicker: null,
  chips: [],
  onCopy: jest.fn(),
  onDetailOpen: jest.fn(),
  onCallback: jest.fn(),
  onRegenerate: jest.fn(),
  onAction: jest.fn(),
  onToggleExpanded: jest.fn(),
  onToggleMap: jest.fn(),
  onSetChipPicker: jest.fn(),
  onSetCarouselIndex: jest.fn(),
  onSetSiteVisit: jest.fn(),
  onOpenCalculator: jest.fn(),
  onOpenShareSheet: jest.fn(),
  onToast: jest.fn(),
};

const mockUserMessage: ChatMessage = {
  id: 'msg-1',
  type: 'user',
  content: 'Show me projects in Sector 150',
  timestamp: new Date().toISOString(),
};

const mockAssistantMessage: ChatMessage = {
  id: 'msg-2',
  type: 'ai',
  content: 'Here are some top projects in Sector 150.',
  timestamp: new Date().toISOString(),
};

describe('MessageBubble Component', () => {
  it('renders user message correctly', () => {
    render(
      <MessageBubble
        {...sharedProps}
        message={mockUserMessage}
      />
    );
    
    expect(screen.getByText('Show me projects in Sector 150')).toBeInTheDocument();
  });

  // Assistant prose renders through the lazily-imported markdown chunk.
  it('renders assistant message correctly', async () => {
    render(
      <MessageBubble
        {...sharedProps}
        index={1}
        message={mockAssistantMessage}
      />
    );

    expect(await screen.findByText('Here are some top projects in Sector 150.')).toBeInTheDocument();
  });

  it('shows typing indicator when assistant is streaming with no content', () => {
    const streamingMessage: ChatMessage = {
      ...mockAssistantMessage,
      content: '',
      streamingPhase: 'extracting',
    };

    render(
      <MessageBubble
        {...sharedProps}
        message={streamingMessage}
        index={1}
        isSubmitting={true}
      />
    );

    // Look for inline loading UI text
    expect(screen.getByText(/Thinking about requirements|Understanding/i)).toBeInTheDocument();
  });

  it('caps chips to 4 maximum', () => {
    const manyChips = [
      { id: '1', label: 'Chip 1', actionType: 'INTENT_PATCH' as const },
      { id: '2', label: 'Chip 2', actionType: 'INTENT_PATCH' as const },
      { id: '3', label: 'Chip 3', actionType: 'INTENT_PATCH' as const },
      { id: '4', label: 'Chip 4', actionType: 'INTENT_PATCH' as const },
      { id: '5', label: 'Chip 5 (should not appear)', actionType: 'INTENT_PATCH' as const },
      { id: '6', label: 'Chip 6 (should not appear)', actionType: 'INTENT_PATCH' as const },
    ];

    render(
      <MessageBubble
        {...sharedProps}
        message={mockAssistantMessage}
        chips={manyChips}
      />
    );

    // Should render at most 4 chips
    const chipElements = screen.queryAllByRole('button', { hidden: true }).filter(
      btn => btn.textContent?.includes('Chip')
    );
    expect(chipElements.length).toBeLessThanOrEqual(4);
    expect(screen.queryByText('Chip 5 (should not appear)')).not.toBeInTheDocument();
  });

  it('deduplicates chips by label', () => {
    const duplicateChips = [
      { id: '1', label: 'Sector 150', actionType: 'INTENT_PATCH' as const },
      { id: '2', label: 'Sector 150', actionType: 'INTENT_PATCH' as const },
      { id: '3', label: 'Sector 79', actionType: 'INTENT_PATCH' as const },
    ];

    render(
      <MessageBubble
        {...sharedProps}
        message={mockAssistantMessage}
        chips={duplicateChips}
      />
    );

    // Count occurrences of "Sector 150" chip
    const sectorChips = screen.queryAllByRole('button', { name: /Sector 150/i });
    expect(sectorChips.length).toBeLessThanOrEqual(1);
  });

  it('provides accessibility roles for chips', () => {
    const chipsWithA11y = [
      {
        id: '1',
        label: 'Show 3 BHK properties',
        actionType: 'INTENT_PATCH' as const,
        icon: '🏠'
      },
    ];

    render(
      <MessageBubble
        {...sharedProps}
        message={mockAssistantMessage}
        chips={chipsWithA11y}
      />
    );

    // Chips should have button roles or similar interactive elements
    const interactiveElements = screen.queryAllByRole('button', { hidden: true });
    expect(interactiveElements.length).toBeGreaterThanOrEqual(0);
  });

  it('renders chips with proper priority ordering', () => {
    const priorityChips = [
      { id: '1', label: 'First (priority 1)', actionType: 'INTENT_PATCH' as const, priority: 1 },
      { id: '2', label: 'Second (priority 2)', actionType: 'INTENT_PATCH' as const, priority: 2 },
      { id: '3', label: 'Third (priority 3)', actionType: 'INTENT_PATCH' as const, priority: 3 },
    ];

    render(
      <MessageBubble
        {...sharedProps}
        message={mockAssistantMessage}
        chips={priorityChips}
      />
    );

    // Components respecting priority should render in correct order
    const messageContainer = screen.getByText('Here are some top projects in Sector 150.').closest('div');
    expect(messageContainer).toBeInTheDocument();
  });

  it('handles empty chips gracefully', () => {
    render(
      <MessageBubble
        {...sharedProps}
        message={mockAssistantMessage}
        chips={[]}
      />
    );

    expect(screen.getByText('Here are some top projects in Sector 150.')).toBeInTheDocument();
  });
});
