import { IsEnum } from 'class-validator';

export class UpdateBloodRequestStatusDto {
  @IsEnum(['Pending', 'Accepted', 'Fulfilled', 'Closed'])
  status!: 'Pending' | 'Accepted' | 'Fulfilled' | 'Closed';
}