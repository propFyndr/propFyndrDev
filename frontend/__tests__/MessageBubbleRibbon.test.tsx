import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessageBubble from '@/components/chat/MessageBubble';
import type { ChatMessage } from '@/types/property';

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
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/components/ProjectCard', () => ({
  __esModule: true,
  default: () => <div data-testid="project-card">ProjectCard</div>,
}));
jest.mock('@/components/response/ResponseBlockRenderer', () => ({
  ResponseBlockRenderer: ({ blocks }: any) => <div>{blocks.length} blocks rendered</div>,
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

const sharedProps = {
  index: 1,
  isLast: true,
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

const project = (i: number, sector: string) => ({ id: `p${i}`, slug: `p${i}`, name: `Project ${i}`, sector }) as any;

function ribbonText(overrides: Partial<ChatMessage>): string {
  const message = {
    id: 'm',
    type: 'ai',
    content: 'Here you go.',
    timestamp: new Date().toISOString(),
    ...overrides,
  } as ChatMessage;
  const { container } = render(<MessageBubble {...sharedProps} message={message} />);
  const ribbon = Array.from(container.querySelectorAll('span')).find((s) => /propert(y|ies)/.test(s.textContent ?? '') && /\d/.test(s.textContent ?? ''));
  // The ribbon's label and the sector span sit in one row.
  return ribbon?.parentElement?.textContent ?? '';
}

describe('results ribbon', () => {
  const mixed = [project(1, 'Sector 108'), project(2, 'Sector 107'), project(3, 'Sector 150'), project(4, 'Sector 144'), project(5, 'Sector 79'), project(6, 'Sector 108')];

  it('does not stamp the first card\'s sector on a search that spans several', () => {
    const text = ribbonText({ exactResults: mixed });
    expect(text).toContain('6 properties found');
    expect(text).not.toMatch(/Sector 108/);
  });

  it('names the sector when every result is in it', () => {
    const text = ribbonText({ exactResults: [project(1, 'Sector 150'), project(2, 'Sector 150')] });
    expect(text).toContain('2 properties found');
    expect(text).toContain('in Sector 150');
  });

  it('names the sectors the search covered, even when the results are mixed', () => {
    const text = ribbonText({ exactResults: mixed, expansion: { searchedSectors: ['Sector 79', 'Sector 107'] } as any });
    expect(text).toContain('in Sector 79, Sector 107');
  });

  it('says a proximity anchor once, not twice', () => {
    const text = ribbonText({
      exactResults: [project(1, 'Sector 62'), project(2, 'Sector 62')],
      spatialContext: { spatialScope: 'PROXIMITY', anchorSector: 'Sector 62' } as any,
    });
    expect(text.match(/Sector 62/g)).toHaveLength(1);
    expect(text).toContain('2 properties in Sector 62');
  });

  it('never prints "undefined" for a proximity search with no anchor', () => {
    const text = ribbonText({
      exactResults: mixed,
      spatialContext: { spatialScope: 'PROXIMITY' } as any,
    });
    expect(text).not.toContain('undefined');
    expect(text).toContain('6 properties found');
  });
});
