import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger';
import { config } from '../../config/env';
import { ArtifactConfig } from '../../types/testing';

export interface StoredArtifact {
  id: string;
  url: string;
  type: 'screenshot' | 'log' | 'video' | 'report';
  size: number;
  uploadedAt: Date;
  expiresAt?: Date;
}

export class ArtifactStorage {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private readonly config: ArtifactConfig;

  constructor(artifactConfig?: Partial<ArtifactConfig>) {
    this.config = {
      storageType: artifactConfig?.storageType || 'azure-blob',
      basePath: artifactConfig?.basePath || 'artifacts',
      retention: {
        screenshots: artifactConfig?.retention?.screenshots || 30,
        logs: artifactConfig?.retention?.logs || 90,
        videos: artifactConfig?.retention?.videos || 14,
        ...artifactConfig?.retention,
      },
      compression: artifactConfig?.compression ?? true,
      encryption: artifactConfig?.encryption ?? false,
    };

    if (this.config.storageType === 'azure-blob') {
      this.initializeAzureStorage();
    }
  }

  private initializeAzureStorage(): void {
    try {
      const connectionString = `DefaultEndpointsProtocol=https;AccountName=${config.azureStorage.account};AccountKey=${config.azureStorage.key};EndpointSuffix=core.windows.net`;
      
      this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(config.azureStorage.container);
      
      logger.info('Azure Blob Storage initialized for artifact storage');
    } catch (error) {
      logger.error('Failed to initialize Azure Blob Storage:', error);
      // Fall back to local storage
      this.config.storageType = 'local';
    }
  }

  public async uploadScreenshot(
    filePath: string,
    metadata: {
      testRunId: string;
      applicationId: string;
      testType: string;
      timestamp: Date;
    },
  ): Promise<StoredArtifact> {
    const artifactId = `screenshot_${metadata.testRunId}_${metadata.applicationId}_${metadata.testType}_${metadata.timestamp.getTime()}`;
    const fileName = `${artifactId}.png`;

    return await this.uploadFile(filePath, fileName, 'screenshot', metadata);
  }

  public async uploadTestLogs(
    logs: any[],
    metadata: {
      testRunId: string;
      applicationId: string;
      testType: string;
      timestamp: Date;
    },
  ): Promise<StoredArtifact> {
    const artifactId = `logs_${metadata.testRunId}_${metadata.applicationId}_${metadata.testType}_${metadata.timestamp.getTime()}`;
    const fileName = `${artifactId}.json`;

    // Create temporary file with logs
    const tempPath = path.join(process.cwd(), 'temp', fileName);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(logs, null, 2));

