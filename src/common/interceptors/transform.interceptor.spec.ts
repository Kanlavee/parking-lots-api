import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

const buildContext = (url: string) =>
  ({
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ url }),
    }),
  }) as unknown as ExecutionContext;

const buildCallHandler = <T>(value: T) =>
  ({ handle: jest.fn().mockReturnValue(of(value)) }) as unknown as CallHandler<T>;

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('wraps the response data in a { data, timestamp, path } envelope', (done) => {
    const context = buildContext('/parking-lots');
    const callHandler = buildCallHandler({ id: 'abc', name: 'Test Lot' });

    interceptor.intercept(context, callHandler).subscribe((result) => {
      expect(result.data).toEqual({ id: 'abc', name: 'Test Lot' });
      expect(result.path).toBe('/parking-lots');
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
      done();
    });
  });

  it('forwards the correct request URL to the path field', (done) => {
    const context = buildContext('/parking-lots/123/status');
    const callHandler = buildCallHandler({ totalSlots: 5 });

    interceptor.intercept(context, callHandler).subscribe((result) => {
      expect(result.path).toBe('/parking-lots/123/status');
      done();
    });
  });

  it('handles null data without throwing', (done) => {
    const context = buildContext('/test');
    const callHandler = buildCallHandler(null);

    interceptor.intercept(context, callHandler).subscribe((result) => {
      expect(result.data).toBeNull();
      done();
    });
  });
});
