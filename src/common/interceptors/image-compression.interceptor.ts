import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import sharp from 'sharp';

@Injectable()
export class ImageCompressionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Check if request contains a file
    if (request.file) {
      this.compressImage(request.file);
    }
    
    return next.handle();
  }

  private async compressImage(file: any): Promise<void> {
    try {
      // Skip compression if file is already small (< 100KB)
      if (file.size < 100 * 1024) {
        return;
      }

      // Compress image using sharp
      const compressedBuffer = await sharp(file.buffer)
        .resize(1280, 1280, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Update file with compressed data
      file.buffer = compressedBuffer;
      file.size = compressedBuffer.length;
      file.mimetype = 'image/jpeg';

      console.log(`Backend compression: ${this.formatFileSize(file.originalsize || file.size)} -> ${this.formatFileSize(file.size)}`);
    } catch (error) {
      console.error('Backend image compression failed, using original:', error);
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
