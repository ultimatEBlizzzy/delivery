import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuthUserDto, Role } from '@hardware-delivery/shared';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { RoleEntity } from './entities/role.entity';
import { User } from './entities/user.entity';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  roles: Role[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RoleEntity) private readonly roles: Repository<RoleEntity>,
  ) {}

  /** Create a user with the given roles. Pass `manager` to take part in a surrounding transaction. */
  async create(input: CreateUserInput, manager?: EntityManager): Promise<User> {
    const userRepo = manager ? manager.getRepository(User) : this.users;
    const roleRepo = manager ? manager.getRepository(RoleEntity) : this.roles;
    const roleEntities = await roleRepo.find({ where: { name: In(input.roles) } });
    if (roleEntities.length !== input.roles.length) {
      throw new Error(`Unknown role in [${input.roles.join(', ')}] – was the database migrated?`);
    }
    const user = userRepo.create({
      email: input.email.trim().toLowerCase(),
      passwordHash: input.passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      phone: input.phone ?? null,
      roles: roleEntities,
    });
    return userRepo.save(user);
  }

  async addRole(userId: string, role: Role, manager?: EntityManager): Promise<void> {
    const userRepo = manager ? manager.getRepository(User) : this.users;
    const roleRepo = manager ? manager.getRepository(RoleEntity) : this.roles;
    const user = await userRepo.findOneOrFail({
      where: { id: userId },
      relations: { roles: true },
    });
    if (user.roles.some((r) => r.name === role)) return;
    const roleEntity = await roleRepo.findOneByOrFail({ name: role });
    user.roles.push(roleEntity);
    await userRepo.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id }, relations: { roles: true } });
  }

  async getByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: email.trim().toLowerCase() },
      relations: { roles: true },
    });
  }

  /** Includes the password hash – only for credential checks. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.roles', 'role')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.roles', 'role')
      .where('user.id = :id', { id })
      .getOne();
  }

  async updateProfile(
    id: string,
    changes: { firstName?: string; lastName?: string; phone?: string | null },
  ): Promise<User> {
    const patch: Partial<User> = {};
    if (changes.firstName !== undefined) patch.firstName = changes.firstName;
    if (changes.lastName !== undefined) patch.lastName = changes.lastName;
    if (changes.phone !== undefined) patch.phone = changes.phone;
    if (Object.keys(patch).length) await this.users.update({ id }, patch);
    return this.getByIdOrFail(id);
  }

  emailExists(email: string): Promise<boolean> {
    return this.users.exists({ where: { email: email.trim().toLowerCase() }, withDeleted: true });
  }

  /** Resolve the principal for a validated JWT. Returns null for unknown / disabled accounts. */
  async findAuthUser(id: string): Promise<AuthUser | null> {
    const user = await this.users.findOne({ where: { id }, relations: { roles: true } });
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles.map((r) => r.name),
    };
  }

  toDto(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roles: (user.roles ?? []).map((r) => r.name),
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
