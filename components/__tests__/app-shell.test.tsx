import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AppShell } from '../app-shell';
import { usePathname } from 'next/navigation';
import { useSiteStore } from '@/lib/stores/site';
import { createCan } from '@/lib/permissions/can';
import { supabaseBrowser } from '@/lib/supabase/browser';

// Mock Next.js and Supabase
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  supabaseBrowser: vi.fn(() => ({
    auth: {
      signOut: vi.fn(),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/stores/site', () => ({
  useSiteStore: vi.fn(),
}));

vi.mock('@/lib/permissions/can', () => ({
  createCan: vi.fn(),
}));

// Mock Lucide icons to avoid render issues
vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <div data-testid="icon-dashboard" />,
  List: () => <div data-testid="icon-list" />,
  ArrowDownToLine: () => <div data-testid="icon-purchase" />,
  ArrowUpFromLine: () => <div data-testid="icon-issue" />,
  Grid3x3: () => <div data-testid="icon-pivot" />,
  Package: () => <div data-testid="icon-package" />,
  Users2: () => <div data-testid="icon-users" />,
  HardHat: () => <div data-testid="icon-hardhat" />,
  Building2: () => <div data-testid="icon-building" />,
  MapPin: () => <div data-testid="icon-map" />,
  UserCog: () => <div data-testid="icon-usercog" />,
  Ruler: () => <div data-testid="icon-ruler" />,
  ShieldCheck: () => <div data-testid="icon-shield" />,
  BarChart3: () => <div data-testid="icon-chart" />,
  Menu: () => <div data-testid="icon-menu" />,
  X: () => <div data-testid="icon-x" />,
}));

vi.mock('../site-switcher', () => ({
  SiteSwitcher: () => <div data-testid="site-switcher" />,
}));

describe('AppShell Navigation', () => {
  const mockCan = vi.fn();
  const mockGetUser = vi.fn();
  const mockSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue('/dashboard');
    vi.mocked(createCan).mockReturnValue(mockCan);

    vi.mocked(supabaseBrowser).mockReturnValue({
      auth: {
        signOut: vi.fn(),
        getUser: mockGetUser,
      } as any,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })) as any,
    } as any);

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { role_id: 'VIEWER' }, error: null });
  });

  it('renders Dashboard always', async () => {
    vi.mocked(useSiteStore).mockReturnValue({
      currentSite: { id: 'site-1', name: 'Site 1', code: 'S1' },
      sites: [],
      setCurrentSite: vi.fn(),
      setSites: vi.fn(),
    });
    mockCan.mockResolvedValue(false);

    render(<AppShell>Content</AppShell>);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('hides admin-only items for non-admins', async () => {
    vi.mocked(useSiteStore).mockReturnValue({
      currentSite: { id: 'site-1', name: 'Site 1', code: 'S1' },
      sites: [],
      setCurrentSite: vi.fn(),
      setSites: vi.fn(),
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { role_id: 'VIEWER' }, error: null });
    mockCan.mockResolvedValue(true);

    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      expect(screen.queryByText('Sites')).not.toBeInTheDocument();
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
      expect(screen.queryByText('Role permissions')).not.toBeInTheDocument();
    });
  });

  it('shows admin-only items for admins', async () => {
    vi.mocked(useSiteStore).mockReturnValue({
      currentSite: { id: 'site-1', name: 'Site 1', code: 'S1' },
      sites: [],
      setCurrentSite: vi.fn(),
      setSites: vi.fn(),
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { role_id: 'ADMIN' }, error: null });
    mockCan.mockResolvedValue(true);

    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByText('Sites')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Role permissions')).toBeInTheDocument();
    });
  });

  it('shows Inventory section if user has permissions', async () => {
    vi.mocked(useSiteStore).mockReturnValue({
      currentSite: { id: 'site-1', name: 'Site 1', code: 'S1' },
      sites: [],
      setCurrentSite: vi.fn(),
      setSites: vi.fn(),
    });
    mockCan.mockImplementation(async ({ module }) => {
      return module === 'INVENTORY';
    });

    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.getByText('Issue')).toBeInTheDocument();
      expect(screen.getByText('Purchase')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });
  });

  it('hides Reports section if user has no permissions', async () => {
    vi.mocked(useSiteStore).mockReturnValue({
      currentSite: { id: 'site-1', name: 'Site 1', code: 'S1' },
      sites: [],
      setCurrentSite: vi.fn(),
      setSites: vi.fn(),
    });
    mockCan.mockResolvedValue(false);

    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      expect(screen.queryByText('Reports')).not.toBeInTheDocument();
      expect(screen.queryByText('Consumption Pivot')).not.toBeInTheDocument();
    });
  });

  it('shows Reports section if user has permissions', async () => {
    vi.mocked(useSiteStore).mockReturnValue({
      currentSite: { id: 'site-1', name: 'Site 1', code: 'S1' },
      sites: [],
      setCurrentSite: vi.fn(),
      setSites: vi.fn(),
    });
    mockCan.mockImplementation(async ({ module }) => {
      return module === 'REPORTS';
    });

    render(<AppShell>Content</AppShell>);

    await waitFor(() => {
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByText('Consumption Pivot')).toBeInTheDocument();
    });
  });
});
