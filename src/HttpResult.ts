export interface IHttpRequest {
  method: string;
  url: string;
}

// NOTE: this is not a Bluebird Promise
export interface IFileBlob {
  filename?: string;
  blob: Promise<Blob>;
}

/**
 * HttpClient wraps successful calls in a HttpResult that provides information
 * about the original request and metrics for analytics.
 */
export class HttpResult<T> {
  public request: IHttpRequest;
  public initiatedAt: Date; // when the request was initiated
  public completedAt?: Date; // when the request completed
  public duration?: number; // how long the request took to complete
  public data!: T; // the data being returned

  constructor(method: string, url: string) {
    this.request = {
      method,
      url
    };
    this.initiatedAt = new Date();
  }

  public applyData(data: T) {
    this.data = data;
    this.completedAt = new Date();
    this.duration = this.completedAt.getTime() - this.initiatedAt.getTime();
  }
}
