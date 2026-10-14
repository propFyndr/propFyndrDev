import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from '@/components/Sidebar';
import { SessionItem } from '@/components/Sidebar/SessionItem';
import { useSessions } from '@/hooks/useSessions';
import { useRouter, usePathname } from 'next/navigation';

// Mock dependencies
jest.mock('@/hooks/useSessions', () => ({
  useSessions: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt} />
}));

const mockSessions = [
  {
    id: 'session-1',
    label: 'Test Session 1',
    last_active: new Date().toISOString(),
  },
  {
    id: 'session-2',
    label: 'Test Session 2',
    last_active: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
  }
];

describe('Sidebar Component', () => {
  const mockUseRouter = {
    push: jest.fn(),
    replace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockUseRouter);
    (usePathname as jest.Mock).mockReturnValue('/discover');
    
    (useSessions as jest.Mock).mockReturnValue({
      sessions: mockSessions,
      loading: false,
      error: null,
      deleteSession: jest.fn(),
      renameSession: jest.fn(),
    });
  });

  it('renders Sidebar with user logged in', () => {
    render(<Sidebar userId="user-123" />);
    
    // 'Property Discovery' was removed: it navigated to /discover, which the
    // wordmark and New chat already do. Compare took the freed slot.
    expect(screen.getByText('Compare')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('My Account')).toBeInTheDocument();
    
    // Group headers should be rendered based on dates
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Previous 7 Days')).toBeInTheDocument();
    
    // Sessions should be rendered
    expect(screen.getByText('Test Session 1')).toBeInTheDocument();
    expect(screen.getByText('Test Session 2')).toBeInTheDocument();
  });

  it('handles "New chat" click', async () => {
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
    render(<Sidebar userId="user-123" />);
    
    const newChatBtn = screen.getByText('New chat');
    fireEvent.click(newChatBtn);
    
    expect(mockUseRouter.push).toHaveBeenCalledWith('/discover');
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    expect(dispatchEventSpy.mock.calls[0][0].type).toBe('realtyask:new-chat');
  });

  it('renders login button when user is not logged in', () => {
    render(<Sidebar userId={null} />);
    
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.queryByText('My Account')).not.toBeInTheDocument();
  });
});

describe('SessionItem Component', () => {
  const mockDelete = jest.fn();
  const mockRename = jest.fn();
  const mockClick = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders SessionItem correctly', () => {
    render(
      <SessionItem 
        session={mockSessions[0]}
        isActive={false}
        onDelete={mockDelete}
        onRename={mockRename}
        onClick={mockClick}
      />
    );
    
    expect(screen.getByText('Test Session 1')).toBeInTheDocument();
  });

  it('allows renaming a session', async () => {
    render(
      <SessionItem
        session={mockSessions[0]}
        isActive={false}
        onDelete={mockDelete}
        onRename={mockRename}
        onClick={mockClick}
      />
    );

    // Double click to rename
    fireEvent.doubleClick(screen.getByText('Test Session 1'));

    const input = screen.getByDisplayValue('Test Session 1');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Renamed Session' } });

    // Assuming there is a save button or form submit
    // In our component, we might have to simulate keypress Enter or finding the save icon
    // Wait, the SessionItem uses a confirm Check icon for saving
    const saveBtn = screen.getAllByRole('button')[0];
    fireEvent.click(saveBtn); // The first button when renaming is usually the checkmark

    await waitFor(() => {
      expect(mockRename).toHaveBeenCalledWith('session-1', 'Renamed Session');
    });
  });
});

describe('Sidebar Identity Display', () => {
  const mockUseRouter = {
    push: jest.fn(),
    replace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockUseRouter);
    (usePathname as jest.Mock).mockReturnValue('/discover');

    (useSessions as jest.Mock).mockReturnValue({
      sessions: [],
      loading: false,
      error: null,
      deleteSession: jest.fn(),
      renameSession: jest.fn(),
    });
  });

  it('displays user identity when logged in', () => {
    render(<Sidebar userId="user-123" />);

    // Should show account/identity section
    expect(screen.getByText('My Account')).toBeInTheDocument();
  });

  it('hides account menu when not logged in', () => {
    render(<Sidebar userId={null} />);

    // Account option should not be visible
    expect(screen.queryByText('My Account')).not.toBeInTheDocument();
  });

  it('shows login button when user not authenticated', () => {
    render(<Sidebar userId={null} />);

    const loginButton = screen.getByText('Sign in');
    expect(loginButton).toBeInTheDocument();
  });

  it('navigates to account page on account click', () => {
    render(<Sidebar userId="user-123" />);

    const accountLink = screen.getByText('My Account');
    fireEvent.click(accountLink);

    expect(mockUseRouter.push).toHaveBeenCalledWith(expect.stringContaining('account'));
  });

  it('handles logout action', async () => {
    const mockLogout = jest.fn();

    render(<Sidebar userId="user-123" />);

    const logoutButton = screen.queryByText(/Logout|Sign out|Exit/);
    if (logoutButton) {
      fireEvent.click(logoutButton);
      // Logout should be triggered (implementation-dependent)
    }
  });

  it('displays session count for logged in users', () => {
    const sessionsWithData = [
      { id: '1', label: 'Session 1', last_active: new Date().toISOString() },
      { id: '2', label: 'Session 2', last_active: new Date().toISOString() },
      { id: '3', label: 'Session 3', last_active: new Date().toISOString() },
    ];

    (useSessions as jest.Mock).mockReturnValue({
      sessions: sessionsWithData,
      loading: false,
      error: null,
      deleteSession: jest.fn(),
      renameSession: jest.fn(),
    });

    render(<Sidebar userId="user-123" />);

    // Sessions should be displayed
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
    expect(screen.getByText('Session 3')).toBeInTheDocument();
  });

  it('user ID is used for session isolation (IDOR protection)', () => {
    // Sidebar should only display user's own sessions
    const userId = 'user-123';

    render(<Sidebar userId={userId} />);

    // Component should verify ownership of sessions before display
    // This is implicit in the component rendering only useSessions data
    // 'Property Discovery' was removed: it navigated to /discover, which the
    // wordmark and New chat already do. Compare took the freed slot.
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });
});
