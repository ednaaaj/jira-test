/**
 * Sample tests for jira-test demonstration
 * Test titles match Jira subtask summaries exactly
 */

describe('Booking Feature', () => {
  // This test title matches SCRUM-6 subtask summary exactly
  it('This is a subtask testing ticket', () => {
    const result = true;
    expect(result).toBe(true);
  });

  // Example of additional tests you might have
  it('should calculate total price correctly', () => {
    const price = 100;
    const quantity = 2;
    expect(price * quantity).toBe(200);
  });

  it('should validate guest information', () => {
    const guest = { name: 'John', email: 'john@example.com' };
    expect(guest.name).toBeTruthy();
    expect(guest.email).toContain('@');
  });
});
