import React from 'react';
import styles from './HomePage.module.css';

export const HomePage: React.FC = () => {
  return (
    <div className={styles.homePage}>
      <h2>Welcome to Misc PoC</h2>
      <p>This is a React application built with Vite, TypeScript, and modern development tools.</p>
      <div className={styles.features}>
        <h3>Features:</h3>
        <ul>
          <li>React 18 with TypeScript</li>
          <li>Vite for fast development and builds</li>
          <li>React Router v7 for routing</li>
          <li>CSS Modules for styling</li>
          <li>React Testing Library for testing</li>
          <li>Modern ES2020 target</li>
        </ul>
      </div>
    </div>
  );
};