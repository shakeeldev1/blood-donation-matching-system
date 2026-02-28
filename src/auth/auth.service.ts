import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private userService:UserService,
        private jwtService:JwtService
    ){}

    async signup(dto:SignupDto){
        const existingUser = await this.userService.findByEmail(dto.email);
        if(existingUser){
            throw new BadRequestException('Email already in use');
        }
        const hashedPassword = await this.userService.hashPassword(dto.password);
        const user = await this.userService.createUser({
            ...dto,
            password: hashedPassword
        })
        return this.signToken(user._id.toString());
    }

    async login(dto:LoginDto){
        const user = await this.userService.findByEmail(dto.email);
        if(!user){
            throw new BadRequestException('Invalid credentials');
        }
        const isMatch = await this.userService.comparePassword(dto.password, user.password);
        if(!isMatch){
            throw new BadRequestException('Invalid credentials');
        }
        return this.signToken(user._id.toString());
    }

    private signToken(userId:string){
        const payload = { sub: userId };
        return this.jwtService.sign(payload);
    }
}
