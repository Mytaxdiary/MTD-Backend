import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

const mockDataSource = {
  query: jest.fn().mockResolvedValue([{ 1: 1 }]),
  isInitialized: true,
};

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(mockDataSource)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health → 200 with ok status', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ok');
        expect(res.body.data.checks.database.status).toBe('ok');
      });
  });

  it('GET /api/v1/ → 200 with service info', () => {
    return request(app.getHttpServer())
      .get('/api/v1/')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.service).toBe('MTD ITSA API');
      });
  });

  it('GET /api/v1/nonexistent → 404', () => {
    return request(app.getHttpServer())
      .get('/api/v1/nonexistent')
      .expect(404)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.statusCode).toBe(404);
      });
  });
});
