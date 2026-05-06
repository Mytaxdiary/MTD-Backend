import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';

const AGENT_ROLE = 'Agent';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async emailExists(email: string): Promise<boolean> {
    const count = await this.userRepo.count({ where: { email } });
    return count > 0;
  }

  async create(data: {
    firstName: string;
    lastName: string;
    firmName: string;
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLoginAt: new Date() });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.userRepo.update(id, { passwordHash });
  }

  /**
   * Finds the Agent role, creating it if it does not yet exist.
   * This is the only role supported in this phase.
   */
  async findOrCreateAgentRole(): Promise<Role> {
    let role = await this.roleRepo.findOne({ where: { name: AGENT_ROLE } });
    if (!role) {
      role = this.roleRepo.create({ name: AGENT_ROLE });
      role = await this.roleRepo.save(role);
    }
    return role;
  }
}
