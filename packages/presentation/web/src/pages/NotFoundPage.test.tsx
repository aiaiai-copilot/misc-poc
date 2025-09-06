import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

const renderNotFoundPage = (): JSX.Element => {
  return render(
    <BrowserRouter>
      <NotFoundPage />
    </BrowserRouter>
  );
};

describe('NotFoundPage', () => {
  it('renders the 404 heading', () => {
    renderNotFoundPage();
    expect(
      screen.getByRole('heading', { name: /404 - page not found/i })
    ).toBeInTheDocument();
  });

  it('renders a link to go back home', () => {
    renderNotFoundPage();
    const homeLink = screen.getByRole('link', { name: /go back to home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
