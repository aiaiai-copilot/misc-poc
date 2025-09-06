import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for TextEncoder/TextDecoder for React Router
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;