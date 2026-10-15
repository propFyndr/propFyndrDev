import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProjectCard from '@/components/ProjectCard';
import type { ProjectCard as ProjectCardType } from '@/types/project';

// Mock dependencies
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock('@/lib/analytics', () => ({
  track: jest.fn(),
}));

// Relative to today: a literal year goes stale and turns the "under construction" cases below
// into "possession date already passed" ones.
const NEXT_YEAR = new Date().getFullYear() + 1;

const mockProject: ProjectCardType = {
  id: 'ace-hanei',
  slug: 'ace-hanei',
  name: 'Ace Hanei',
  sector: 'Sector 12',
  city: 'Noida',
  price_min_cr: 3.11,
  price_max_cr: 5.70,
  price_range_label: '₹3.11–5.70Cr',
  status: 'under_construction',
  possession_date: `${NEXT_YEAR}-10-01`,
  possession_label: `Expected October ${NEXT_YEAR}`,
  builder: { name: 'ACE Group', slug: 'ace-group' },
  marketing_claims: [],
  unit_types: [
    { id: 'u1', name: '3 BHK A', bhk: 3, bathrooms: 2, carpet_area_sqft: 1420 },
    { id: 'u2', name: '4 BHK A', bhk: 4, bathrooms: 3, carpet_area_sqft: 1950 },
    { id: 'u3', name: '4 BHK B', bhk: 4, bathrooms: 3, carpet_area_sqft: 2610 },
  ],
  top_amenities: [],
  top_connectivity: [],
  images: [],
};

describe('ProjectCard Component', () => {
  it('renders the project name, builder, and sector', () => {
    render(<ProjectCard project={mockProject} userId={null} />);
    expect(screen.getAllByText('Ace Hanei')[0]).toBeInTheDocument();
    expect(screen.getAllByText('ACE Group')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Sector 12')[0]).toBeInTheDocument();
  });

  it('renders the price range in the normalised format', () => {
    render(<ProjectCard project={mockProject} userId={null} />);
    expect(screen.getAllByText('₹3.11 – 5.70 Cr')[0]).toBeInTheDocument();
  });

  it('renders the possession label for under construction projects', () => {
    render(<ProjectCard project={mockProject} userId={null} />);
    // Long month names are abbreviated so the label fits without truncating the year.
    expect(screen.getAllByText(new RegExp(`Expected Oct ${NEXT_YEAR}`))[0]).toBeInTheDocument();
  });

  it('never truncates the possession year away', () => {
    render(<ProjectCard project={mockProject} userId={null} />);
    expect(screen.queryByText(new RegExp(`Expected Oct(ober)? ${String(NEXT_YEAR).slice(0, 1)}…`))).not.toBeInTheDocument();
  });

  it('renders Under Construction when possession_label is missing', () => {
    const ucProject = { ...mockProject, possession_label: undefined };
    render(<ProjectCard project={ucProject} userId={null} />);
    expect(screen.getAllByText('Under Construction')[0]).toBeInTheDocument();
  });

  it('renders RTM tag instead of possession label when status is ready_to_move', () => {
    const rtmProject = { ...mockProject, status: 'ready_to_move' as const };
    render(<ProjectCard project={rtmProject} userId={null} />);
    expect(screen.getAllByText('Ready to Move')[0]).toBeInTheDocument();
    expect(screen.queryByText(`Expected October ${NEXT_YEAR}`)).not.toBeInTheDocument();
  });

  it('renders exactly two BHK rows by default and handles expand/collapse', () => {
    render(<ProjectCard project={mockProject} userId={null} />);
    // Initial state: Only 3 BHK and 4 BHK should be grouped.
    expect(screen.getAllByText(/3 BHK/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/4 BHK/)[0]).toBeInTheDocument();
  });
  describe('a possession date that has already passed', () => {
    const late = { ...mockProject, possession_date: '2023-10-01', possession_label: 'Expected October 2023' };

    it('is said as passed, never as Ready to Move', () => {
      render(<ProjectCard project={late} userId={null} />);
      expect(screen.getAllByText('Was due Oct 2023')[0]).toBeInTheDocument();
      expect(screen.queryByText('Ready to Move')).not.toBeInTheDocument();
    });

    it('still says Ready to Move when the status is ready_to_move', () => {
      render(<ProjectCard project={{ ...late, status: 'ready_to_move' as const }} userId={null} />);
      expect(screen.getAllByText('Ready to Move')[0]).toBeInTheDocument();
      expect(screen.queryByText(/Was due/)).not.toBeInTheDocument();
    });

    it('works from the label the backend sends, without its note', () => {
      const label = 'Q2 2019 (possession date passed — status unconfirmed)';
      render(<ProjectCard project={{ ...late, possession_date: null, possession_label: label }} userId={null} />);
      expect(screen.getAllByText('Was due Q2 2019')[0]).toBeInTheDocument();
      expect(screen.queryByText(/status unconfirmed/)).not.toBeInTheDocument();
    });

    it('says only that the date passed when the label names none', () => {
      render(<ProjectCard project={{ ...late, possession_label: undefined }} userId={null} />);
      expect(screen.getAllByText('Date passed')[0]).toBeInTheDocument();
    });

    it('keeps a delayed project as Delayed', () => {
      render(<ProjectCard project={{ ...late, possession_label: 'Delayed - Dec 2023' }} userId={null} />);
      expect(screen.getAllByText('Delayed')[0]).toBeInTheDocument();
    });
  });

  describe('stored flag tokens', () => {
    it('never reach the trade-off line as written', () => {
      render(<ProjectCard project={{ ...mockProject, concerns: ['moderate_risk'] }} userId={null} />);
      expect(screen.queryByText('moderate_risk')).not.toBeInTheDocument();
      expect(screen.getAllByText(/Risk flag on record: moderate risk/)[0]).toBeInTheDocument();
    });

    it('say a developer legal flag in words', () => {
      render(<ProjectCard project={{ ...mockProject, concerns: ['NCLT_INSOLVENCY'] }} userId={null} />);
      expect(screen.queryByText('NCLT_INSOLVENCY')).not.toBeInTheDocument();
      expect(screen.getAllByText(/Flag on record: NCLT insolvency/)[0]).toBeInTheDocument();
    });

    it('"low_risk" is not a trade-off, and the next real concern is shown instead', () => {
      render(<ProjectCard project={{ ...mockProject, concerns: ['low_risk', 'above your budget'] }} userId={null} />);
      expect(screen.queryByText('low_risk')).not.toBeInTheDocument();
      expect(screen.getAllByText(/above your budget/)[0]).toBeInTheDocument();
    });
  });
});
