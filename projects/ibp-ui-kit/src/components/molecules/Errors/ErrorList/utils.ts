/*@todo remove file and add imports from core-lib when core-lib dependency appears */

import { useCallback, useState } from 'react';

type BackendErrorCode =
  | 'CONFLICT_ERROR'
  | 'CLIENT_CONFLICT'
  | 'EXTERNAL_CALL_FAILED'
  | 'BAD_REQUEST'
  | 'INTERNAL_SERVER_ERROR'
  | 'NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'OBJECT_NOT_FOUND'
  | 'UNKNOWN'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN';

interface ConstraintViolationInfo {
  message: string;
  path: string;
  code: string;
}

interface BackendError {
  code: BackendErrorCode;
  conflicts?: ConstraintViolationInfo[] | null;
  developerMessage?: string;
  httpStatusCode: number;
  internalErrors?: BackendError[] | null;
  serviceName?: string;
  userMessage: string;
}

interface SerializedError {
  name?: string;
  message?: string;
  stack?: string;
  code?: string;
}

interface RESTResponseErrorType {
  error: string;
  path?: string;
  status: number;
  timestamp?: string;
}

const unknownError = 'Неизвестная ошибка';
const isBackendError = (err: any): err is BackendError =>
  typeof err === 'object' && 'httpStatusCode' in err && 'code' in err && 'userMessage' in err;
const isRestError = (error: RESTResponseErrorType): error is RESTResponseErrorType =>
  typeof error === 'object' && 'error' in error && 'status' in error;
const isSerializedError = (error: SerializedError): error is SerializedError =>
  typeof error === 'object' && 'code' in error && 'message' in error;

export type ErrorType = Error | BackendError | SerializedError | RESTResponseErrorType | string;

export const getErrorMessage = (error: ErrorType) => {
  let errorMessage = unknownError;
  if (error instanceof Error) {
    errorMessage = error.message;
  }
  if (isBackendError(error)) {
    errorMessage = error.userMessage;
  }
  if (isRestError(error as RESTResponseErrorType)) {
    errorMessage = `${(error as RESTResponseErrorType).status} - ${(error as RESTResponseErrorType).error}`;
  }
  if (isSerializedError(error as SerializedError)) {
    errorMessage = (error as SerializedError).message ?? unknownError;
  }
  if (typeof error === 'string') return error;
  return errorMessage;
};

export const useRerender = () => {
  const [rerenderCounter, setRerender] = useState(0);

  const triggerRerender = useCallback(() => {
    if (rerenderCounter === Number.MAX_SAFE_INTEGER) {
      return setRerender(0);
    }
    setRerender(rerenderCounter + 1);
  }, [rerenderCounter, setRerender]);

  return {
    rerenderCounter,
    triggerRerender,
  };
};
