import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type DeviceMaintenanceDocument = DeviceMaintenance & Document;

export type MaintenanceType =
  | 'maintenance_preventive'
  | 'maintenance_corrective'
  | 'mise_a_niveau_materielle'
  | 'remplacement'
  | 'nettoyage'
  | 'inspection'
  | 'reparation'
  | 'autre';

export const MaintenanceTypeLabels: Record<MaintenanceType, string> = {
  maintenance_preventive: 'Maintenance préventive',
  maintenance_corrective: 'Maintenance corrective',
  mise_a_niveau_materielle: 'Mise à niveau matérielle',
  remplacement: 'Remplacement',
  nettoyage: 'Nettoyage',
  inspection: 'Inspection',
  reparation: 'Réparation',
  autre: 'Autre',
};

@Schema({ _id: false })
export class Modification {
  @Prop({ type: String, required: true })
  field!: string;

  @Prop({ type: String, default: null })
  oldValue!: string | null;

  @Prop({ type: String, default: null })
  newValue!: string | null;

  @Prop({ type: Date, default: Date.now })
  date!: Date;

  @Prop({ type: String, required: true })
  action!: string;
}

export const ModificationSchema = SchemaFactory.createForClass(Modification);

@Schema({ timestamps: true })
export class DeviceMaintenance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Device', required: true })
  deviceId!: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  @Prop({ type: Date, required: true })
  endDate!: Date;

  @Prop({
    type: String,
    enum: [
      'maintenance_preventive',
      'maintenance_corrective',
      'mise_a_niveau_materielle',
      'remplacement',
      'nettoyage',
      'inspection',
      'reparation',
      'autre',
    ],
    default: 'maintenance_preventive',
  })
  maintenanceType!: MaintenanceType;

  @Prop({ type: Date, default: null })
  lastMaintenanceDate!: Date | null;

  @Prop({ type: Date, default: null })
  nextMaintenanceDate!: Date | null;

  @Prop({ type: [ModificationSchema], default: [] })
  modifications!: Modification[];
}

export const DeviceMaintenanceSchema = SchemaFactory.createForClass(DeviceMaintenance);

DeviceMaintenanceSchema.index({ deviceId: 1 }, { unique: true });
DeviceMaintenanceSchema.index({ nextMaintenanceDate: 1 });
