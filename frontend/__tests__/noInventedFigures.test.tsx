import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BuilderTab from '@/components/property-detail/BuilderTab';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

// A builder with nothing on record must show nothing invented: no founding
// year, no delivery stats, no stock praise (CLAUDE.md: absent is absent).
describe('BuilderTab with no builder facts on record', () => {
  const builder = { name: 'Bare Builder', slug: 'bare-builder' } as any;
  const project = { name: 'Bare Project', builder: 'Bare Builder' } as any;

  it('shows no default year, stats or praise', () => {
    const { container } = render(<BuilderTab builder={builder} project={project} loading={false} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/2012/);
    expect(text).not.toMatch(/3\.5M\+/);
    expect(text).not.toMatch(/\b3\+/);
    expect(text).not.toMatch(/Years of Legacy/);
    expect(text).not.toMatch(/Timely Delivery|on-time|most trusted|leading real estate developer/i);
    expect(screen.getByText(/Founding year not on record for Bare Builder/)).toBeInTheDocument();
    expect(screen.getByText(/No delivery figures on record for Bare Builder/)).toBeInTheDocument();
  });

  it('derives no square feet from a unit count', () => {
    const { container } = render(
      <BuilderTab builder={{ ...builder, delivered_units: 2000 }} project={project} loading={false} />,
    );
    // 2000 units * 1450 sq ft would print "2.9M+".
    expect(container.textContent).not.toMatch(/2\.9M\+/);
  });
});
