import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from './user.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /users
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // GET /users
  // GET /users?archived=true
  @Get()
  findAll(@Query('archived') archived?: string) {
    return this.usersService.findAll(archived === 'true');
  }

  // GET /users/archived
  @Get('archived')
  findArchived() {
    return this.usersService.findArchived();
  }

  // GET /users/consultants  (IT + CONSULTANT)
  @Get('consultants')
  findConsultants() {
    return this.usersService.findConsultants();
  }

  // GET /users/role/IT
  @Get('role/:role')
  findByRole(@Param('role') role: Role) {
    return this.usersService.findByRole(role);
  }

  // GET /users/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  // PATCH /users/:id
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  // PATCH /users/:id/activate
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.usersService.activate(id);
  }

  // PATCH /users/:id/deactivate
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  // PATCH /users/:id/archive
  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.usersService.archive(id);
  }

  // PATCH /users/:id/restore
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.usersService.restore(id);
  }

  // DELETE /users/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
