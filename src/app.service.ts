import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus() {
    return {
      service: 'MTD ITSA API',
      version: '0.1.0',
      status: 'running',
    };
  }
}
