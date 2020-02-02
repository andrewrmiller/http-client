import Promise from 'bluebird';
import createHttpError from 'http-errors';
import { HTTPMethod } from 'http-method-enum';
import { HttpContentType, HttpHeader } from './HttpHeader';
import { HttpResult, IFileBlob } from './HttpResult';

enum PayloadType {
  None,
  Json,
  UrlEncoded
}

enum ResponseType {
  None,
  Json,
  Text
}

/**
 * HttpClient provides some convenience methods for interacting with our API.
 * Results are returned in a HttpResult object that provides information about
 * the original request and some metrics for analytics. All results are returned
 * as bluebird Promises.
 */
export class HttpClient {
  /**
   * Retrieves the data from a specified URL as JSON.
   *
   * @param url URL to which the request should be sent.
   */
  public static get<TResponse>(url: string): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(url, HTTPMethod.GET, ResponseType.Json);
  }

  /**
   * Sends a POST request with a JSON payload and returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param payload Data to be included in the request body as JSON.
   */
  public static post<TResponse>(
    url: string,
    payload: object
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.POST,
      ResponseType.Json,
      payload,
      PayloadType.Json
    );
  }

  /**
   * Sends a PATCH request with a JSON payload and returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param payload Data to be included in the request body as JSON.
   */
  public static patch<TResponse>(
    url: string,
    payload: object
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.PATCH,
      ResponseType.Json,
      payload,
      PayloadType.Json
    );
  }

  /**
   * Sends a PUT request with a JSON payload and returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param payload Data to be included in the request body as JSON.
   */
  public static put<TResponse>(
    url: string,
    payload: object
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.PUT,
      ResponseType.Json,
      payload,
      PayloadType.Json
    );
  }

  /**
   * Sends a DELETE request returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   */
  public static delete<TResponse>(url: string) {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.DELETE,
      ResponseType.Json
    );
  }

  /**
   * Posts form data to a URL and retrieves the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param form Form object to be encoded in the body.
   */
  public static postFormUrlEncoded<TResponse>(
    url: string,
    form: object
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.POST,
      ResponseType.Json,
      form,
      PayloadType.UrlEncoded
    );
  }

  /**
   * Retrieves the file at the given URL and returns it as an IFileBlob.
   *
   * @param url URL from which to retrieve hte file.
   */
  public static downloadFile(url: string): Promise<HttpResult<IFileBlob>> {
    return new Promise((resolve, reject) => {
      const result = new HttpResult<IFileBlob>(HTTPMethod.GET, url);
      fetch(url, { headers: this.buildRequestHeaders() })
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
   * Creates the request headers collection for a request.
   *
   * @param payloadType The type of payload to be sent in the body of the request.
   */
  protected static buildRequestHeaders = (payloadType?: PayloadType) => {
    const requestHeaders = new Headers();

    switch (payloadType) {
      case PayloadType.Json:
        requestHeaders.append(HttpHeader.ContentType, HttpContentType.Json);
        break;

      case PayloadType.UrlEncoded:
        requestHeaders.append(
          HttpHeader.ContentType,
          HttpContentType.FormUrlEncoded
        );
        break;

      default:
        break;
    }

    return requestHeaders;
  };

  /**
   * Sends an HTTP request.
   *
   * @param url Target URL for the request.
   * @param method HTTP method to use.
   * @param errorMessage Error message in case of failures.
   * @param payload Optional payload to include in the body.
   * @param payloadType Type of the payload to include in the body.
   */
  private static sendRequest<TResponse>(
    url: string,
    method: HTTPMethod,
    responseType: ResponseType,
    payload?: object | string,
    payloadType?: PayloadType
  ): Promise<HttpResult<TResponse>> {
    return new Promise((resolve, reject) => {
      const result = new HttpResult<TResponse>(method, url);
      fetch(url, {
        method,
        headers: this.buildRequestHeaders(payloadType),
        body: payload
          ? HttpClient.encodePayload(payload, payloadType!)
          : undefined
      })
        .then(HttpClient.parseResponse(method, responseType))
        .then((data: TResponse) => {
          result.applyData(data);
          resolve(result);
        })
        .catch(reject);
    });
  }

  /**
   * Encodes the body of a request for the type of request.
   *
   * @param payload Payload to encode.
   * @param payloadType The type of payload.
   */
  private static encodePayload(
    payload: object | string,
    payloadType: PayloadType
  ) {
    switch (payloadType) {
      case PayloadType.Json:
        return JSON.stringify(payload);

      case PayloadType.UrlEncoded:
        const dict = payload as { [key: string]: string };
        let values: string = '';
        for (const key of Object.keys(dict)) {
          if (values.length > 0) {
            values += '&';
          }
          values += `${key}=${encodeURIComponent(dict[key])}`;
        }
        return values;

      default:
        return payload as string;
    }
  }

  /**
   * Parses the response from an HTTP request.
   */
  private static parseResponse = (
    method: HTTPMethod,
    responseType: ResponseType
  ): ((response: Response) => Promise<any>) => {
    return (response: Response) => {
      return new Promise((resolve, reject) => {
        if (!response.ok) {
          reject(
            createHttpError(
              response.status,
              `HTTP ${method} request failed with status ${response.status}`
            )
          );
          return;
        }

        try {
          switch (responseType) {
            case ResponseType.Text:
              resolve(response.text());
            case ResponseType.Json:
              resolve(response.json());
            default:
              resolve(null);
          }
        } catch (err) {
          reject(err);
        }
      });
    };
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
}
