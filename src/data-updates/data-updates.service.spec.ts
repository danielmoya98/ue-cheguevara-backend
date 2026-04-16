import { Test, TestingModule } from '@nestjs/testing';
import { DataUpdatesService } from './data-updates.service';

describe('DataUpdatesService', () => {
  let service: DataUpdatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataUpdatesService],
    }).compile();

    service = module.get<DataUpdatesService>(DataUpdatesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
