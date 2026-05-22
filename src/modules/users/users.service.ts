import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { Client } from '../clients/entities/client.entity';

const AGENT_ROLE = 'Agent';

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
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
    tenantId: string;
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

  async markEmailVerified(id: string): Promise<void> {
    await this.userRepo.update(id, { isEmailVerified: true });
  }

  /**
   * Permanently removes the user. Auth tokens cascade on user delete.
   * If this was the last user on the tenant, also removes clients, HMRC connection,
   * notification preferences, and the tenant row.
   */
  async hardDelete(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const tenantId = user.tenantId;

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(User, id);

      if (!tenantId) return;

      const remainingUsers = await manager.count(User, { where: { tenantId } });
      if (remainingUsers > 0) return;

      await manager.delete(Client, { tenantId });
      await manager.delete(Tenant, tenantId);
    });
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
