import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MailService } from '../mail/mail.service';

const mockDataSource = {
  query: jest.fn().mockResolvedValue([{ 1: 1 }]),
  isInitialized: true,
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    mockDataSource.query.mockReset();
    mockDataSource.query.mockResolvedValue([{ 1: 1 }]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        {
          provide: MailService,
          useValue: { sendWelcomeEmail: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
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
