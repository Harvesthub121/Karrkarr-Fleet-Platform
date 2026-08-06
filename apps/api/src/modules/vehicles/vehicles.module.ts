import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleStatusMachineService } from './vehicle-status-machine.service';

@Module({
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleStatusMachineService],
  exports: [VehiclesService, VehicleStatusMachineService],
})
export class VehiclesModule {}
