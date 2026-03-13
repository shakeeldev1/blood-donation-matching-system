import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Donor } from './schemas/donor.schema';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';

// Fields excluded from public listing to protect donor privacy
const PUBLIC_PROJECTION = {
  userId: 0,
  medicalConditions: 0,
  weight: 0,
  age: 0,
  gender: 0,
  lastDonation: 0,
};

@Injectable()
export class DonorService {
  constructor(@InjectModel(Donor.name) private donorModel: Model<Donor>) {}

  async create(userId: string, dto: CreateDonorDto): Promise<Donor> {
    const existing = await this.donorModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (existing) {
      throw new ConflictException('Donor profile already exists');
    }
    return this.donorModel.create({
      ...dto,
      userId: new Types.ObjectId(userId),
    });
  }

  findAll(): Promise<Donor[]> {
    return this.donorModel
      .find({}, PUBLIC_PROJECTION)
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<Donor[]>;
  }

  async findByUserId(userId: string): Promise<Donor> {
    const donor = await this.donorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }
    return donor as Donor;
  }

  async updateByUserId(userId: string, dto: UpdateDonorDto): Promise<Donor> {
    const donor = await this.donorModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: dto },
        { new: true },
      )
      .lean()
      .exec();
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }
    return donor as Donor;
  }
}
