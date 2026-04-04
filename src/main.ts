import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation — strip unknown fields, auto-transform primitives
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Global error shape: { statusCode, message, error, path, timestamp }
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global success shape: { data, timestamp, path }
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger UI at /api
  const config = new DocumentBuilder()
    .setTitle('Parking Lot API')
    .setDescription(
      'REST API for managing parking lots, parking slots, and vehicle tickets.\n\n' +
      '**Slot size compatibility (nearest-first assignment):**\n' +
      '- LARGE car → LARGE slot only\n' +
      '- MEDIUM car → LARGE or MEDIUM slot\n' +
      '- SMALL car → LARGE, MEDIUM, or SMALL slot',
    )
    .setVersion('1.0')
    .addTag('Parking Lots', 'Create lots and query status / occupancy')
    .addTag('Tickets', 'Park a car and release a parking slot')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: { defaultModelsExpandDepth: -1 },
  });

  await app.listen(process.env.PORT ?? 3000);

  console.log(`Application running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger UI available at: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
