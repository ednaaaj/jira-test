/**
 * Tests for calculator utility
 * Linked to Jira ticket SCRUM-5
 */

import { add, subtract, multiply, divide, isEven, factorial } from '../../src/utils/calculator';

describe('SCRUM-5', () => {
  describe('Basic arithmetic operations', () => {
    it('adds two numbers correctly', () => {
      expect(add(2, 3)).toBe(5);
      expect(add(-1, 1)).toBe(0);
      expect(add(0, 0)).toBe(0);
    });

    it('subtracts two numbers correctly', () => {
      expect(subtract(5, 3)).toBe(2);
      expect(subtract(0, 5)).toBe(-5);
      expect(subtract(10, 10)).toBe(0);
    });

    it('multiplies two numbers correctly', () => {
      expect(multiply(3, 4)).toBe(12);
      expect(multiply(-2, 3)).toBe(-6);
      expect(multiply(0, 100)).toBe(0);
    });

    it('divides two numbers correctly', () => {
      expect(divide(10, 2)).toBe(5);
      expect(divide(9, 3)).toBe(3);
      expect(divide(7, 2)).toBe(3.5);
    });

    it('throws error when dividing by zero', () => {
      expect(() => divide(10, 0)).toThrow('Cannot divide by zero');
    });
  });

  describe('Number utilities', () => {
    it('checks if number is even', () => {
      expect(isEven(2)).toBe(true);
      expect(isEven(4)).toBe(true);
      expect(isEven(1)).toBe(false);
      expect(isEven(3)).toBe(false);
      expect(isEven(0)).toBe(true);
    });

    it('calculates factorial correctly', () => {
      expect(factorial(0)).toBe(1);
      expect(factorial(1)).toBe(1);
      expect(factorial(5)).toBe(120);
      expect(factorial(3)).toBe(6);
    });

    it('throws error for negative factorial', () => {
      expect(() => factorial(-1)).toThrow('Factorial is not defined for negative numbers');
      expect(() => factorial(-5)).toThrow('Factorial is not defined for negative numbers');
    });
  });

  describe('Edge cases', () => {
    it('handles large numbers', () => {
      expect(add(1000000, 2000000)).toBe(3000000);
      expect(multiply(1000, 1000)).toBe(1000000);
    });

    it('handles decimal numbers', () => {
      expect(add(0.1, 0.2)).toBeCloseTo(0.3);
      expect(multiply(0.5, 0.5)).toBe(0.25);
    });

    it('handles negative numbers', () => {
      expect(add(-5, -3)).toBe(-8);
      expect(multiply(-2, -3)).toBe(6);
      expect(divide(-10, 2)).toBe(-5);
    });
  });
});
