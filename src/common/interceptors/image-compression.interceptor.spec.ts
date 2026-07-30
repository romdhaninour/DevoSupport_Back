import { ImageCompressionInterceptor } from './image-compression.interceptor';
import { of, lastValueFrom } from 'rxjs';

const mockSharpToBuffer = jest.fn();

jest.mock('sharp', () => jest.fn(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: () => mockSharpToBuffer(),
})));

describe('ImageCompressionInterceptor', () => {
  let interceptor: ImageCompressionInterceptor;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    interceptor = new ImageCompressionInterceptor();
    mockSharpToBuffer.mockReset();
    mockSharpToBuffer.mockResolvedValue(Buffer.from('abc'));
  });

  const createMockFile = (size: number, buffer?: Buffer) => ({
    size,
    buffer: buffer || Buffer.alloc(size),
    mimetype: 'image/png',
    originalname: 'test.png',
  });

  const createMockExecutionContext = (file: any) => ({
    switchToHttp: () => ({
      getRequest: () => ({ file }),
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
  });

  const createMockCallHandler = () => ({
    handle: jest.fn(() => of({ success: true })),
  });

  describe('intercept', () => {
    it('should compress image when file is present and large', async () => {
      const largeBuffer = Buffer.alloc(200 * 1024, 'x');
      const mockFile = createMockFile(200 * 1024, largeBuffer);
      const context = createMockExecutionContext(mockFile);
      const next = createMockCallHandler();

      const result = await lastValueFrom(interceptor.intercept(context as any, next as any));

      expect(next.handle).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should skip compression when file is smaller than 100KB', () => {
      const smallBuffer = Buffer.alloc(50 * 1024, 'x');
      const mockFile = createMockFile(50 * 1024, smallBuffer);
      const context = createMockExecutionContext(mockFile);
      const next = createMockCallHandler();

      interceptor.intercept(context as any, next as any);

      expect(next.handle).toHaveBeenCalled();
    });

    it('should pass through when no file is present', () => {
      const context = createMockExecutionContext(null);
      const next = createMockCallHandler();

      interceptor.intercept(context as any, next as any);

      expect(next.handle).toHaveBeenCalled();
    });

    it('should handle compression errors gracefully', async () => {
      const invalidBuffer = Buffer.alloc(200 * 1024, 0);
      const mockFile = createMockFile(200 * 1024, invalidBuffer);
      const context = createMockExecutionContext(mockFile);
      const next = createMockCallHandler();

      const result = await lastValueFrom(interceptor.intercept(context as any, next as any));

      expect(next.handle).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('formatFileSize', () => {
    it('should return "0 Bytes" for 0', () => {
      expect((interceptor as any).formatFileSize(0)).toBe('0 Bytes');
    });

    it('should format bytes correctly', () => {
      expect((interceptor as any).formatFileSize(1024)).toContain('KB');
    });

    it('should format MB correctly', () => {
      expect((interceptor as any).formatFileSize(1048576)).toContain('MB');
    });

    it('should format GB correctly', () => {
      expect((interceptor as any).formatFileSize(1073741824)).toContain('GB');
    });
  });

  describe('compressImage (private method)', () => {
    it('should skip compression for files smaller than 100KB', async () => {
      const smallFile = createMockFile(50 * 1024);
      await (interceptor as any).compressImage(smallFile);
      expect(smallFile.buffer.length).toBe(50 * 1024);
      expect(smallFile.mimetype).toBe('image/png');
    });

    it('should compress large files and update buffer/size/mimetype', async () => {
      const largeFile = createMockFile(200 * 1024, Buffer.alloc(200 * 1024, 'x'));
      await (interceptor as any).compressImage(largeFile);
      expect(largeFile.mimetype).toBe('image/jpeg');
      expect(largeFile.size).toBe(3);
    });

    it('should handle sharp errors gracefully', async () => {
      mockSharpToBuffer.mockRejectedValue(new Error('Sharp processing error'));
      const largeFile = createMockFile(200 * 1024, Buffer.alloc(200 * 1024));
      await (interceptor as any).compressImage(largeFile);
      expect(largeFile.mimetype).toBe('image/png');
    });
  });
});
