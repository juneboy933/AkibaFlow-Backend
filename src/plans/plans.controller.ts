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
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import type { AuthenticatedRequest } from 'src/common/interfaces/authenticated-user.interface';

@UseGuards(JwtGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plan: PlansService) {}

  @Post()
  createPlan(@Req() req: AuthenticatedRequest, @Body() dto: CreatePlanDto) {
    return this.plan.createPlan(req.user.sub, dto);
  }

  @Get(':goalId')
  getPlanByGoal(
    @Req() req: AuthenticatedRequest,
    @Param('goalId') goalId: string,
  ) {
    return this.plan.getPlanByGoal(req.user.sub, goalId);
  }

  @Get()
  getPlans(@Req() req: AuthenticatedRequest) {
    return this.plan.getPlans(req.user.sub);
  }

  @Patch(':goalId')
  updatePlan(
    @Req() req: AuthenticatedRequest,
    @Param('goalId') goalId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plan.updatePlan(req.user.sub, goalId, dto);
  }

  @Delete(':goalId')
  deletePlan(
    @Req() req: AuthenticatedRequest,
    @Param('goalId') goalId: string,
  ) {
    return this.plan.deletePlan(req.user.sub, goalId);
  }
}
