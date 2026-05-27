import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary } from '../src/ErrorBoundary';

function Bomb({ msg }: { msg: string }) {
  throw new Error(msg);
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React vždy logguje uncaught, potlačíme šum v test outputu.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renderuje děti, dokud nedojde k chybě', () => {
    render(<ErrorBoundary><div>obsah</div></ErrorBoundary>);
    expect(screen.getByText('obsah')).toBeInTheDocument();
  });

  it('zachytí výjimku a zobrazí přátelské hlášení + chybovou zprávu', () => {
    render(<ErrorBoundary><Bomb msg="rozbil jsem se" /></ErrorBoundary>);
    expect(screen.getByText(/FOCUS – něco se pokazilo/)).toBeInTheDocument();
    expect(screen.getByText('rozbil jsem se')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Obnovit stránku/ })).toBeInTheDocument();
  });
});
