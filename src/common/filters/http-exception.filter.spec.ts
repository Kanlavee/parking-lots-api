import { HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const buildHost = (url: string) => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const mockResponse = { status };
  const mockRequest = { url };

  const host = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
};

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('returns the correct status code and response shape for a NotFoundException', () => {
    const exception = new NotFoundException('Parking lot not found.');
    const { host, status, json } = buildHost('/parking-lots/bad-id/status');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Parking lot not found.',
        path: '/parking-lots/bad-id/status',
      }),
    );
  });

  it('returns the correct status code for a BadRequestException', () => {
    const exception = new BadRequestException('Validation failed.');
    const { host, status, json } = buildHost('/parking-lots');

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
      }),
    );
  });

  it('extracts array messages from BadRequestException response object', () => {
    const exception = new BadRequestException(['name must not be empty', 'slots must be an array']);
    const { host, json } = buildHost('/parking-lots');

    filter.catch(exception, host);

    const called = (json as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(called.message)).toBe(true);
    expect(called.message).toContain('name must not be empty');
  });

  it('includes a timestamp and path in every response', () => {
    const exception = new HttpException('Conflict', HttpStatus.CONFLICT);
    const { host, json } = buildHost('/some/path');

    filter.catch(exception, host);

    const called = (json as jest.Mock).mock.calls[0][0];
    expect(called.timestamp).toBeDefined();
    expect(called.path).toBe('/some/path');
    expect(called.error).toBeDefined();
  });
});
