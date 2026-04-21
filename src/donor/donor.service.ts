import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { Donor } from './schemas/donor.schema';
import { DonorAppointment } from './schemas/donor-appointment.schema';
import { BloodRequest } from './schemas/blood-request.schema';
import { MailModuleService } from '../mail-module/mail-module.service';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import type {
  DashboardActivityItem,
  DashboardRequestItem,
  DonorAppointmentsResponse,
  DonorDashboardResponse,
  DonorHistoryResponse,
  DonorRequestsResponse,
  DonorSettingsResponse,
  EligibilityChartPoint,
  ReadinessChartPoint,
} from './types/donor-dashboard.type';

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
  constructor(
    @InjectModel(Donor.name) private donorModel: Model<Donor>,
    @InjectModel(DonorAppointment.name)
    private appointmentModel: Model<DonorAppointment>,
    @InjectModel(BloodRequest.name)
    private bloodRequestModel: Model<BloodRequest>,
    private readonly configService: ConfigService,
    private readonly mailService: MailModuleService,
  ) {}

  private readonly seedHospitals = [
    'City General Hospital',
    'Red Cross Trauma Unit',
    "St. Mary's Medical Center",
    'Metro Care Center',
    'Community Blood Bank',
  ];

  // Helper method to calculate BMI from weight and height
  private calculateBMI(weight?: string | number, height?: string | number): number | undefined {
    if (!weight || !height) {
      return undefined;
    }

    const w = typeof weight === 'string' ? parseFloat(weight) : weight;
    const h = typeof height === 'string' ? parseFloat(height) : height;

    if (!w || !h || w <= 0 || h <= 0 || isNaN(w) || isNaN(h)) {
      return undefined;
    }

    // BMI = weight(kg) / (height(m)^2)
    const heightInMeters = h / 100;
    const bmi = w / (heightInMeters * heightInMeters);
    return Math.round(bmi * 10) / 10; // Round to 1 decimal place
  }

  getCloudinaryUploadSignature() {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');
    const folder =
      this.configService.get<string>('CLOUDINARY_FOLDER') ??
      'blood-donor-profiles';

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary server configuration is incomplete',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = createHash('sha1')
      .update(`${paramsToSign}${apiSecret}`)
      .digest('hex');

    return {
      cloudName,
      apiKey,
      folder,
      timestamp,
      signature,
    };
  }

  async create(
    userId: string,
    dto: CreateDonorDto,
    verifiedIdentity?: { name?: string; email?: string },
  ): Promise<Donor> {
    const existing = await this.donorModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (existing) {
      throw new ConflictException('Donor profile already exists');
    }

    // Auto-calculate BMI if height is provided
    const bmi = this.calculateBMI(dto.weight, dto.height);

    return this.donorModel.create({
      ...dto,
      bmi,
      name: verifiedIdentity?.name ?? dto.name,
      email: verifiedIdentity?.email ?? dto.email,
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

  async updateByUserId(
    userId: string,
    dto: UpdateDonorDto,
    verifiedIdentity?: { name?: string; email?: string },
  ): Promise<Donor> {
    // Get current donor data to use for BMI calculation
    const currentDonor = await this.donorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();

    if (!currentDonor) {
      throw new NotFoundException('Donor profile not found');
    }

    // Auto-calculate BMI if weight or height is being updated
    const weight = dto.weight ?? currentDonor.weight;
    const height = dto.height ?? currentDonor.height;
    const bmi = this.calculateBMI(weight, height);

    const updateData = {
      ...dto,
      ...(bmi !== undefined ? { bmi } : {}),
      ...(verifiedIdentity?.name ? { name: verifiedIdentity.name } : {}),
      ...(verifiedIdentity?.email ? { email: verifiedIdentity.email } : {}),
    };

    const donor = await this.donorModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: updateData },
        { new: true },
      )
      .lean()
      .exec();
    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }
    return donor as Donor;
  }

  async getDashboard(user: {
    sub: string;
    name: string;
    email: string;
  }): Promise<DonorDashboardResponse> {
    const donor = (await this.donorModel
      .findOne({ userId: new Types.ObjectId(user.sub) })
      .lean()
      .exec()) as Donor | null;

    const donorName = donor?.name ?? user.name ?? 'Donor';
    const today = new Date();
    const lastDonationDate = donor?.lastDonation
      ? new Date(donor.lastDonation)
      : null;
    const nextEligibilityDate = lastDonationDate
      ? new Date(lastDonationDate.getTime() + 56 * 24 * 60 * 60 * 1000)
      : null;

    const daysUntilEligibility = nextEligibilityDate
      ? Math.ceil(
          (nextEligibilityDate.getTime() - today.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    const progressValue =
      daysUntilEligibility === null
        ? 0
        : daysUntilEligibility <= 0
          ? 100
          : Math.round(((56 - Math.min(daysUntilEligibility, 56)) / 56) * 100);
    const matchedRequests = await this.getMatchedRequests(donor, user.sub);

    return {
      donorProfile: donor,
      welcomeName: donorName,
      stats: [
        {
          label: 'Donation Type',
          value: donor?.donationType ?? 'Not set',
          subtext: donor?.bloodGroup
            ? `${donor.bloodGroup} donor`
            : 'Complete profile',
        },
        {
          label: 'Average Rating',
          value: donor ? donor.rating.toFixed(1) : '-',
          badge: donor
            ? { text: donor.status, type: 'success' }
            : undefined,
          subtext: donor ? 'Community trust' : 'Not available',
        },
        {
          label: 'Next Eligibility',
          value: nextEligibilityDate
            ? nextEligibilityDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : 'N/A',
          subtext:
            daysUntilEligibility === null
              ? 'Set your last donation date'
              : daysUntilEligibility <= 0
                ? 'You can donate now'
                : `${daysUntilEligibility} days remaining`,
        },
      ],
      progress: {
        label: 'Eligibility Progress',
        value: progressValue,
      },
      recentActivity: this.buildRecentActivity(donor, today),
      matchedRequests,
      eligibilityChart: this.buildEligibilityChart(donor?.lastDonation, today),
      readinessChart: this.buildReadinessChart(donor, progressValue),
    };
  }

  async getAppointments(userId: string): Promise<DonorAppointmentsResponse> {
    const appointments = await this.appointmentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1, createdAt: -1 })
      .lean()
      .exec();

    const today = new Date();
    const upcomingAppointments = appointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.date);
      return appointment.status !== 'Completed' && appointment.status !== 'Cancelled' && appointmentDate >= today;
    });
    const pastAppointments = appointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.date);
      return appointment.status === 'Completed' || appointment.status === 'Cancelled' || appointmentDate < today;
    });

    return {
      stats: [
        {
          title: 'Upcoming',
          value: String(upcomingAppointments.length),
          label: 'Scheduled visits',
          color: 'blue',
        },
        {
          title: 'Completed',
          value: String(pastAppointments.filter((item) => item.status === 'Completed').length),
          label: 'Lifetime visits',
          color: 'green',
        },
        {
          title: 'Total Booked',
          value: String(appointments.length),
          label: 'All appointments',
          color: 'purple',
        },
      ],
      upcomingAppointments: upcomingAppointments as unknown[],
      pastAppointments: pastAppointments as unknown[],
      locations: [
        'City General Hospital',
        'Red Cross Mobile Camp',
        "St. Mary's Medical Center",
        'Downtown Blood Bank',
      ],
      times: ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
    };
  }

  async createAppointment(userId: string, dto: CreateAppointmentDto) {
    return this.appointmentModel.create({
      userId: new Types.ObjectId(userId),
      ...dto,
      status: 'Pending',
    });
  }

  async cancelAppointment(userId: string, appointmentId: string) {
    const appointment = await this.appointmentModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(appointmentId), userId: new Types.ObjectId(userId) },
        { $set: { status: 'Cancelled' } },
        { new: true },
      )
      .lean()
      .exec();

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async getHistory(userId: string): Promise<DonorHistoryResponse> {
    const donor = await this.donorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();
    const completedAppointments = await this.appointmentModel
      .find({ userId: new Types.ObjectId(userId), status: 'Completed' })
      .sort({ date: -1 })
      .lean()
      .exec();

    const history = completedAppointments.map((item, index) => ({
      id: index + 1,
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      location: item.hospital,
      type: item.type,
      amount: item.type === 'Platelets' ? '250ml' : item.type === 'Plasma' ? '600ml' : '450ml',
      status: item.status,
      certificateId: `CERT-${new Date(item.date).getFullYear()}-${String(index + 1).padStart(3, '0')}`,
    }));

    const totalUnits = completedAppointments.reduce((sum, item) => {
      return sum + (item.type === 'Platelets' ? 250 : item.type === 'Plasma' ? 600 : 450);
    }, 0);

    const lastDonation = donor?.lastDonation ? new Date(donor.lastDonation) : null;
    const daysSinceLastDonation = lastDonation
      ? Math.max(0, Math.ceil((Date.now() - lastDonation.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    return {
      stats: [
        {
          title: 'Total Units',
          value: totalUnits.toLocaleString(),
          label: 'ml donated so far',
          color: 'red',
        },
        {
          title: 'Last Donation',
          value: lastDonation
            ? lastDonation.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : 'N/A',
          label:
            daysSinceLastDonation === null ? 'No donations recorded' : `${daysSinceLastDonation} days ago`,
          color: 'blue',
        },
        {
          title: 'Milestones',
          value: String(Math.floor(completedAppointments.length / 3)),
          label: 'Awards achieved',
          color: 'yellow',
        },
      ],
      history,
    };
  }

  async getRequests(userId: string): Promise<DonorRequestsResponse> {
    const donor = (await this.donorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec()) as Donor | null;

    const myRequests = await this.bloodRequestModel
      .find({ requesterUserId: userId })
      .sort({ createdAt: -1 })
      .limit(12)
      .lean()
      .exec();

    if (!donor) {
      return {
        stats: [
          { label: 'Critical Needs', value: 0, badge: { text: 'Urgent', type: 'error' } },
          { label: 'Nearby Requests', value: 0, subtext: 'Complete profile first' },
          { label: 'My Requests', value: myRequests.length, subtext: 'Requests posted by you' },
        ],
        requests: [],
        myRequests: myRequests.map((request, index) => ({
          requestId: String((request as { _id: Types.ObjectId })._id),
          id: index + 1,
          patientName: request.patientName,
          hospital: request.hospital,
          location: request.location,
          bloodGroup: request.bloodGroup,
          units: Math.max(1, Number(request.units ?? 1)),
          urgency: request.urgency,
          postedTime: this.formatPostedTime(
            (request as { createdAt?: Date }).createdAt,
          ),
          distance: `${Number(request.distanceKm ?? 0).toFixed(1)} km`,
          contact: request.contact,
          status: request.status ?? 'Pending',
        })),
      };
    }

    const matchedRequests = await this.getMatchedRequests(donor, userId, 8);

    return {
      stats: [
        {
          label: 'Critical Needs',
          value: matchedRequests.filter((request) => request.urgency === 'Critical').length,
          badge: { text: 'Urgent', type: 'error' },
        },
        {
          label: 'Nearby Requests',
          value: matchedRequests.length,
          subtext: `Within ${donor.city}`,
        },
        {
          label: 'My Requests',
          value: myRequests.length,
          subtext: 'Requests posted by you',
        },
      ],
      requests: matchedRequests.map((request) => ({
        requestId: request.requestId,
        id: request.id,
        patientName: request.patientName,
        hospital: request.hospital,
        location: request.location,
        bloodGroup: request.bloodGroup,
        units: Math.max(1, Number(request.units ?? 1)),
        urgency: request.urgency,
        postedTime: this.formatPostedTime(request.createdAt),
        distance: request.distance,
        contact: request.contact,
        status: request.status,
      })),
      myRequests: myRequests.map((request, index) => ({
        requestId: String((request as { _id: Types.ObjectId })._id),
        id: index + 1,
        patientName: request.patientName,
        hospital: request.hospital,
        location: request.location,
        bloodGroup: request.bloodGroup,
        units: Math.max(1, Number(request.units ?? 1)),
        urgency: request.urgency,
        postedTime: this.formatPostedTime(
          (request as { createdAt?: Date }).createdAt,
        ),
        distance: `${Number(request.distanceKm ?? 0).toFixed(1)} km`,
        contact: request.contact,
        status: request.status ?? 'Pending',
      })),
    };
  }

  async createRequest(
    user: { sub: string; name: string; email: string },
    dto: CreateBloodRequestDto,
  ) {
    const donor = (await this.donorModel
      .findOne({ userId: new Types.ObjectId(user.sub) })
      .lean()
      .exec()) as Donor | null;

    const created = await this.bloodRequestModel.create({
      requesterUserId: user.sub,
      requesterName: user.name,
      requesterEmail: user.email,
      patientName: dto.patientName?.trim() || user.name,
      hospital: dto.hospital,
      location: dto.location,
      city: dto.city || donor?.city || 'Unknown',
      bloodGroup: dto.bloodGroup,
      units: Math.max(1, Number(dto.units ?? 1)),
      urgency: dto.urgency ?? 'High',
      contact: dto.contact,
      distanceKm: Number(dto.distanceKm ?? 1.5),
      status: 'Pending',
    });

    // Send confirmation email (fire-and-forget)
    this.mailService
      .sendBloodRequestCreatedEmail(user.email, {
        requesterName: user.name,
        patientName: created.patientName,
        bloodGroup: created.bloodGroup,
        units: created.units,
        urgency: created.urgency,
        hospital: created.hospital,
        city: created.city,
        contact: created.contact,
        requestId: String((created as unknown as { _id: Types.ObjectId })._id),
      })
      .catch(() => { /* non-blocking */ });

    return created;
  }

  async updateRequestStatus(
    user: { sub: string; name: string; email: string },
    requestId: string,
    status: 'Pending' | 'Accepted' | 'Fulfilled' | 'Closed',
  ) {
    const request = await this.bloodRequestModel.findById(requestId).lean().exec();

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    const isOwner = request.requesterUserId === user.sub;

    const ensureResponderIsDonor = async () => {
      const donor = await this.donorModel
        .exists({ userId: new Types.ObjectId(user.sub) })
        .exec();
      if (!donor) {
        throw new ForbiddenException('Only donors can accept or fulfill requests');
      }
    };

    const now = new Date();

    // Owner actions
    if (isOwner) {
      if (status === 'Closed') {
        const updated = await this.bloodRequestModel
          .findOneAndUpdate(
            { _id: requestId, requesterUserId: user.sub },
            { $set: { status: 'Closed', closedAt: now } },
            { new: true },
          )
          .lean()
          .exec();
        if (!updated) throw new NotFoundException('Request not found');
        return this.buildRequestStatusResultAndNotify(updated, user);
      }

      if (status === 'Pending') {
        const updated = await this.bloodRequestModel
          .findOneAndUpdate(
            { _id: requestId, requesterUserId: user.sub },
            {
              $set: { status: 'Pending' },
              $unset: {
                acceptedByUserId: 1,
                acceptedByName: 1,
                acceptedAt: 1,
                fulfilledByUserId: 1,
                fulfilledByName: 1,
                fulfilledAt: 1,
                closedAt: 1,
              },
            },
            { new: true },
          )
          .lean()
          .exec();
        if (!updated) throw new NotFoundException('Request not found');
        return this.buildRequestStatusResultAndNotify(updated, user);
      }

      if (status === 'Fulfilled') {
        const updated = await this.bloodRequestModel
          .findOneAndUpdate(
            { _id: requestId, requesterUserId: user.sub },
            {
              $set: {
                status: 'Fulfilled',
                fulfilledByUserId: user.sub,
                fulfilledByName: user.name,
                fulfilledAt: now,
              },
            },
            { new: true },
          )
          .lean()
          .exec();
        if (!updated) throw new NotFoundException('Request not found');
        return this.buildRequestStatusResultAndNotify(updated, user);
      }

      throw new BadRequestException('Owners can set Pending, Fulfilled, or Closed');
    }

    // Responder (non-owner) actions
    await ensureResponderIsDonor();

    if (status === 'Accepted') {
      // Only accept if still pending (prevents races)
      const updated = await this.bloodRequestModel
        .findOneAndUpdate(
          { _id: requestId, status: 'Pending' },
          {
            $set: {
              status: 'Accepted',
              acceptedByUserId: user.sub,
              acceptedByName: user.name,
              acceptedAt: now,
            },
          },
          { new: true },
        )
        .lean()
        .exec();

      if (!updated) {
        // Re-check current status for a better message
        const latest = await this.bloodRequestModel.findById(requestId).lean().exec();
        if (!latest) throw new NotFoundException('Request not found');
        if (latest.status !== 'Pending') {
          throw new ConflictException('This request is no longer pending');
        }
        throw new ConflictException('Could not accept the request');
      }

      return this.buildRequestStatusResultAndNotify(updated, user);
    }

    if (status === 'Fulfilled') {
      // Only the accepting donor can fulfill
      const updated = await this.bloodRequestModel
        .findOneAndUpdate(
          { _id: requestId, status: 'Accepted', acceptedByUserId: user.sub },
          {
            $set: {
              status: 'Fulfilled',
              fulfilledByUserId: user.sub,
              fulfilledByName: user.name,
              fulfilledAt: now,
            },
          },
          { new: true },
        )
        .lean()
        .exec();

      if (!updated) {
        const latest = await this.bloodRequestModel.findById(requestId).lean().exec();
        if (!latest) throw new NotFoundException('Request not found');
        if (latest.status !== 'Accepted') {
          throw new ConflictException('Only accepted requests can be fulfilled');
        }
        throw new ForbiddenException('Only the accepting donor can fulfill this request');
      }

      return this.buildRequestStatusResultAndNotify(updated, user);
    }

    throw new ForbiddenException('Only request owner can apply this status');
  }

  private buildRequestStatusResultAndNotify(
    updated: any,
    user: { sub: string; name: string; email: string },
  ) {
    const result = {
      requestId: String((updated as { _id: Types.ObjectId })._id),
      status: updated.status,
      updatedAt: (updated as { updatedAt?: Date }).updatedAt,
    };

    const recipientEmail = updated.requesterEmail;
    if (recipientEmail) {
      this.mailService
        .sendBloodRequestStatusUpdatedEmail(recipientEmail, {
          requesterName: updated.requesterName ?? 'User',
          patientName: updated.patientName,
          bloodGroup: updated.bloodGroup,
          hospital: updated.hospital,
          status: updated.status,
          updatedByName: user.name,
          requestId: result.requestId,
        })
        .catch(() => {
          /* non-blocking */
        });
    }

    return result;
  }

  async getSettings(user: { sub: string; name: string; email: string }): Promise<DonorSettingsResponse> {
    const donor = await this.donorModel
      .findOne({ userId: new Types.ObjectId(user.sub) })
      .lean()
      .exec();

    return {
      notifications: donor?.notificationSettings ?? {
        email: true,
        sms: false,
        urgentAlerts: true,
        promotions: false,
      },
      profile: {
        name: donor?.name ?? user.name,
        email: donor?.email ?? user.email,
      },
    };
  }

  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    const donor = await this.donorModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: Object.fromEntries(Object.entries(dto).map(([key, value]) => [`notificationSettings.${key}`, value])) },
        { new: true, upsert: false },
      )
      .lean()
      .exec();

    if (!donor) {
      throw new NotFoundException('Donor profile not found');
    }

    return {
      notifications: donor.notificationSettings,
      profile: {
        name: donor.name,
        email: donor.email,
      },
    };
  }

  async deleteByUserId(userId: string) {
    await this.appointmentModel.deleteMany({ userId: new Types.ObjectId(userId) });
    await this.donorModel.deleteOne({ userId: new Types.ObjectId(userId) });
  }

  private buildRecentActivity(
    donor: Donor | null,
    today: Date,
  ): DashboardActivityItem[] {
    if (!donor) {
      return [];
    }

    const items: DashboardActivityItem[] = [
      {
        id: 'profile-created',
        title: 'Donor profile completed',
        subtitle: `${donor.city} • ${donor.donationType}`,
        date: today.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        status: 'Completed',
      },
    ];

    if (donor.lastDonation) {
      items.unshift({
        id: 'last-donation',
        title: `Last ${donor.donationType} donation`,
        subtitle: donor.address,
        date: new Date(donor.lastDonation).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        status: 'Completed',
      });
    }

    return items;
  }

  private async getMatchedRequests(
    donor: Donor | null,
    viewerUserId?: string,
    limit = 3,
  ): Promise<
    Array<
      DashboardRequestItem & {
        requestId: string;
        patientName: string;
        units: number;
        createdAt?: Date;
        contact: string;
        status: 'Pending' | 'Accepted' | 'Fulfilled' | 'Closed';
      }
    >
  > {
    if (!donor) {
      return [];
    }

    await this.ensureSeedRequests(donor.city);

    const compatibleGroups = this.getCompatibleGroups(donor.bloodGroup);
    const docs = await this.bloodRequestModel
      .find({
        city: donor.city,
        bloodGroup: { $in: compatibleGroups },
        ...(viewerUserId ? { requesterUserId: { $ne: viewerUserId } } : {}),
        $or: [
          { status: 'Pending' },
          ...(viewerUserId
            ? [{ status: 'Accepted', acceptedByUserId: viewerUserId }]
            : []),
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const fallbackDocs =
      docs.length >= limit
        ? docs
        : await this.bloodRequestModel
            .find({
              bloodGroup: { $in: compatibleGroups },
              ...(viewerUserId ? { requesterUserId: { $ne: viewerUserId } } : {}),
              $or: [
                { status: 'Pending' },
                ...(viewerUserId
                  ? [{ status: 'Accepted', acceptedByUserId: viewerUserId }]
                  : []),
              ],
            })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .exec();

    const requests = docs.length > 0 ? docs : fallbackDocs;

    return requests.map((request, index) => ({
      requestId: String((request as { _id: Types.ObjectId })._id),
      id: index + 1,
      hospital: request.hospital,
      location: `${request.city} • ${request.location}`,
      bloodGroup: request.bloodGroup,
      urgency: request.urgency,
      distance: `${request.distanceKm.toFixed(1)} km`,
      patientName: request.patientName ?? `Patient ${index + 1}`,
      units: Math.max(1, Number(request.units ?? 1)),
      createdAt: (request as { createdAt?: Date }).createdAt,
      contact: request.contact ?? 'N/A',
      status: request.status ?? 'Pending',
    }));
  }

  private async ensureSeedRequests(city: string): Promise<void> {
    const count = await this.bloodRequestModel.estimatedDocumentCount();
    if (count > 0) {
      return;
    }

    const now = Date.now();
    const sampleCities = [city, 'Dhaka', 'Chattogram', 'Khulna'];
    const sampleBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'O+', 'O-'];
    const sampleUrgency: Array<'Critical' | 'High' | 'Moderate'> = [
      'Critical',
      'High',
      'Moderate',
    ];

    const seed = Array.from({ length: 10 }).map((_, index) => ({
      patientName: `Patient ${index + 1}`,
      hospital: this.seedHospitals[index % this.seedHospitals.length],
      location: `Unit ${10 + index}, Emergency Wing`,
      city: sampleCities[index % sampleCities.length],
      bloodGroup: sampleBloodGroups[index % sampleBloodGroups.length],
      units: (index % 3) + 1,
      urgency: sampleUrgency[index % sampleUrgency.length],
      contact: `+8801${String(567000000 + index)}`,
      distanceKm: Number((1.2 + index * 0.8).toFixed(1)),
      createdAt: new Date(now - (index + 1) * 60 * 60 * 1000),
      updatedAt: new Date(now - (index + 1) * 45 * 60 * 1000),
    }));

    await this.bloodRequestModel.insertMany(seed);
  }

  private formatPostedTime(dateValue?: Date): string {
    if (!dateValue) {
      return 'Recently';
    }

    const diffMs = Math.max(0, Date.now() - new Date(dateValue).getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 60) {
      return `${Math.max(1, diffMinutes)} mins ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} hours ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }

  private buildEligibilityChart(
    lastDonation: string | undefined,
    today: Date,
  ): EligibilityChartPoint[] {
    const checkpoints = [0, 14, 28, 42, 56];

    return checkpoints.map((day) => {
      const label = day === 0 ? 'Today' : `Day ${day}`;

      if (!lastDonation) {
        return {
          label,
          readiness: day === 0 ? 0 : Math.round((day / 56) * 100),
          target: Math.round((day / 56) * 100),
        };
      }

      const donatedOn = new Date(lastDonation);
      const checkpointDate = new Date(donatedOn);
      checkpointDate.setDate(checkpointDate.getDate() + day);
      const elapsedDays = Math.max(
        0,
        Math.ceil((today.getTime() - donatedOn.getTime()) / (1000 * 60 * 60 * 24)),
      );

      return {
        label,
        readiness: Math.min(100, Math.round((Math.min(elapsedDays, day) / 56) * 100)),
        target: Math.round((day / 56) * 100),
        checkpointDate: checkpointDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      };
    });
  }

  private buildReadinessChart(
    donor: Donor | null,
    eligibilityProgress: number,
  ): ReadinessChartPoint[] {
    const completenessChecks = [
      donor?.name,
      donor?.email,
      donor?.phone,
      donor?.city,
      donor?.bloodGroup,
      donor?.donationType,
      donor?.gender,
      donor?.weight,
    ];

    const filledFields = completenessChecks.filter(Boolean).length;
    const profileCompleteness = Math.round(
      (filledFields / completenessChecks.length) * 100,
    );
    const availabilityScore = donor?.availability ? 100 : 35;
    const trustScore = donor ? Math.round((donor.rating / 5) * 100) : 0;

    return [
      { name: 'Profile', value: profileCompleteness, color: '#1D3557' },
      { name: 'Eligibility', value: eligibilityProgress, color: '#9F0712' },
      { name: 'Availability', value: availabilityScore, color: '#059669' },
      { name: 'Trust', value: trustScore, color: '#D97706' },
    ];
  }

  private getCompatibleGroups(bloodGroup: string): string[] {
    switch (bloodGroup) {
      case 'O-':
        return ['O-', 'A-', 'B-'];
      case 'O+':
        return ['O+', 'A+', 'B+'];
      case 'A+':
        return ['A+', 'AB+'];
      case 'A-':
        return ['A-', 'AB-'];
      case 'B+':
        return ['B+', 'AB+'];
      case 'B-':
        return ['B-', 'AB-'];
      case 'AB+':
        return ['AB+'];
      default:
        return ['AB-'];
    }
  }
}
