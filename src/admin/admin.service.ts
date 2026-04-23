import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Donor } from '../donor/schemas/donor.schema';
import { User } from '../user/schemas/user.schema';
import { AdminRequest } from './schemas/admin-request.schema';
import { AdminComplaint } from './schemas/admin-complaint.schema';
import { AdminRecipient } from './schemas/admin-recipient.schema';
import { AdminInventory } from './schemas/admin-inventory.schema';
import { AdminCampaign } from './schemas/admin-campaign.schema';

type RequestStatus = 'Pending' | 'Approved' | 'Rejected';
type ComplaintStatus = 'Pending' | 'Resolved' | 'Rejected';
type RecipientStatus = 'Active' | 'Inactive';

@Injectable()
export class AdminService implements OnModuleInit {
  private requestsCache: Array<{
    id: string;
    patient: string;
    hospital: string;
    phone: string;
    reason: string;
    bloodType: string;
    quantity: number;
    urgency: string;
    status: RequestStatus;
    createdAt: string;
  }> = [];

  private complaintsCache: Array<{
    id: string;
    from: string;
    subject: string;
    category: string;
    priority: string;
    status: ComplaintStatus;
    description: string;
    createdDate: string;
    resolution?: string;
    email?: string;
    phone?: string;
  }> = [];

  private recipientsCache: Array<{
    id: string;
    name: string;
    age: number;
    gender: string;
    bloodType: string;
    hospital: string;
    city: string;
    phone: string;
    status: RecipientStatus;
    requestDate: string;
  }> = [];

  private inventoryCache: Array<{
    bloodType: string;
    available: number;
    reserved: number;
    expired: number;
    lastUpdated: string;
  }> = [];

  private campaignsCache: Array<{
    id: string;
    name: string;
    description: string;
    startDate: string;
    endDate: string;
    status: string;
    participantsCount: number;
    targetCount: number;
  }> = [];

  constructor(
    @InjectModel(Donor.name) private donorModel: Model<Donor>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(AdminRequest.name) private requestModel: Model<AdminRequest>,
    @InjectModel(AdminComplaint.name) private complaintModel: Model<AdminComplaint>,
    @InjectModel(AdminRecipient.name) private recipientModel: Model<AdminRecipient>,
    @InjectModel(AdminInventory.name) private inventoryModel: Model<AdminInventory>,
    @InjectModel(AdminCampaign.name) private campaignModel: Model<AdminCampaign>,
  ) {}

  async onModuleInit() {
    await this.refreshCaches();
  }

  private async refreshCaches() {
    const [requests, complaints, recipients, inventory, campaigns] = await Promise.all([
      this.requestModel.find().sort({ createdAt: -1 }).lean(),
      this.complaintModel.find().sort({ createdAt: -1 }).lean(),
      this.recipientModel.find().sort({ createdAt: -1 }).lean(),
      this.inventoryModel.find().sort({ bloodType: 1 }).lean(),
      this.campaignModel.find().sort({ createdAt: -1 }).lean(),
    ]);

    this.requestsCache = requests.map((request: any) => ({
      id: String(request._id),
      patient: request.patient,
      hospital: request.hospital,
      phone: request.phone ?? 'N/A',
      reason: request.reason ?? '',
      bloodType: request.bloodType,
      quantity: Number(request.quantity ?? 0),
      urgency: request.urgency,
      status: request.status,
      createdAt: new Date(request.createdAt).toISOString(),
    }));

    this.complaintsCache = complaints.map((complaint: any) => ({
      id: String(complaint._id),
      from: complaint.from,
      subject: complaint.subject,
      category: complaint.category,
      priority: complaint.priority,
      status: complaint.status,
      description: complaint.description ?? '',
      createdDate: new Date(complaint.createdAt).toISOString(),
      resolution: complaint.resolution,
      email: complaint.email,
      phone: complaint.phone,
    }));

    this.recipientsCache = recipients.map((recipient: any) => ({
      id: String(recipient._id),
      name: recipient.name,
      age: Number(recipient.age ?? 0),
      gender: recipient.gender,
      bloodType: recipient.bloodType,
      hospital: recipient.hospital,
      city: recipient.city,
      phone: recipient.phone,
      status: recipient.status,
      requestDate: recipient.requestDate ?? new Date(recipient.createdAt).toISOString(),
    }));

    this.inventoryCache = inventory.map((item: any) => ({
      bloodType: item.bloodType,
      available: Number(item.available ?? 0),
      reserved: Number(item.reserved ?? 0),
      expired: Number(item.expired ?? 0),
      lastUpdated: item.lastUpdated ?? new Date(item.updatedAt ?? item.createdAt).toISOString(),
    }));

    this.campaignsCache = campaigns.map((campaign: any) => ({
      id: String(campaign._id),
      name: campaign.name,
      description: campaign.description ?? '',
      startDate: campaign.startDate ?? '',
      endDate: campaign.endDate ?? '',
      status: campaign.status,
      participantsCount: Number(campaign.participantsCount ?? 0),
      targetCount: Number(campaign.targetCount ?? 0),
    }));
  }

