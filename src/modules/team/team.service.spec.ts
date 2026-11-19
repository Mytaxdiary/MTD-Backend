import { ForbiddenException } from '@nestjs/common';
import { TeamService } from './team.service';
import { Client } from '../clients/entities/client.entity';
import { User } from '../users/entities/user.entity';

describe('TeamService.removeStaff', () => {
  const tenantId = 'tenant-1';
  const ownerActor = {
    userId: 'owner-1',
    tenantId,
    role: 'owner' as const,
    permissions: { canInviteStaff: true },
  };

  function buildService(staffUser: Partial<User>) {
    const execute = jest.fn().mockResolvedValue({ affected: 2 });
    const andWhere = jest.fn().mockReturnValue({ execute });
    const where = jest.fn().mockReturnValue({ andWhere });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const createQueryBuilder = jest.fn().mockReturnValue({ update });

    const manager = {
      createQueryBuilder,
      query: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      transaction: jest.fn(),
    };
    manager.transaction.mockImplementation(async (fn: (m: typeof manager) => Promise<void>) =>
      fn(manager),
    );

    const userRepo = {
      findOne: jest.fn().mockResolvedValue(staffUser),
      manager,
    };

    const service = new TeamService(
      {} as never,
      userRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
    );

    return { service, manager, update, set, where, andWhere, execute };
  }

  it('unassigns clients in the firm before deleting the staff user', async () => {
    const { service, manager, update, set, where, andWhere, execute } = buildService({
      id: 'staff-1',
      tenantId,
      isActive: true,
      role: { name: 'staff' } as User['role'],
    });

    await service.removeStaff(ownerActor as never, 'staff-1');

    expect(manager.transaction).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(Client);
    expect(set).toHaveBeenCalledWith({ assignedToUserId: null });
    expect(where).toHaveBeenCalledWith('assigned_to_user_id = :userId', { userId: 'staff-1' });
    expect(andWhere).toHaveBeenCalledWith('tenant_id = :tenantId', { tenantId });
    expect(execute).toHaveBeenCalled();
    expect(manager.delete).toHaveBeenCalledWith(User, { id: 'staff-1', tenantId });
  });

  it('does not allow removing the firm owner', async () => {
    const { service, manager } = buildService({
      id: 'owner-2',
      tenantId,
      isActive: true,
      role: { name: 'owner' } as User['role'],
    });

    await expect(service.removeStaff(ownerActor as never, 'owner-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(manager.transaction).not.toHaveBeenCalled();
  });
});
