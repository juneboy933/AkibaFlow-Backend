import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { JwtGuard } from 'src/auth/guards/jwt/jwt.guard';
import type { AuthenticatedRequest } from 'src/common/interfaces/authenticated-user.interface';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@UseGuards(JwtGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Post()
  createGoal(@Req() req: AuthenticatedRequest, @Body() dto: CreateGoalDto) {
    return this.goals.createGoal(req.user.sub, dto);
  }

  @Get()
  getGoals(@Req() req: AuthenticatedRequest, @Query() query: PaginationDto) {
    return this.goals.getGoals(req.user.sub, query.page, query.limit);
  }

  @Get(':id')
  getGoalById(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.goals.getGoalById(req.user.sub, id);
  }

  @Patch(':id')
  updateGoal(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goals.updateGoal(req.user.sub, id, dto);
  }

  @Post(':id/close')
  closeGoal(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.goals.closeGoal(req.user.sub, id);
  }
}
