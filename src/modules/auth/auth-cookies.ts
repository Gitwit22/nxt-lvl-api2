import type { CookieOptions, Response } from 'express';

const ACCESS_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const production = process.env['NODE_ENV'] === 'production';

export const ACCESS_COOKIE_NAME = production
  ? '__Host-clientflow_session'
  : 'clientflow_session';
export const REFRESH_COOKIE_NAME = production
  ? '__Host-clientflow_refresh'
  : 'clientflow_refresh';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: production ? 'none' : 'lax',
  path: '/',
};

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...baseCookieOptions,
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
  });
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(ACCESS_COOKIE_NAME, baseCookieOptions);
  response.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions);
}