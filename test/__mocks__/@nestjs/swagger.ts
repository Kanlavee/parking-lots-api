// Manual mock for @nestjs/swagger — avoids lodash UMD parse errors in Jest v30
const noop = () => () => undefined;

export const ApiTags = noop;
export const ApiOperation = noop;
export const ApiResponse = noop;
export const ApiParam = noop;
export const ApiProperty = noop;
export const ApiQuery = noop;
export const ApiBody = noop;
export const ApiBearerAuth = noop;
export const ApiHeader = noop;
export const SwaggerModule = { createDocument: () => ({}), setup: () => undefined };
export const DocumentBuilder = class {
  setTitle() { return this; }
  setDescription() { return this; }
  setVersion() { return this; }
  addTag() { return this; }
  build() { return {}; }
};
