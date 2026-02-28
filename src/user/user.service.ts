import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {
    constructor(@InjectModel(User.name) private userModel: Model<User>) { }

    createUser(data: Partial<User>) {
        return this.userModel.create(data);
    }

    findByEmail(email: string) {
        return this.userModel.findOne({ email });
    }

    findById(id: string) {
        return this.userModel.findById(id);
    }

    async updateRefreshToken(userId: string, hashedToken: string | null) {
        return this.userModel.findByIdAndUpdate(userId, {
            refreshToken: hashedToken,
        });
    }
}