  private paginate<T>(items: T[], page = 1, limit = 10) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const skip = (safePage - 1) * safeLimit;

    return {
      rows: items.slice(skip, skip + safeLimit),
      total: items.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  private async buildDonationChart() {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);

    const donorDocs = await this.donorModel.find({ createdAt: { $gte: startDate } }).select('createdAt').lean();
    const counts = new Map<string, number>();

    donorDocs.forEach((doc: any) => {
      const dateKey = new Date(doc.createdAt).toISOString().split('T')[0];
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
    });

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dateKey = date.toISOString().split('T')[0];
      return { date: dateKey, count: counts.get(dateKey) ?? 0 };
    });
  }

  private async buildDemandChart() {
    const requestDocs = await this.requestModel.find().select('bloodType quantity').lean();
    const counts = new Map<string, number>();

    requestDocs.forEach((doc: any) => {
      counts.set(doc.bloodType, (counts.get(doc.bloodType) ?? 0) + Number(doc.quantity ?? 0));
    });

    const bloodTypes = this.inventoryCache.length > 0 ? this.inventoryCache.map((item) => item.bloodType) : ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    return bloodTypes.map((bloodType) => ({
      bloodType,
      needed: counts.get(bloodType) ?? 0,
    }));
  }

  private buildNotifications() {
    const notifications = [
      ...this.inventoryCache.filter((item) => item.available < 10).map((item) => ({
        id: `inventory-${item.bloodType}`,
        title: 'Low Blood Stock',
        message: `${item.bloodType} blood stock is critically low`,
        type: 'error' as const,
        read: false,
        createdAt: item.lastUpdated,
      })),
      ...this.requestsCache.filter((request) => request.status === 'Pending').slice(0, 5).map((request) => ({
        id: `request-${request.id}`,
        title: 'New Blood Request',
        message: `${request.hospital} requested ${request.bloodType} blood units`,
        type: 'warning' as const,
        read: false,
        createdAt: request.createdAt,
      })),
      ...this.complaintsCache.filter((complaint) => complaint.status === 'Pending').slice(0, 5).map((complaint) => ({
        id: `complaint-${complaint.id}`,
        title: 'Pending Complaint',
        message: complaint.subject,
        type: 'warning' as const,
        read: false,
        createdAt: complaint.createdDate,
      })),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    return {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
    };
  }

  private buildReportSummaries() {
    const totalRequests = this.requestsCache.length;
    const pendingRequests = this.requestsCache.filter((request) => request.status === 'Pending').length;
    const totalUnits = this.inventoryCache.reduce((sum, item) => sum + item.available, 0);
    const openComplaints = this.complaintsCache.filter((complaint) => complaint.status === 'Pending').length;
    const hasData = totalRequests > 0 || totalUnits > 0 || this.complaintsCache.length > 0 || this.campaignsCache.length > 0;

    if (!hasData) {
      return [];
    }

    return [
      {
        id: 'requests-summary',
        title: 'Request Summary Report',
        generatedDate: new Date().toISOString(),
        type: 'Requests',
        status: 'Completed',
      },
      {
        id: 'inventory-summary',
        title: 'Blood Inventory Report',
        generatedDate: new Date().toISOString(),
        type: 'Inventory',
        status: 'Completed',
      },
      {
        id: 'complaints-summary',
        title: 'Complaint Summary Report',
        generatedDate: new Date().toISOString(),
        type: 'Complaints',
        status: 'Completed',
      },
      {
        id: 'campaign-summary',
        title: 'Campaign Overview Report',
        generatedDate: new Date().toISOString(),
        type: 'Campaigns',
        status: 'Completed',
      },
    ].map((report) => ({
      ...report,
      status: report.status,
      content: `Requests: ${totalRequests}, Pending: ${pendingRequests}, Units: ${totalUnits}, Open complaints: ${openComplaints}`,
    }));
  }

  async getDashboardStats() {
    await this.refreshCaches();

    const [totalDonors, activeDonors, recentDonors, donationChart, demandChart] = await Promise.all([
      this.donorModel.countDocuments(),
      this.donorModel.countDocuments({ availability: true }),
      this.donorModel.find().sort({ createdAt: -1 }).limit(5).lean(),
      this.buildDonationChart(),
      this.buildDemandChart(),
    ]);

    const totalRequests = this.requestsCache.length;
    const pendingRequests = this.requestsCache.filter((request) => request.status === 'Pending').length;
    const availableUnits = this.inventoryCache.reduce((sum, item) => sum + item.available, 0);

    return {
      stats: {
        totalDonors,
        totalRequests,
        pendingRequests,
        availableUnits,
        activeDonors,
        inactiveDonors: Math.max(0, totalDonors - activeDonors),
      },
      recentDonors: recentDonors.map((donor: any) => ({
        _id: donor._id,
        name: donor.name,
        email: donor.email,
        phone: donor.phone,
        bloodType: donor.bloodGroup,
        city: donor.city,
        address: donor.address,
        status: donor.availability ? 'active' : 'inactive',
        image: donor.image,
        donationType: donor.donationType,
        rating: donor.rating,
      })),
      chartData: {
        donations: donationChart,
        demand: demandChart,
      },
    };
  }

  async getComplaints(page = 1, limit = 10) {
    await this.refreshCaches();
    const { rows, total, page: currentPage, limit: currentLimit } = this.paginate(this.complaintsCache, page, limit);
    return { complaints: rows, total, page: currentPage, limit: currentLimit };
  }

  async getReports(page = 1, limit = 10) {
    await this.refreshCaches();
    const reports = this.buildReportSummaries();
    const { rows, total, page: currentPage, limit: currentLimit } = this.paginate(reports, page, limit);
    return { reports: rows, total, page: currentPage, limit: currentLimit };
  }

  async getDonors(page = 1, limit = 10) {
    const donors = await this.donorModel.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    const total = await this.donorModel.countDocuments();

    return {
      donors: donors.map((donor: any) => ({
        _id: donor._id,
        name: donor.name,
        email: donor.email,
        phone: donor.phone,
        bloodType: donor.bloodGroup,
        city: donor.city,
        status: donor.availability ? 'Active' : 'Inactive',
        address: donor.address,
        donationType: donor.donationType,
        image: donor.image,
      })),
      total,
      page,
      limit,
    };
  }

  async createDonor(payload: { name: string; email: string; phone: string; bloodType: string; city?: string; address?: string }) {
    return this.donorModel.create({
      userId: new Types.ObjectId(),
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      address: payload.address ?? payload.city ?? 'Unknown',
      city: payload.city ?? 'Unknown',
      bloodGroup: payload.bloodType,
      donationType: 'Blood',
      age: 30,
      weight: '70',
      gender: 'Other',
      availability: true,
      status: 'Free',
    });
  }

  async updateDonor(id: string, payload: { name?: string; email?: string; phone?: string; bloodType?: string; city?: string; address?: string; status?: 'Active' | 'Inactive' }) {
    const donor = await this.donorModel.findById(id);
    if (!donor) {
      return null;
    }

    if (payload.name !== undefined) donor.name = payload.name;
    if (payload.email !== undefined) donor.email = payload.email;
    if (payload.phone !== undefined) donor.phone = payload.phone;
    if (payload.bloodType !== undefined) donor.bloodGroup = payload.bloodType;
    if (payload.city !== undefined) donor.city = payload.city;
    if (payload.address !== undefined) donor.address = payload.address;
    if (payload.status !== undefined) donor.availability = payload.status === 'Active';

    await donor.save();
    return donor;
  }

  async toggleDonorStatus(id: string) {
    const donor = await this.donorModel.findById(id);
    if (!donor) {
      return null;
    }

    donor.availability = !donor.availability;
    await donor.save();
    return donor;
  }

  async deleteDonor(id: string) {
    const result = await this.donorModel.deleteOne({ _id: id });
    return { deleted: result.deletedCount > 0 };
  }

  async getRequests(page = 1, limit = 10) {
    await this.refreshCaches();
    const { rows, total, page: currentPage, limit: currentLimit } = this.paginate(this.requestsCache, page, limit);
    return { requests: rows, total, page: currentPage, limit: currentLimit };
  }

  async createRequest(payload: { patient: string; hospital: string; bloodType: string; quantity: number; urgency: string; phone?: string; reason?: string }) {
    const created = await this.requestModel.create({
      patient: payload.patient,
      hospital: payload.hospital,
      bloodType: payload.bloodType,
      quantity: payload.quantity,
      urgency: payload.urgency,
      phone: payload.phone ?? 'N/A',
      reason: payload.reason ?? '',
      status: 'Pending',
    });

    await this.refreshCaches();
    return created;
  }

  async updateRequest(id: string, payload: { patient?: string; hospital?: string; bloodType?: string; quantity?: number; urgency?: string; phone?: string; reason?: string }) {
    const updated = await this.requestModel.findByIdAndUpdate(
      id,
      {
        ...(payload.patient !== undefined ? { patient: payload.patient } : {}),
        ...(payload.hospital !== undefined ? { hospital: payload.hospital } : {}),
        ...(payload.bloodType !== undefined ? { bloodType: payload.bloodType } : {}),
        ...(payload.quantity !== undefined ? { quantity: payload.quantity } : {}),
        ...(payload.urgency !== undefined ? { urgency: payload.urgency } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
      },
      { new: true },
    ).lean();

    await this.refreshCaches();
    return updated;
  }

  async updateRequestStatus(id: string, status: RequestStatus) {
    const updated = await this.requestModel.findByIdAndUpdate(id, { status }, { new: true }).lean();
    await this.refreshCaches();
    return updated;
  }

  async deleteRequest(id: string) {
    const result = await this.requestModel.deleteOne({ _id: id });
    await this.refreshCaches();
    return { deleted: result.deletedCount > 0 };
  }

  async getRecipients(page = 1, limit = 10) {
    await this.refreshCaches();
    const { rows, total, page: currentPage, limit: currentLimit } = this.paginate(this.recipientsCache, page, limit);
    return { recipients: rows, total, page: currentPage, limit: currentLimit };
  }

  async createRecipient(payload: { name: string; age?: number; gender?: string; bloodType: string; hospital: string; city?: string; phone?: string; status?: RecipientStatus }) {
    const created = await this.recipientModel.create({
      name: payload.name,
      age: payload.age ?? 30,
      gender: payload.gender ?? 'Other',
      bloodType: payload.bloodType,
      hospital: payload.hospital,
      city: payload.city ?? 'Unknown',
      phone: payload.phone ?? 'N/A',
      status: payload.status ?? 'Active',
      requestDate: new Date().toISOString(),
    });

    await this.refreshCaches();
    return created;
  }

  async updateRecipient(id: string, payload: { name?: string; age?: number; gender?: string; bloodType?: string; hospital?: string; city?: string; phone?: string; status?: RecipientStatus }) {
    const updated = await this.recipientModel.findByIdAndUpdate(
      id,
      {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.age !== undefined ? { age: payload.age } : {}),
        ...(payload.gender !== undefined ? { gender: payload.gender } : {}),
        ...(payload.bloodType !== undefined ? { bloodType: payload.bloodType } : {}),
        ...(payload.hospital !== undefined ? { hospital: payload.hospital } : {}),
        ...(payload.city !== undefined ? { city: payload.city } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
      },
      { new: true },
    ).lean();

    await this.refreshCaches();
    return updated;
  }

  async toggleRecipientStatus(id: string) {
    const recipient = await this.recipientModel.findById(id).lean();
    if (!recipient) {
      return null;
    }

    const nextStatus: RecipientStatus = recipient.status === 'Active' ? 'Inactive' : 'Active';
    const updated = await this.recipientModel.findByIdAndUpdate(id, { status: nextStatus }, { new: true }).lean();
    await this.refreshCaches();
    return updated;
  }

  async deleteRecipient(id: string) {
    const result = await this.recipientModel.deleteOne({ _id: id });
    await this.refreshCaches();
    return { deleted: result.deletedCount > 0 };
  }

  async getCampaigns(page = 1, limit = 10) {
    await this.refreshCaches();
    const { rows, total, page: currentPage, limit: currentLimit } = this.paginate(this.campaignsCache, page, limit);
    return { campaigns: rows, total, page: currentPage, limit: currentLimit };
  }

  async getInventory() {
    await this.refreshCaches();
    return { inventory: this.inventoryCache };
  }

  async adjustInventoryUnits(bloodType: string, delta: number) {
    const existing = await this.inventoryModel.findOne({ bloodType }).lean();

    if (!existing && delta < 0) {
      return null;
    }

    if (!existing) {
      const created = await this.inventoryModel.create({
        bloodType,
        available: Math.max(0, delta),
        reserved: 0,
        expired: 0,
        lastUpdated: new Date().toISOString(),
      });

      await this.refreshCaches();
      return created;
    }

    const updated = await this.inventoryModel.findOneAndUpdate(
      { bloodType },
      {
        available: Math.max(0, Number(existing.available ?? 0) + delta),
        lastUpdated: new Date().toISOString(),
      },
      { new: true },
    ).lean();

    await this.refreshCaches();
    return updated;
  }

  async getNotifications() {
    await this.refreshCaches();
    return this.buildNotifications();
  }

  async updateComplaintStatus(id: string, payload: { status: ComplaintStatus; resolution?: string }) {
    const updated = await this.complaintModel.findByIdAndUpdate(
      id,
      {
        status: payload.status,
        ...(payload.resolution !== undefined ? { resolution: payload.resolution } : {}),
      },
      { new: true },
    ).lean();

    await this.refreshCaches();
    return updated;
  }

  async deleteComplaint(id: string) {
    const result = await this.complaintModel.deleteOne({ _id: id });
    await this.refreshCaches();
    return { deleted: result.deletedCount > 0 };
  }

  async exportReports(format: 'json' | 'csv' = 'json') {
    const reports = this.buildReportSummaries();

    if (format === 'csv') {
      const header = 'id,title,type,status,generatedDate';
      const rows = reports.map((report) => `${report.id},"${report.title.replace(/"/g, '""')}",${report.type},${report.status},${report.generatedDate}`);
      return { format: 'csv', content: [header, ...rows].join('\n') };
    }

    return { format: 'json', reports };
  }
}