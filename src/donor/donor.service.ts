import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Donor } from './schemas/donor.schema';
import { DonorAppointment } from './schemas/donor-appointment.schema';
import { CreateDonorDto } from './dto/create-donor.dto';
import { UpdateDonorDto } from './dto/update-donor.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
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
  ) {}

  private readonly hospitalNames = [
    'City General Hospital',
    'Metro Care Center',
    "St. Mary's Medical Center",
  ];

  private readonly urgencyLevels = ['High', 'Critical', 'Moderate'];

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
      matchedRequests: this.buildMatchedRequests(donor),
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
    const donor = await this.findByUserId(userId);
    const matchedRequests = this.buildMatchedRequests(donor as Donor);
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
          label: 'Matched Units',
          value: matchedRequests.reduce((sum, _, index) => sum + (index + 1), 0),
          subtext: 'Total units needed',
        },
      ],
      requests: matchedRequests.map((request, index) => ({
        id: request.id,
        patientName: ['Sarah Connor', 'Michael Ross', 'Emily Blunt'][index] ?? `Patient ${index + 1}`,
        hospital: request.hospital,
        location: request.location,
        bloodGroup: request.bloodGroup,
        units: index + 1,
        urgency: request.urgency,
        postedTime: `${index * 3 + 2} hours ago`,
        distance: request.distance,
        contact: `+1 555 000 ${String(index + 1).padStart(3, '0')}`,
      })),
    };
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

  private buildMatchedRequests(donor: Donor | null): DashboardRequestItem[] {
    if (!donor) {
      return [];
    }

    const compatibleGroups = this.getCompatibleGroups(donor.bloodGroup);

    return this.hospitalNames.map((hospital, index) => ({
      id: index + 1,
      hospital,
      location: `${donor.city} • ${donor.donationType} match`,
      bloodGroup: compatibleGroups[index % compatibleGroups.length],
      urgency: this.urgencyLevels[index % this.urgencyLevels.length],
      distance: `${(1.8 + index * 1.3).toFixed(1)} km`,
    }));
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
