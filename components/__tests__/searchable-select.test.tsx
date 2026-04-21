import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableSelect } from '../searchable-select';

const options = [
  { value: '1', label: 'Cement OPC 53' },
  { value: '2', label: 'Rebar 8mm' },
  { value: '3', label: 'Cement PPC' },
];

describe('SearchableSelect', () => {
  it('filters by label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect options={options} value={null} onChange={onChange} placeholder="Item" />,
    );
    // The outer Popover trigger has role=combobox; click it to open.
    await user.click(screen.getByRole('combobox'));
    const search = await screen.findByPlaceholderText('Search...');
    await user.type(search, 'rebar');
    expect(await screen.findByText('Rebar 8mm')).toBeInTheDocument();
    expect(screen.queryByText('Cement OPC 53')).not.toBeInTheDocument();
  });

  it('fires onChange with the selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect options={options} value={null} onChange={onChange} placeholder="Item" />,
    );
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Rebar 8mm'));
    expect(onChange).toHaveBeenCalledWith('2');
  });
});
