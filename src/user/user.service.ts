import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';

@Injectable()
export class UserService {
    constructor(@InjectModel(User.name) private userModel:Model<User>){}

    createUser(data:Partial<User>){
        return this.userModel.create(data);
    }

    findByEmail(email:string){
        return this.userModel.findOne({email});
    }

    findById(id:string){
        return this.userModel.findById(id);
    }

    async hashPassword(password:string){
        const bcrypt = await import('bcrypt');
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }

    async comparePassword(password:string, hash:string){
        const bcrypt = await import('bcrypt');
        return bcrypt.compare(password, hash);
    }
}
