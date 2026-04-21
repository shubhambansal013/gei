import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase/browser', () => ({
  supabaseBrowser: () => ({
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u' } } }),
    },
  }),
}));

import { PermissionGate } from '../permission-gate';

describe('PermissionGate', () => {
  it('renders children when RPC allows', async () => {
    render(
      <PermissionGate siteId="S1" module="INVENTORY" action="VIEW">
        <span>allowed</span>
      </PermissionGate>,
    );
    await waitFor(() => expect(screen.getByText('allowed')).toBeInTheDocument());
  });
});
