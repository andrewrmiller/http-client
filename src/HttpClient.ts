import Promise = require('bluebird');
import createHttpError from 'http-errors';
import { HTTPMethod } from 'http-method-enum';
import { HttpHeader } from './HttpHeader';
import { HttpResult, IFileBlob } from './HttpResult';

/**
 * HttpClient provides some convenience methods for interacting with our API.
 * Results are returned in a HttpResult object that provides information about
 * the original request and some metrics for analytics. All results are returned
 * as bluebird Promises.
 */
export class HttpClient {
  // retrieves the file at the given URL and returns it as a IFileBlob
  public static downloadFile(url: string): Promise<HttpResult<IFileBlob>> {
    return new Promise((resolve, reject) => {
      const result = new HttpResult<IFileBlob>(HTTPMethod.GET, url);
      fetch(url, { headers: this.buildRequestHeaders(false) })
        .then(response => {
          if (!response.ok) {
            throw createHttpError(response.status, 'Failed to download file.');
          }
          const filename = this.extractFileName(
            response.headers.get(HttpHeader.ContentDisposition)!
          );
          result.applyData({
            filename,
            blob: response.blob()
          });
          resolve(result);
        })
        .catch(reject);
    });
  }

  public static get<T>(url: string): Promise<HttpResult<T>> {
    return this.sendRequest<T>(
      url,
      HTTPMethod.GET,
      'Failed to retrieve JSON data'
    );
  }

  public static patch<T>(url: string, payload: object): Promise<HttpResult<T>> {
    return this.sendUpdateRequest<T>(url, HTTPMethod.PATCH, payload);
  }

  public static post<T>(url: string, payload: object): Promise<HttpResult<T>> {
    return this.sendUpdateRequest<T>(url, HTTPMethod.POST, payload);
  }

  public static put<T>(url: string, payload: object): Promise<HttpResult<T>> {
    return this.sendUpdateRequest<T>(url, HTTPMethod.PUT, payload);
  }

  public static delete<T>(url: string) {
    return this.sendRequest<T>(
      url,
      HTTPMethod.DELETE,
      'Failed to delete item.'
    );
  }

  /**
   * Safely cancels an HTTP request that was made.
   *
   * @param requestPromise - Promise returned from get, patch, post or put.
   * @returns - undefined which is the recommended value to store in place of the cancelled or completed request.
   */
  public static safeCancelRequest(requestPromise?: Promise<any>) {
    if (requestPromise && requestPromise.isPending()) {
      requestPromise.cancel();
    }

    return undefined;
  }

  /**
   * Create a HTTP request header for API calls
   */
  protected static buildRequestHeaders = (forJsonSend: boolean) => {
    const requestHeaders = new Headers();
    if (forJsonSend) {
      requestHeaders.append(HttpHeader.ContentType, 'application/json');
    }
    return requestHeaders;
  };

  /**
   * Extracts the file name from the content disposition header.
   */
  private static extractFileName(disposition: string): string | undefined {
    let result: string | undefined;

    if (disposition && disposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) {
        result = matches[1].replace(/['"]/g, '');
      }
    }

    return result;
  }

  private static sendUpdateRequest<T>(
    url: string,
    method: HTTPMethod,
    payload: object
  ) {
    return this.sendRequest<T>(
      url,
      method,
      'Failed to send JSON data.',
      payload
    );
  }

  private static sendRequest<T>(
    url: string,
    method: HTTPMethod,
    errorMessage: string,
    payload?: object
  ): Promise<HttpResult<T>> {
    return new Promise((resolve, reject) => {
      const result = new HttpResult<T>(method, url);
      fetch(url, {
        method,
        headers: this.buildRequestHeaders(true),
        body: payload ? JSON.stringify(payload) : undefined
      })
        .then(HttpClient.parseResponse(errorMessage))
        .then((data: T) => {
          result.applyData(data);
          resolve(result);
        })
        .catch(reject);
    });
  }

  /**
   * Common routine for parsing a API response
   */
  private static parseResponse = (
    message: string
  ): ((response: Response) => Promise<any>) => {
    return (response: Response) => {
      return new Promise((resolve, reject) => {
        try {
          if (!response.ok) {
            reject(createHttpError(response.status, message));
          } else {
            resolve(response.json());
          }
        } catch (err) {
          reject(err);
        }
      });
    };
  };
}
