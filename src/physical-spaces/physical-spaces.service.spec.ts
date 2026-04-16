import { Test, TestingModule } from '@nestjs/testing';
import { PhysicalSpacesService } from './physical-spaces.service';

describe('PhysicalSpacesService', () => {
  let service: PhysicalSpacesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PhysicalSpacesService],
    }).compile();

    service = module.get<PhysicalSpacesService>(PhysicalSpacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
