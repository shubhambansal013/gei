import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableSelect } from '../searchable-select';

const options = [
  { value: '1', label: 'Cement OPC 53' },
  { value: '2', label: 'Rebar 8mm' },
];

describe('SearchableSelect clearing', () => {
  it('allows clearing the selection when clearable is true', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // Render with an existing value and clearable=true
    render(
      <SearchableSelect options={options} value="1" onChange={onChange} placeholder="Item" clearable />,
    );

    const clearButton = screen.getByLabelText('Clear selection');
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does not show clear button when clearable is false', () => {
    const onChange = vi.fn();

    render(
      <SearchableSelect options={options} value="1" onChange={onChange} placeholder="Item" clearable={false} />,
    );

    const clearButton = screen.queryByLabelText('Clear selection');
    expect(clearButton).not.toBeInTheDocument();
  });
});
