import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('renders the welcome message', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /welcome to misc poc/i })).toBeInTheDocument();
  });

  it('displays the features list', () => {
    render(<HomePage />);
    expect(screen.getByText(/react 18 with typescript/i)).toBeInTheDocument();
    expect(screen.getByText(/vite for fast development/i)).toBeInTheDocument();
    expect(screen.getByText(/react router v7 for routing/i)).toBeInTheDocument();
  });
});