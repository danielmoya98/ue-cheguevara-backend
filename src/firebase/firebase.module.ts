import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Module({
  providers: [FirebaseService],
  exports: [FirebaseService], // Lo exportamos para que otros módulos (como DataUpdates) lo usen
})
export class FirebaseModule {}