    try {
      const artifact = await this.uploadFile(tempPath, fileName, 'log', metadata);
      
      // Clean up temp file
      await fs.unlink(tempPath);
      
      return artifact;
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp file:', cleanupError);
      }
      throw error;
    }
  }

  public async uploadVideo(
    filePath: string,
    metadata: {
      testRunId: string;
      applicationId: string;
      testType: string;
      timestamp: Date;
    },
  ): Promise<StoredArtifact> {
    const artifactId = `video_${metadata.testRunId}_${metadata.applicationId}_${metadata.testType}_${metadata.timestamp.getTime()}`;
    const fileName = `${artifactId}.webm`;

    return await this.uploadFile(filePath, fileName, 'video', metadata);
  }

  public async uploadReport(
    reportData: any,
    metadata: {
      testRunId: string;
      timestamp: Date;
      format: 'json' | 'html' | 'pdf';
    },
  ): Promise<StoredArtifact> {
    const artifactId = `report_${metadata.testRunId}_${metadata.timestamp.getTime()}`;
    const fileName = `${artifactId}.${metadata.format}`;

    let tempPath: string;
    
    if (metadata.format === 'json') {
      tempPath = path.join(process.cwd(), 'temp', fileName);
      await fs.mkdir(path.dirname(tempPath), { recursive: true });
      await fs.writeFile(tempPath, JSON.stringify(reportData, null, 2));
    } else {
      // For HTML/PDF, assume reportData is already a file path or buffer
      tempPath = reportData;
    }

    try {
      const artifact = await this.uploadFile(tempPath, fileName, 'report', metadata);
      
      // Clean up temp file if we created it
      if (metadata.format === 'json') {
        await fs.unlink(tempPath);
      }
      
      return artifact;
    } catch (error) {
      if (metadata.format === 'json') {
        try {
          await fs.unlink(tempPath);
        } catch (cleanupError) {
          logger.warn('Failed to clean up temp file:', cleanupError);
        }
      }
      throw error;
    }
  }

  public async downloadArtifact(artifactId: string): Promise<Buffer> {
    if (this.config.storageType === 'azure-blob' && this.containerClient) {
      return await this.downloadFromAzure(artifactId);
    } else {
      return await this.downloadFromLocal(artifactId);
    }
  }

  public async deleteArtifact(artifactId: string): Promise<void> {
    if (this.config.storageType === 'azure-blob' && this.containerClient) {
      await this.deleteFromAzure(artifactId);
    } else {
      await this.deleteFromLocal(artifactId);
    }
  }

  public async cleanupExpiredArtifacts(): Promise<{
    deleted: number;
    errors: number;
  }> {
    let deleted = 0;
    let errors = 0;

    try {
      if (this.config.storageType === 'azure-blob' && this.containerClient) {
        const result = await this.cleanupAzureArtifacts();
        deleted += result.deleted;
        errors += result.errors;
      } else {
        const result = await this.cleanupLocalArtifacts();
        deleted += result.deleted;
        errors += result.errors;
      }

      logger.info(`Artifact cleanup completed: ${deleted} deleted, ${errors} errors`);
    } catch (error) {
      logger.error('Artifact cleanup failed:', error);
      errors++;
    }

    return { deleted, errors };
  }

  private async uploadFile(
    filePath: string,
    fileName: string,
    type: 'screenshot' | 'log' | 'video' | 'report',
    metadata: any,
  ): Promise<StoredArtifact> {
    if (this.config.storageType === 'azure-blob' && this.containerClient) {
      return await this.uploadToAzure(filePath, fileName, type, metadata);
    } else {
      return await this.uploadToLocal(filePath, fileName, type, metadata);
    }
  }

  private async uploadToAzure(
    filePath: string,
    fileName: string,
    type: 'screenshot' | 'log' | 'video' | 'report',
    metadata: any,
  ): Promise<StoredArtifact> {
    if (!this.containerClient) {
      throw new Error('Azure Blob Storage not initialized');
    }

    try {
      // Ensure container exists
      await this.containerClient.createIfNotExists({
        access: 'blob',
      });

      const blobPath = `${this.config.basePath}/${type}s/${fileName}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);

      // Read file
      const fileBuffer = await fs.readFile(filePath);
      const fileSize = fileBuffer.length;

      // Upload with metadata
      await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
          blobContentType: this.getContentType(fileName),
        },
        metadata: {
          testRunId: metadata.testRunId,
          applicationId: metadata.applicationId || '',
          testType: metadata.testType || '',
          uploadedAt: new Date().toISOString(),
          type,
        },
      });

      const url = blockBlobClient.url;
      const expiresAt = this.calculateExpirationDate(type);

      const artifact: StoredArtifact = {
        id: blobPath,
        url,
        type,
        size: fileSize,
        uploadedAt: new Date(),
        expiresAt,
      };

      logger.debug(`Uploaded artifact to Azure: ${blobPath} (${fileSize} bytes)`);

      return artifact;
    } catch (error) {
      logger.error(`Failed to upload artifact to Azure: ${error}`);
      throw error;
    }
  }

  private async uploadToLocal(
    filePath: string,
    fileName: string,
    type: 'screenshot' | 'log' | 'video' | 'report',
    metadata: any,
  ): Promise<StoredArtifact> {
    try {
      const destDir = path.join(process.cwd(), this.config.basePath, `${type}s`);
      await fs.mkdir(destDir, { recursive: true });

      const destPath = path.join(destDir, fileName);
      
      // Copy file
      await fs.copyFile(filePath, destPath);
      
      const stats = await fs.stat(destPath);
      const fileSize = stats.size;

      const artifact: StoredArtifact = {
        id: destPath,
        url: destPath,
        type,
        size: fileSize,
        uploadedAt: new Date(),
        expiresAt: this.calculateExpirationDate(type),
      };

      logger.debug(`Uploaded artifact locally: ${destPath} (${fileSize} bytes)`);

      return artifact;
    } catch (error) {
      logger.error(`Failed to upload artifact locally: ${error}`);
      throw error;
    }
  }

  private async downloadFromAzure(artifactId: string): Promise<Buffer> {
    if (!this.containerClient) {
      throw new Error('Azure Blob Storage not initialized');
    }

    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(artifactId);
      const downloadResponse = await blockBlobClient.download();
      
      if (!downloadResponse.readableStreamBody) {
        throw new Error('No readable stream in download response');
      }

      const chunks: Buffer[] = [];
      return new Promise((resolve, reject) => {
        downloadResponse.readableStreamBody!.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        downloadResponse.readableStreamBody!.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        
        downloadResponse.readableStreamBody!.on('error', reject);
      });
    } catch (error) {
      logger.error(`Failed to download artifact from Azure: ${error}`);
      throw error;
    }
  }

  private async downloadFromLocal(artifactId: string): Promise<Buffer> {
    try {
      return await fs.readFile(artifactId);
    } catch (error) {
      logger.error(`Failed to download artifact locally: ${error}`);
      throw error;
    }
  }

  private async deleteFromAzure(artifactId: string): Promise<void> {
    if (!this.containerClient) {
      throw new Error('Azure Blob Storage not initialized');
    }

    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(artifactId);
      await blockBlobClient.deleteIfExists();
      logger.debug(`Deleted artifact from Azure: ${artifactId}`);
    } catch (error) {
      logger.error(`Failed to delete artifact from Azure: ${error}`);
      throw error;
    }
  }

  private async deleteFromLocal(artifactId: string): Promise<void> {
    try {
      await fs.unlink(artifactId);
      logger.debug(`Deleted artifact locally: ${artifactId}`);
    } catch (error) {
      logger.error(`Failed to delete artifact locally: ${error}`);
      throw error;
    }
  }

  private async cleanupAzureArtifacts(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    if (!this.containerClient) {
      return { deleted, errors };
    }

    try {
      const now = new Date();
      
      for await (const blob of this.containerClient.listBlobsFlat({
        prefix: this.config.basePath,
      })) {
        try {
          const blobClient = this.containerClient.getBlobClient(blob.name);
          const properties = await blobClient.getProperties();
          
          if (properties.metadata && properties.lastModified) {
            const type = properties.metadata.type as 'screenshot' | 'log' | 'video' | 'report';
            const retentionDays = this.config.retention[`${type}s` as keyof typeof this.config.retention] || 30;
            const expirationDate = new Date(properties.lastModified.getTime() + retentionDays * 24 * 60 * 60 * 1000);
            
            if (now > expirationDate) {
              await blobClient.deleteIfExists();
              deleted++;
              logger.debug(`Deleted expired artifact: ${blob.name}`);
            }
          }
        } catch (error) {
          logger.warn(`Failed to process blob ${blob.name} during cleanup: ${error}`);
          errors++;
        }
      }
    } catch (error) {
      logger.error('Error during Azure artifact cleanup:', error);
      errors++;
    }

    return { deleted, errors };
  }

  private async cleanupLocalArtifacts(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0;
    let errors = 0;

    try {
      const artifactDir = path.join(process.cwd(), this.config.basePath);
      const now = new Date();

      for (const type of ['screenshots', 'logs', 'videos', 'reports']) {
        const typeDir = path.join(artifactDir, type);
        
        try {
          const files = await fs.readdir(typeDir);
          
          for (const file of files) {
            try {
              const filePath = path.join(typeDir, file);
              const stats = await fs.stat(filePath);
              
              const retentionDays = this.config.retention[type as keyof typeof this.config.retention] || 30;
              const expirationDate = new Date(stats.mtime.getTime() + retentionDays * 24 * 60 * 60 * 1000);
              
              if (now > expirationDate) {
                await fs.unlink(filePath);
                deleted++;
                logger.debug(`Deleted expired artifact: ${filePath}`);
              }
            } catch (error) {
              logger.warn(`Failed to process file ${file} during cleanup: ${error}`);
              errors++;
            }
          }
        } catch (error) {
          // Directory doesn't exist or can't be read - skip
          continue;
        }
      }
    } catch (error) {
      logger.error('Error during local artifact cleanup:', error);
      errors++;
    }

    return { deleted, errors };
  }

  private calculateExpirationDate(type: 'screenshot' | 'log' | 'video' | 'report'): Date {
    const retentionDays = this.config.retention[`${type}s` as keyof typeof this.config.retention] || 30;
    return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  }

  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    
    switch (ext) {
      case '.png': return 'image/png';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.webm': return 'video/webm';
      case '.mp4': return 'video/mp4';
      case '.json': return 'application/json';
      case '.html': return 'text/html';
      case '.pdf': return 'application/pdf';
      case '.txt': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }
}

export default ArtifactStorage;