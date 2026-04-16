import { Test, TestingModule } from '@nestjs/testing';
import { DataUpdatesController } from './data-updates.controller';

describe('DataUpdatesController', () => {
  let controller: DataUpdatesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataUpdatesController],
    }).compile();

    controller = module.get<DataUpdatesController>(DataUpdatesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
