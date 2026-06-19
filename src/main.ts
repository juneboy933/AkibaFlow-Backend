import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  app.enableCors({
    origin: [config.get<string>('FRONTEND_URL')],
    credentials: true,
  });

  const port = config.get<number | string>('PORT') ?? 3000;
  await app.listen(port);
}
void bootstrap();
