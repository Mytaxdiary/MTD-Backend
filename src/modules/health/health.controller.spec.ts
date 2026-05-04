import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const mockDataSource = {
  query: jest.fn().mockResolvedValue([{ 1: 1 }]),
  isInitialized: true,
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status with ok database check', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.message).toBe('API is running');
    expect(result.checks.database.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
  });

  it('should return degraded status when DB is unreachable', async () => {
    mockDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await controller.check();
    expect(result.status).toBe('degraded');
    expect(result.checks.database.status).toBe('error');
  });
});
