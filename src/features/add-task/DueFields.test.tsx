import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DueFields } from './DueFields.tsx';

afterEach(cleanup);

describe('DueFields', () => {
  test('C25 inline: two text fields labelled Ngày and Giờ, no visible label', () => {
    const onChange = vi.fn();
    render(<DueFields date="1/1/2027" time="8:00" onChange={onChange} onBlur={() => {}} variant="inline" />);
    const date = screen.getByRole('textbox', { name: 'Ngày' });
    const time = screen.getByRole('textbox', { name: 'Giờ' });
    expect(date.getAttribute('placeholder')).toBe('dd/mm/yyyy');
    expect(time.getAttribute('placeholder')).toBe('hh:mm');
    expect(screen.queryByText('Hạn chót')).toBeNull();
    fireEvent.change(date, { target: { value: '2/1/2027' } });
    expect(onChange).toHaveBeenLastCalledWith('2/1/2027', '8:00');
    fireEvent.change(time, { target: { value: '9:00' } });
    expect(onChange).toHaveBeenLastCalledWith('1/1/2027', '9:00');
  });

  test('C25 pane: the label Hạn chót and its own aria-labels', () => {
    render(<DueFields date="" time="" onChange={() => {}} onBlur={() => {}} variant="pane" />);
    expect(screen.getByText('Hạn chót')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Ngày hạn chót' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Giờ hạn chót' })).toBeTruthy();
  });

  test('C25 onBlur fires only when focus leaves both fields; no error is drawn', () => {
    const onBlur = vi.fn();
    render(
      <>
        <DueFields date="31/02/2026" time="" onChange={() => {}} onBlur={onBlur} variant="inline" />
        <button>ngoài</button>
      </>,
    );
    screen.getByRole('textbox', { name: 'Ngày' }).focus();
    screen.getByRole('textbox', { name: 'Giờ' }).focus();
    expect(onBlur).not.toHaveBeenCalled();
    screen.getByRole('button').focus();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
