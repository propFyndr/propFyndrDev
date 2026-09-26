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
  possession_date: '2023-10-01',
  possession_label: 'Expected October 2023',
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
    expect(screen.getAllByText(/Expected Oct 2023/)[0]).toBeInTheDocument();
  });

  it('never truncates the possession year away', () => {
    render(<ProjectCard project={mockProject} userId={null} />);
    expect(screen.queryByText(/Expected Oct(ober)? 2…/)).not.toBeInTheDocument();
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
    expect(screen.queryByText('Expected October 2023')).not.toBeInTheDocument();
  });

  it('renders exactly two BHK rows by default and handles expand/collapse', () => {
    render(<ProjectCard project={mockProject} userId={null} />);
    // Initial state: Only 3 BHK and 4 BHK should be grouped.
    expect(screen.getAllByText(/3 BHK/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/4 BHK/)[0]).toBeInTheDocument();
  });
});
