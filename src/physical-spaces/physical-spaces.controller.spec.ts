import { Test, TestingModule } from '@nestjs/testing';
import { PhysicalSpacesController } from './physical-spaces.controller';
import { PhysicalSpacesService } from './physical-spaces.service';

describe('PhysicalSpacesController', () => {
  let controller: PhysicalSpacesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhysicalSpacesController],
      providers: [PhysicalSpacesService],
    }).compile();

    controller = module.get<PhysicalSpacesController>(PhysicalSpacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
