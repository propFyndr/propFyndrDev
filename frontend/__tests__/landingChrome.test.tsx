import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import InvertedPerspectiveCarousel from '@/components/landing/InvertedPerspectiveCarousel';
import { SiteHeader } from '@/components/landing/SiteChrome';

jest.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('landing chrome', () => {
  it('leads with the guest path, not a lone Sign In', () => {
    render(<SiteHeader />);
    const start = screen.getAllByRole('link', { name: 'Start chatting' });
    expect(start.length).toBeGreaterThan(0);
    start.forEach((a) => expect(a).toHaveAttribute('href', '/discover'));
  });

  it('carousel is navigable by tap on a dot and by swipe, and arrows are not hover-only on touch', () => {
    const { container } = render(<InvertedPerspectiveCarousel onSelectPrompt={() => {}} autoPlayInterval={1e9} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Ace Medalleo' }));
    expect(screen.getByText('When is possession at Ace Medalleo, and how sure is it?')).toBeInTheDocument();

    const stage = container.querySelector('.touch-pan-y')!;
    fireEvent.touchStart(stage, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 100 }] });
    expect(screen.getByText('How far is Amrapali Crystal Homes from the metro?')).toBeInTheDocument();

    const next = screen.getByRole('button', { name: 'Next project' });
    expect(next.className).not.toMatch(/(^|\s)opacity-0(\s|$)/);
  });
});
