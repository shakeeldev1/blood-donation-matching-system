import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdminComplaint } from '../admin/schemas/admin-complaint.schema';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(AdminComplaint.name)
    private readonly complaintModel: Model<AdminComplaint>,
  ) {}

  async createMessage(dto: CreateContactMessageDto) {
    const complaint = await this.complaintModel.create({
      from: dto.name.trim(),
      subject: dto.subject.trim(),
      category: 'Contact',
      priority: 'Medium',
      status: 'Pending',
      description: dto.message.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone?.trim() || undefined,
    });

    return {
      success: true,
      data: {
        id: String((complaint as any)._id),
        createdAt: (complaint as any).createdAt,
      },
    };
  }
}
