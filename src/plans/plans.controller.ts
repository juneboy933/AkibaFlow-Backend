import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

interface AuthenticatedUser extends Request {
  user: {
    sub: string;
    role: UserRole;
  };
}

@UseGuards(JwtGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plan: PlansService) {}

  @Post()
  createPlan(@Req() req: AuthenticatedUser, @Body() dto: CreatePlanDto) {
    return this.plan.createPlan(req.user.sub, dto);
  }

  @Get(':goalId')
  getPlanByGoal(
    @Req() req: AuthenticatedUser,
    @Param('goalId') goalId: string,
  ) {
    return this.plan.getPlanByGoal(req.user.sub, goalId);
  }

  @Get()
  getPlans(@Req() req: AuthenticatedUser) {
    return this.plan.getPlans(req.user.sub);
  }

  @Patch(':goalId')
  updatePlan(
    @Req() req: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plan.updatePlan(req.user.sub, goalId, dto);
  }

  @Delete(':goalId')
  deletePlan(@Req() req: AuthenticatedUser, @Param('goalId') goalId: string) {
    return this.plan.deletePlan(req.user.sub, goalId);
  }
}
