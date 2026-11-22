import { HealthController } from './health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('returns the exact stable health response', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok', service: 'kaamdham-api' });
  });

  it('does not include environment or dependency details', () => {
    expect(Object.keys(controller.getHealth()).sort()).toEqual(['service', 'status']);
  });
});
