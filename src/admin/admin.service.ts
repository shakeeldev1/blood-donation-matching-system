import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Donor } from '../donor/schemas/donor.schema';
import { User } from '../user/schemas/user.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Donor.name) private donorModel: Model<Donor>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getDashboardStats() {
    const totalDonors = await this.donorModel.countDocuments();
    const activeDonors = await this.donorModel.countDocuments({ status: 'active' });
    const inactiveDonors = totalDonors - activeDonors;
    
    // Mock data for requests and inventory
    const totalRequests = Math.floor(Math.random() * 100) + 50;
    const pendingRequests = Math.floor(Math.random() * 20) + 5;
    const availableUnits = Math.floor(Math.random() * 500) + 100;

    return {
      stats: {
        totalDonors,
        totalRequests,
        pendingRequests,
        availableUnits,
        activeDonors,
        inactiveDonors,
      },
      recentDonors: [],
      chartData: {
        donations: this.generateDonationChart(),
        demand: this.generateDemandChart(),
      },
    };
  }

  async getComplaints(page: number = 1, limit: number = 10) {
    // Mock complaints data
    const complaints = [
      {
        id: 1,
        from: 'john@example.com',
        subject: 'Donation Process Too Long',
        category: 'Process',
        priority: 'High',
        status: 'Open',
        createdDate: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 2,
        from: 'mary@example.com',
        subject: 'Equipment Malfunction',
        category: 'Equipment',
        priority: 'Critical',
        status: 'In Progress',
        createdDate: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: 3,
        from: 'sarah@example.com',
        subject: 'Staff Behavior Issue',
        category: 'Staff',
        priority: 'Medium',
        status: 'Resolved',
        createdDate: new Date(Date.now() - 259200000).toISOString(),
      },
      {
        id: 4,
        from: 'david@example.com',
        subject: 'Poor Facility Maintenance',
        category: 'Facility',
        priority: 'Medium',
        status: 'Open',
        createdDate: new Date(Date.now() - 345600000).toISOString(),
      },
      {
        id: 5,
        from: 'emma@example.com',
        subject: 'Communication Delay',
        category: 'Communication',
        priority: 'Low',
        status: 'Open',
        createdDate: new Date(Date.now() - 432000000).toISOString(),
      },
    ];

    const skip = (page - 1) * limit;
    const paginatedComplaints = complaints.slice(skip, skip + limit);

    return {
      complaints: paginatedComplaints,
      total: complaints.length,
      page,
      limit,
    };
  }

  async getReports(page: number = 1, limit: number = 10) {
    const reports = [
      {
        id: '1',
        title: 'Monthly Donation Report',
        generatedDate: new Date().toISOString(),
        type: 'Donation',
        status: 'Completed',
      },
      {
        id: '2',
        title: 'Blood Inventory Report',
        generatedDate: new Date(Date.now() - 86400000).toISOString(),
        type: 'Inventory',
        status: 'Completed',
      },
      {
        id: '3',
        title: 'Donor Analytics Report',
        generatedDate: new Date(Date.now() - 172800000).toISOString(),
        type: 'Analytics',
        status: 'Completed',
      },
      {
        id: '4',
        title: 'Request Fulfillment Report',
        generatedDate: new Date(Date.now() - 259200000).toISOString(),
        type: 'Request',
        status: 'Completed',
      },
      {
        id: '5',
        title: 'Compliance Report',
        generatedDate: new Date(Date.now() - 345600000).toISOString(),
        type: 'Compliance',
        status: 'Completed',
      },
    ];

    const skip = (page - 1) * limit;
    const paginatedReports = reports.slice(skip, skip + limit);

    return {
      reports: paginatedReports,
      total: reports.length,
      page,
      limit,
    };
  }

  async getDonors(page: number = 1, limit: number = 10) {
    const donors = await this.donorModel
      .find()
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await this.donorModel.countDocuments();

    return {
      donors: donors.map((donor: any) => ({
        _id: donor._id,
        name: donor.name,
        email: donor.email,
        phone: donor.phone,
        bloodType: donor.bloodGroup,
        city: donor.city,
        status: donor.status || 'active',
      })),
      total,
      page,
      limit,
    };
  }

  async getRequests(page: number = 1, limit: number = 10) {
    const requests = [
      {
        id: '1',
        hospital: 'City Hospital',
        bloodType: 'O-',
        quantity: 10,
        urgency: 'Critical',
        status: 'Pending',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        hospital: 'Central Medical Center',
        bloodType: 'A+',
        quantity: 5,
        urgency: 'High',
        status: 'Fulfilled',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        hospital: 'County General',
        bloodType: 'B-',
        quantity: 8,
        urgency: 'Medium',
        status: 'Pending',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: '4',
        hospital: 'St. Mary\'s Hospital',
        bloodType: 'AB+',
        quantity: 3,
        urgency: 'Low',
        status: 'Fulfilled',
        createdAt: new Date(Date.now() - 259200000).toISOString(),
      },
      {
        id: '5',
        hospital: 'University Hospital',
        bloodType: 'O+',
        quantity: 12,
        urgency: 'Critical',
        status: 'In Progress',
        createdAt: new Date(Date.now() - 345600000).toISOString(),
      },
    ];

    const skip = (page - 1) * limit;
    const paginatedRequests = requests.slice(skip, skip + limit);

    return {
      requests: paginatedRequests,
      total: requests.length,
      page,
      limit,
    };
  }

  async getRecipients(page: number = 1, limit: number = 10) {
    const recipients = [
      {
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        bloodType: 'O-',
        hospital: 'City Hospital',
        status: 'Active',
        requestDate: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Mary Johnson',
        email: 'mary@example.com',
        bloodType: 'A+',
        hospital: 'Central Medical',
        status: 'Inactive',
        requestDate: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        name: 'Robert Brown',
        email: 'robert@example.com',
        bloodType: 'B-',
        hospital: 'County General',
        status: 'Active',
        requestDate: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: '4',
        name: 'Sarah Davis',
        email: 'sarah@example.com',
        bloodType: 'AB+',
        hospital: 'St. Mary\'s',
        status: 'Active',
        requestDate: new Date(Date.now() - 259200000).toISOString(),
      },
      {
        id: '5',
        name: 'Michael Wilson',
        email: 'michael@example.com',
        bloodType: 'O+',
        hospital: 'University Hospital',
        status: 'Active',
        requestDate: new Date(Date.now() - 345600000).toISOString(),
      },
    ];

    const skip = (page - 1) * limit;
    const paginatedRecipients = recipients.slice(skip, skip + limit);

    return {
      recipients: paginatedRecipients,
      total: recipients.length,
      page,
      limit,
    };
  }

  async getCampaigns(page: number = 1, limit: number = 10) {
    const campaigns = [
      {
        id: '1',
        name: 'Spring Blood Drive 2026',
        description: 'Annual spring blood donation campaign',
        startDate: new Date(Date.now() - 604800000).toISOString(),
        endDate: new Date(Date.now() + 604800000).toISOString(),
        status: 'Active',
        participantsCount: 245,
        targetCount: 500,
      },
      {
        id: '2',
        name: 'University Campus Drive',
        description: 'Blood drive at local university',
        startDate: new Date(Date.now() - 1209600000).toISOString(),
        endDate: new Date(Date.now() - 604800000).toISOString(),
        status: 'Completed',
        participantsCount: 180,
        targetCount: 200,
      },
      {
        id: '3',
        name: 'Corporate Partnership Drive',
        description: 'Blood drive with local companies',
        startDate: new Date(Date.now() + 604800000).toISOString(),
        endDate: new Date(Date.now() + 1814400000).toISOString(),
        status: 'Upcoming',
        participantsCount: 0,
        targetCount: 300,
      },
    ];

    const skip = (page - 1) * limit;
    const paginatedCampaigns = campaigns.slice(skip, skip + limit);

    return {
      campaigns: paginatedCampaigns,
      total: campaigns.length,
      page,
      limit,
    };
  }

  async getInventory() {
    const inventory = [
      {
        bloodType: 'O+',
        available: 45,
        reserved: 10,
        expired: 2,
        lastUpdated: new Date().toISOString(),
      },
      {
        bloodType: 'O-',
        available: 38,
        reserved: 8,
        expired: 1,
        lastUpdated: new Date().toISOString(),
      },
      {
        bloodType: 'A+',
        available: 32,
        reserved: 5,
        expired: 0,
        lastUpdated: new Date().toISOString(),
      },
      {
        bloodType: 'A-',
        available: 28,
        reserved: 4,
        expired: 1,
        lastUpdated: new Date().toISOString(),
      },
      {
        bloodType: 'B+',
        available: 25,
        reserved: 3,
        expired: 0,
        lastUpdated: new Date().toISOString(),
      },
      {
        bloodType: 'B-',
        available: 20,
        reserved: 2,
        expired: 2,
        lastUpdated: new Date().toISOString(),
      },
      {
        bloodType: 'AB+',
        available: 15,
        reserved: 1,
        expired: 0,
        lastUpdated: new Date().toISOString(),
      },
      {
        bloodType: 'AB-',
        available: 10,
        reserved: 0,
        expired: 1,
        lastUpdated: new Date().toISOString(),
      },
    ];

    return { inventory };
  }

  async getNotifications() {
    const notifications = [
      {
        id: '1',
        title: 'New Blood Request',
        message: 'City Hospital requested O- blood units',
        type: 'warning' as const,
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Donation Campaign Started',
        message: 'University donation campaign is now live',
        type: 'success' as const,
        read: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        title: 'Low Blood Stock',
        message: 'AB- blood type stock is critically low',
        type: 'error' as const,
        read: true,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: '4',
        title: 'System Update',
        message: 'Scheduled maintenance completed successfully',
        type: 'info' as const,
        read: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    const unreadCount = notifications.filter((n) => !n.read).length;

    return { notifications, unreadCount };
  }

  private generateDonationChart(): Array<{ date: string; count: number }> {
    const data: Array<{ date: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      data.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 15) + 5,
      });
    }
    return data;
  }

  private generateDemandChart(): Array<{ bloodType: string; needed: number }> {
    const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    return bloodTypes.map((type) => ({
      bloodType: type,
      needed: Math.floor(Math.random() * 20) + 5,
    }));
  }
}
