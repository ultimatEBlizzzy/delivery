import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPERATING_HOURS, type OperatingHours } from '@hardware-delivery/shared';
import { HoursEditor } from './HoursEditor';

function Harness({ onChange }: { onChange?: (v: OperatingHours) => void }) {
  const [value, setValue] = useState<OperatingHours>(DEFAULT_OPERATING_HOURS);
  return (
    <HoursEditor
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('HoursEditor', () => {
  it('shows each day and disables the time inputs for a closed day', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Monday opens at')).toHaveValue('07:30');
    expect(screen.getByLabelText('Sunday opens at')).toBeDisabled(); // closed by default
    expect(screen.getByLabelText('Saturday closes at')).toHaveValue('13:00');
  });

  it('closing a day via the switch updates the value and disables its times', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Monday open' }));
    expect(onChange.mock.lastCall![0].mon.closed).toBe(true);
    expect(screen.getByLabelText('Monday opens at')).toBeDisabled();
  });

  it('warns when closing time is not after opening time', async () => {
    render(<Harness />);
    const closes = screen.getByLabelText('Tuesday closes at');
    await userEvent.setup().clear(closes);
    await userEvent.setup().type(closes, '06:00');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Closing time must be after opening time',
    );
  });

  it('copies Monday to Tuesday–Friday', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Monday closes at'));
    await user.type(screen.getByLabelText('Monday closes at'), '19:15');
    await user.click(screen.getByRole('button', { name: /copy monday/i }));
    const v: OperatingHours = onChange.mock.lastCall![0];
    expect([v.tue.close, v.wed.close, v.thu.close, v.fri.close]).toEqual([
      '19:15',
      '19:15',
      '19:15',
      '19:15',
    ]);
    expect(v.sat.close).toBe('13:00'); // weekends untouched
  });
});
