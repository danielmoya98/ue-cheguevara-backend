import { Test, TestingModule } from '@nestjs/testing';
import { TrimestersService } from './trimesters.service';

describe('TrimestersService', () => {
  let service: TrimestersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrimestersService],
    }).compile();

    service = module.get<TrimestersService>(TrimestersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
