import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProjectPricingTab from '@/components/property-detail/ProjectPricingTab';

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/whatsapp', () => ({ buildWhatsAppUrl: () => null, trackWhatsAppHandoff: jest.fn() }));

// A project with a priced unit but no cost sheet and no payment plan must not
// be given typical charges (club 2L, IFMS 75k, utilities 1.25L, PLC 2%) or a
// template payment schedule.
const unit = { id: 'u1', name: '3 BHK', bhk: 3, bathrooms: 3, super_area_sqft: 1500, price_min_cr: 1.5, price_max_cr: 1.6 } as any;
const detail = { name: 'Bare Project', status: 'under_construction', cost_sheet: null, payment_plan: null, payment_plans: [] } as any;

describe('ProjectPricingTab with no cost sheet or plan on record', () => {
  it('names the missing charges instead of filling them', () => {
    const { container } = render(<ProjectPricingTab unitTypes={[unit]} detail={detail} onGoToCosts={() => {}} />);
    const text = container.textContent ?? '';
    for (const invented of ['₹2,00,000', '₹75,000', '₹1,25,000', '₹3,00,000']) {
      expect(text).not.toContain(invented);
    }
    expect(screen.getByText(/Not on record for this project: PLC, club membership, IFMS, other charges/)).toBeInTheDocument();
  });

  it('shows no template payment schedule', () => {
    const { container } = render(<ProjectPricingTab unitTypes={[unit]} detail={detail} onGoToCosts={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Illustrative schedule|ICICI|Excavation & Substructure|Top slab casting/);
    expect(screen.getByText(/payment plan is not on record for this project/)).toBeInTheDocument();
  });

  it('a ready-to-move project without an OC on record is not given 0% GST', () => {
    const { container } = render(
      <ProjectPricingTab unitTypes={[unit]} detail={{ ...detail, status: 'ready_to_move' }} onGoToCosts={() => {}} />,
    );
    expect(container.textContent).not.toMatch(/GST \(0%\)|OC Received|0% GST Exempt/);
    expect(container.textContent).toMatch(/OC not on record/);
  });
});
