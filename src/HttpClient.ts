import Promise from 'bluebird';
import createHttpError from 'http-errors';
import { HTTPMethod } from 'http-method-enum';
import { HttpContentType, HttpHeader } from './HttpHeader';
import { HttpResult, IFileBlob } from './HttpResult';

export enum PayloadType {
  None,
  Json,
  UrlEncoded,
  MultipartFormData
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
   * @param headers Headers to include with the request (optional).
   */
  public static get<TResponse>(
    url: string,
    headers?: Headers
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.GET,
      ResponseType.Json,
      headers
    );
  }

  /**
   * Sends a POST request with a JSON payload and returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param payload Data to be included in the request body as JSON.
   * @param headers Headers to include with the request (optional).
   */
  public static post<TResponse>(
    url: string,
    payload: object,
    headers?: Headers
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.POST,
      ResponseType.Json,
      headers,
      payload,
      PayloadType.Json
    );
  }

  /**
   * Sends a PATCH request with a JSON payload and returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param payload Data to be included in the request body as JSON.
   * @param headers Headers to include with the request (optional).
   */
  public static patch<TResponse>(
    url: string,
    payload: object,
    headers?: Headers
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.PATCH,
      ResponseType.Json,
      headers,
      payload,
      PayloadType.Json
    );
  }

  /**
   * Sends a PUT request with a JSON payload and returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param payload Data to be included in the request body as JSON.
   * @param headers Headers to include with the request (optional).
   */
  public static put<TResponse>(
    url: string,
    payload: object,
    headers?: Headers
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.PUT,
      ResponseType.Json,
      headers,
      payload,
      PayloadType.Json
    );
  }

  /**
   * Sends a DELETE request returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param headers Headers to include with the request (optional).
   */
  public static delete<TResponse>(url: string, headers?: Headers) {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.DELETE,
      ResponseType.Json,
      headers
    );
  }

  /**
   * Posts form data to a URL and retrieves the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param form Form object to be encoded in the body.
   * @param headers Headers to include with the request (optional).
   */
  public static postFormUrlEncoded<TResponse>(
    url: string,
    form: object,
    headers?: Headers
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.POST,
      ResponseType.Json,
      headers,
      form,
      PayloadType.UrlEncoded
    );
  }

  /**
   * Sends a POST request with a multipart/form-data payload and returns the JSON response.
   *
   * @param url URL to which the request should be sent.
   * @param payload Data to be included in the request body as JSON.
   * @param headers Headers to include with the request (optional).
   */
  public static postMultipartFormData<TResponse>(
    url: string,
    payload: object,
    headers?: Headers
  ): Promise<HttpResult<TResponse>> {
    return this.sendRequest<TResponse>(
      url,
      HTTPMethod.POST,
      ResponseType.Json,
      headers,
      payload,
      PayloadType.MultipartFormData
    );
  }

  /**
   * Retrieves the file at the given URL and returns it as an IFileBlob.
   *
   * @param url URL from which to retrieve the file.
   * @param headers Headers to include with the request (optional).
   */
  public static downloadFile(
    url: string,
    headers?: Headers
  ): Promise<HttpResult<IFileBlob>> {
    return new Promise((resolve, reject) => {
      const result = new HttpResult<IFileBlob>(HTTPMethod.GET, url);
      fetch(url, {
        headers: this.buildRequestHeaders(PayloadType.None, headers)
      })
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
   * @param headers Headers to include in the request (optional).
   */
  protected static buildRequestHeaders = (
    payloadType: PayloadType,
    headers?: Headers
  ) => {
    const requestHeaders = headers || new Headers();

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

      case PayloadType.MultipartFormData:
        // Fetch knows how generate the full multipart/form-data content type.
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
   * @param responseType Type of reponse expected.
   * @param headers Headers to include with the request (optional).
   * @param payload Optional payload to include in the body.
   * @param payloadType Type of the payload to include in the body.
   */
  private static sendRequest<TResponse>(
    url: string,
    method: HTTPMethod,
    responseType: ResponseType,
    headers?: Headers,
    payload?: object | string,
    payloadType?: PayloadType
  ): Promise<HttpResult<TResponse>> {
    return new Promise((resolve, reject) => {
      const result = new HttpResult<TResponse>(method, url);
      fetch(url, {
        method,
        headers: this.buildRequestHeaders(
          payloadType || PayloadType.None,
          headers
        ),
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
